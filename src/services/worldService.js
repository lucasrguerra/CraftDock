import fsp from 'node:fs/promises';
import path from 'node:path';

// Player-data files kept at the data root (outside the world folder). Bundling
// them into the export makes a world backup portable between instances — Bedrock
// stores no readable player-name list in the world itself, so allowlist/history
// are the only way authorized/known players survive a migration.
const PLAYER_DATA_FILES = [
  'allowlist.json', 'permissions.json',            // Bedrock
  'whitelist.json', 'ops.json', 'usercache.json',  // Java
  'banned-players.json', 'banned-ips.json',        // Java bans
  'craftdock_players_history.json',                // CraftDock join history
];
const AUX_DIR = 'craftdock';

export function createWorldService({ config, dockerService, propertiesService, fs = fsp, archiver, extractZip }) {
  const worldPath = path.join(config.mcDataPath, config.mcWorldName);

  async function stopIfRunning() {
    if ((await dockerService.getState()) === 'running') {
      await dockerService.stop();
      return true;
    }
    return false;
  }

  async function regen(seed) {
    await stopIfRunning();
    if (seed !== undefined && propertiesService) {
      await propertiesService.update({ 'level-seed': seed });
    }
    await fs.rm(worldPath, { recursive: true, force: true });
    await dockerService.start();
    return { ok: true };
  }

  async function createDownloadStream() {
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.directory(worldPath, config.mcWorldName);
    // Bundle player-data files (allowlist/permissions/history/...) under craftdock/
    // so a downloaded world is a portable full backup.
    for (const file of PLAYER_DATA_FILES) {
      const full = path.join(config.mcDataPath, file);
      try {
        await fs.access(full);
        archive.file(full, { name: `${AUX_DIR}/${file}` });
      } catch { /* file absent — skip */ }
    }
    archive.finalize();
    return archive;
  }

  const importPath = worldPath + '.import';
  const auxTemp = importPath + '.aux';

  async function findLevelDatDir(dir) {
    const entries = await fs.readdir(dir);
    if (entries.includes('level.dat')) {
      return dir;
    }
    for (const entry of entries) {
      const entryPath = path.join(dir, entry);
      const stat = await fs.stat(entryPath);
      if (stat.isDirectory()) {
        const found = await findLevelDatDir(entryPath);
        if (found) return found;
      }
    }
    return null;
  }

  async function importWorld(zipPath) {
    const wasRunning = await stopIfRunning();
    let hasAux = false;

    try {
      await fs.rm(importPath, { recursive: true, force: true });
      await fs.rm(auxTemp, { recursive: true, force: true });
      await fs.mkdir(importPath, { recursive: true });
      await extractZip(zipPath, importPath);

      // Rescue bundled player-data files (craftdock/) BEFORE world alignment,
      // which deletes everything in importPath that is not the world.
      const craftdockDir = path.join(importPath, AUX_DIR);
      try {
        await fs.access(craftdockDir);
        await fs.rename(craftdockDir, auxTemp);
        hasAux = true;
      } catch { /* no bundled aux files (older export) */ }

      const levelDatDir = await findLevelDatDir(importPath);
      if (!levelDatDir) {
        throw new Error('invalid_world: level.dat not found');
      }

      // 2. Adjust paths based on Edition / World Name configuration
      if (config.mcWorldName === 'worlds') {
        // Bedrock: We need the structure to be importPath/<level-name>/level.dat
        let levelName = 'Bedrock level';
        if (propertiesService) {
          try {
            const props = await propertiesService.read();
            levelName = props['level-name'] || 'Bedrock level';
          } catch {}
        }

        const targetWorldDir = path.join(importPath, levelName);

        if (levelDatDir === importPath) {
          // level.dat is in root. Move everything to a temp folder, then create <level-name> and move there.
          const tempDir = importPath + '.temp';
          await fs.mkdir(tempDir, { recursive: true });
          const files = await fs.readdir(importPath);
          for (const file of files) {
            await fs.rename(path.join(importPath, file), path.join(tempDir, file));
          }
          await fs.mkdir(targetWorldDir, { recursive: true });
          const tempFiles = await fs.readdir(tempDir);
          for (const file of tempFiles) {
            await fs.rename(path.join(tempDir, file), path.join(targetWorldDir, file));
          }
          await fs.rm(tempDir, { recursive: true, force: true });
        } else {
          // level.dat is in a subdirectory (levelDatDir). Rename that subdirectory to <level-name>.
          const tempAligned = path.join(importPath, 'aligned_world');
          await fs.rename(levelDatDir, tempAligned);
          
          // Clean up any other files in importPath that are not tempAligned
          const remaining = await fs.readdir(importPath);
          for (const item of remaining) {
            const itemPath = path.join(importPath, item);
            if (itemPath !== tempAligned) {
              await fs.rm(itemPath, { recursive: true, force: true });
            }
          }
          
          await fs.rename(tempAligned, targetWorldDir);
        }
      } else {
        // Java: We need the structure to be importPath/level.dat
        if (levelDatDir !== importPath) {
          const tempAligned = path.join(importPath, 'aligned_world');
          await fs.rename(levelDatDir, tempAligned);
          
          // Clean up any other files in importPath that are not tempAligned
          const remaining = await fs.readdir(importPath);
          for (const item of remaining) {
            const itemPath = path.join(importPath, item);
            if (itemPath !== tempAligned) {
              await fs.rm(itemPath, { recursive: true, force: true });
            }
          }
          
          // Hoist all files from aligned_world to importPath
          const files = await fs.readdir(tempAligned);
          for (const file of files) {
            await fs.rename(path.join(tempAligned, file), path.join(importPath, file));
          }
          await fs.rm(tempAligned, { recursive: true, force: true });
        }
      }

    } catch (err) {
      await fs.rm(importPath, { recursive: true, force: true });
      await fs.rm(auxTemp, { recursive: true, force: true }).catch(() => {});
      if (wasRunning) await dockerService.start();
      throw err;
    }
    await fs.rm(worldPath, { recursive: true, force: true });
    await fs.rename(importPath, worldPath);

    // Restore bundled player-data files to the data root (overwriting).
    if (hasAux) {
      const files = await fs.readdir(auxTemp);
      for (const file of files) {
        await fs.rename(path.join(auxTemp, file), path.join(config.mcDataPath, file));
      }
      await fs.rm(auxTemp, { recursive: true, force: true });
    }
    await dockerService.start();
    return { ok: true };
  }

  return {
    regen,
    createDownloadStream,
    importWorld,
    _worldPath: worldPath,
    _stopIfRunning: stopIfRunning,
    _archiver: archiver,
    _extractZip: extractZip,
  };
}

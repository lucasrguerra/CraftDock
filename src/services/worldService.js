import fsp from 'node:fs/promises';
import path from 'node:path';

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

  function createDownloadStream() {
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.directory(worldPath, config.mcWorldName);
    archive.finalize();
    return archive;
  }

  const importPath = worldPath + '.import';

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
    try {
      await fs.mkdir(importPath, { recursive: true });
      await extractZip(zipPath, importPath);

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
      if (wasRunning) await dockerService.start();
      throw err;
    }
    await fs.rm(worldPath, { recursive: true, force: true });
    await fs.rename(importPath, worldPath);
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

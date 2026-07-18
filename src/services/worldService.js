import fsp from 'node:fs/promises';
import path from 'node:path';

export function createWorldService({ config, dockerService, fs = fsp, archiver, extractZip }) {
  const worldPath = path.join(config.mcDataPath, config.mcWorldName);

  async function stopIfRunning() {
    if ((await dockerService.getState()) === 'running') {
      await dockerService.stop();
      return true;
    }
    return false;
  }

  async function regen() {
    await stopIfRunning();
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

  async function importWorld(zipPath) {
    const wasRunning = await stopIfRunning();
    try {
      await fs.mkdir(importPath, { recursive: true });
      await extractZip(zipPath, importPath);
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

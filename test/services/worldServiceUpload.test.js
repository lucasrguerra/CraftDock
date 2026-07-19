import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { createWorldService } from '../../src/services/worldService.js';

function deps(extractOk = true) {
  return {
    config: { mcDataPath: '/data', mcWorldName: 'world' },
    dockerService: {
      getState: vi.fn().mockResolvedValue('running'),
      stop: vi.fn().mockResolvedValue(),
      start: vi.fn().mockResolvedValue(),
    },
    fs: {
      rm: vi.fn().mockResolvedValue(),
      rename: vi.fn().mockResolvedValue(),
      mkdir: vi.fn().mockResolvedValue(),
      readdir: vi.fn().mockResolvedValue(['level.dat']),
      stat: vi.fn().mockResolvedValue({ isDirectory: () => false }),
    },
    // extractZip is injected for testability
    extractZip: vi.fn().mockImplementation(async () => {
      if (!extractOk) throw new Error('bad zip');
    }),
  };
}

describe('worldService.importWorld', () => {
  it('extracts to temp, swaps, restarts on success', async () => {
    const d = deps(true);
    const svc = createWorldService(d);
    const res = await svc.importWorld('/tmp/upload.zip');
    expect(d.extractZip).toHaveBeenCalledWith('/tmp/upload.zip', path.join('/data', 'world.import'));
    expect(d.fs.rm).toHaveBeenCalledWith(path.join('/data', 'world'), { recursive: true, force: true });
    expect(d.fs.rename).toHaveBeenCalledWith(path.join('/data', 'world.import'), path.join('/data', 'world'));
    expect(d.dockerService.start).toHaveBeenCalled();
    expect(res).toEqual({ ok: true });
  });

  it('leaves live world intact and restarts server on bad zip', async () => {
    const d = deps(false);
    const svc = createWorldService(d);
    await expect(svc.importWorld('/tmp/upload.zip')).rejects.toThrow('bad zip');
    // live world never removed
    expect(d.fs.rm).not.toHaveBeenCalledWith(path.join('/data', 'world'), expect.anything());
    expect(d.fs.rename).not.toHaveBeenCalled();
    // temp cleaned + server restarted
    expect(d.fs.rm).toHaveBeenCalledWith(path.join('/data', 'world.import'), { recursive: true, force: true });
    expect(d.dockerService.start).toHaveBeenCalled();
  });

  it('hoists nested directory for Java', async () => {
    const d = deps(true);
    d.fs.readdir = vi.fn().mockImplementation(async (dir) => {
      if (dir.endsWith('world.import')) {
        return ['my_world'];
      }
      if (dir.endsWith('my_world') || dir.endsWith('aligned_world')) {
        return ['level.dat', 'db'];
      }
      return [];
    });
    d.fs.stat = vi.fn().mockImplementation(async (filePath) => {
      return { isDirectory: () => filePath.endsWith('my_world') || filePath.endsWith('aligned_world') };
    });
    
    const svc = createWorldService(d);
    await svc.importWorld('/tmp/upload.zip');
    expect(d.fs.rename).toHaveBeenCalledWith(path.join('/data', 'world.import/my_world'), path.join('/data', 'world.import/aligned_world'));
    expect(d.fs.rm).toHaveBeenCalledWith(path.join('/data', 'world.import/aligned_world'), { recursive: true, force: true });
  });

  it('aligns directory to level-name for Bedrock flat zip', async () => {
    const d = deps(true);
    d.config.mcWorldName = 'worlds';
    d.propertiesService = {
      read: vi.fn().mockResolvedValue({ 'level-name': 'My Bedrock World' })
    };
    d.fs.readdir = vi.fn().mockImplementation(async (dir) => {
      if (dir.endsWith('worlds.import') || dir.endsWith('worlds.import.temp')) {
        return ['level.dat', 'db'];
      }
      return [];
    });
    d.fs.stat = vi.fn().mockResolvedValue({ isDirectory: () => false });
    
    const svc = createWorldService(d);
    await svc.importWorld('/tmp/upload.zip');
    expect(d.fs.mkdir).toHaveBeenCalledWith(path.join('/data', 'worlds.import/My Bedrock World'), { recursive: true });
  });
});

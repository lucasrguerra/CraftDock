import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { createWorldService } from '../../src/services/worldService.js';

describe('worldService.createDownloadStream', () => {
  it('queues the world directory and finalizes the archive', async () => {
    const archive = { directory: vi.fn(), file: vi.fn(), finalize: vi.fn(), on: vi.fn() };
    const archiver = vi.fn().mockReturnValue(archive);
    const svc = createWorldService({
      config: { mcDataPath: '/data', mcWorldName: 'world' },
      dockerService: {},
      // no player-data files present -> access rejects, nothing extra is bundled
      fs: { access: vi.fn().mockRejectedValue(new Error('ENOENT')) },
      archiver,
    });
    const out = await svc.createDownloadStream();
    expect(archiver).toHaveBeenCalledWith('zip', expect.any(Object));
    expect(archive.directory).toHaveBeenCalledWith(path.join('/data', 'world'), 'world');
    expect(archive.finalize).toHaveBeenCalled();
    expect(out).toBe(archive);
  });

  it('bundles existing player-data files under craftdock/', async () => {
    const archive = { directory: vi.fn(), file: vi.fn(), finalize: vi.fn(), on: vi.fn() };
    const archiver = vi.fn().mockReturnValue(archive);
    const svc = createWorldService({
      config: { mcDataPath: '/data', mcWorldName: 'world' },
      dockerService: {},
      // only allowlist.json exists
      fs: { access: vi.fn().mockImplementation(async (p) => { if (!p.endsWith('allowlist.json')) throw new Error('ENOENT'); }) },
      archiver,
    });
    await svc.createDownloadStream();
    expect(archive.file).toHaveBeenCalledWith(path.join('/data', 'allowlist.json'), { name: 'craftdock/allowlist.json' });
  });
});

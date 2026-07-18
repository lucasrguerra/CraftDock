import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { createWorldService } from '../../src/services/worldService.js';

describe('worldService.createDownloadStream', () => {
  it('queues the world directory and finalizes the archive', () => {
    const archive = { directory: vi.fn(), finalize: vi.fn(), on: vi.fn() };
    const archiver = vi.fn().mockReturnValue(archive);
    const svc = createWorldService({
      config: { mcDataPath: '/data', mcWorldName: 'world' },
      dockerService: {},
      fs: {},
      archiver,
    });
    const out = svc.createDownloadStream();
    expect(archiver).toHaveBeenCalledWith('zip', expect.any(Object));
    expect(archive.directory).toHaveBeenCalledWith(path.join('/data', 'world'), 'world');
    expect(archive.finalize).toHaveBeenCalled();
    expect(out).toBe(archive);
  });
});

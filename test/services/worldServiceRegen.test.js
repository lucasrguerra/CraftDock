import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { createWorldService } from '../../src/services/worldService.js';

function deps() {
  return {
    config: { mcDataPath: '/data', mcWorldName: 'world' },
    dockerService: {
      getState: vi.fn().mockResolvedValue('running'),
      stop: vi.fn().mockResolvedValue(),
      start: vi.fn().mockResolvedValue(),
    },
    propertiesService: {
      update: vi.fn().mockResolvedValue({}),
    },
    fs: { rm: vi.fn().mockResolvedValue() },
  };
}

describe('worldService.regen', () => {
  it('stops, removes world dir, restarts', async () => {
    const d = deps();
    const svc = createWorldService(d);
    const res = await svc.regen();
    expect(d.dockerService.stop).toHaveBeenCalled();
    expect(d.fs.rm).toHaveBeenCalledWith(path.join('/data', 'world'), { recursive: true, force: true });
    expect(d.dockerService.start).toHaveBeenCalled();
    expect(res).toEqual({ ok: true });
  });

  it('does not stop if already stopped', async () => {
    const d = deps();
    d.dockerService.getState.mockResolvedValue('exited');
    const svc = createWorldService(d);
    await svc.regen();
    expect(d.dockerService.stop).not.toHaveBeenCalled();
    expect(d.dockerService.start).toHaveBeenCalled();
  });

  it('updates level-seed in propertiesService if seed is provided', async () => {
    const d = deps();
    const svc = createWorldService(d);
    await svc.regen('12345');
    expect(d.propertiesService.update).toHaveBeenCalledWith({ 'level-seed': '12345' });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fsp from 'node:fs/promises';
import { updatePlayerDirectory } from '../../src/services/playerDirectory.js';

vi.mock('node:fs/promises');

// A dockerService whose container returns the given log text, recording the opts
// each `logs()` call was made with (to assert incremental scanning).
function mockDocker(logText) {
  const calls = [];
  return {
    calls,
    getContainer: async () => ({
      logs: async (opts) => { calls.push(opts); return Buffer.from(logText); },
    }),
  };
}

describe('playerDirectory', () => {
  let store;

  beforeEach(() => {
    store = null;
    vi.mocked(fsp.writeFile).mockImplementation(async (_p, data) => { store = data; });
    vi.mocked(fsp.rm).mockResolvedValue();
    // No existing directory / no legacy file by default.
    vi.mocked(fsp.readFile).mockRejectedValue(new Error('ENOENT'));
  });

  it('records only players that actually spawned, keyed by XUID', async () => {
    const log = [
      'Player connected: Rejected, xuid: 111',   // connect only → rejected by allowlist
      'Player Spawned: Lucasrguerra xuid: 222',  // real access
    ].join('\n');

    const list = await updatePlayerDirectory({ dataRoot: '/data', dockerService: mockDocker(log), edition: 'bedrock' });

    expect(list).toEqual([
      expect.objectContaining({ xuid: '222', name: 'Lucasrguerra' }),
    ]);
    // Rejected player (connected but never spawned) is absent.
    expect(list.find((e) => e.name === 'Rejected')).toBeUndefined();
    expect(JSON.parse(store)).toHaveProperty('222');
  });

  it('parses gamertags containing spaces', async () => {
    const list = await updatePlayerDirectory({
      dataRoot: '/data', dockerService: mockDocker('Player Spawned: Lucas Guerra xuid: 333'), edition: 'bedrock',
    });
    expect(list[0]).toMatchObject({ xuid: '333', name: 'Lucas Guerra' });
  });

  it('scans logs incrementally: bounded tail first, then since', async () => {
    // Fresh module so the module-level scan cursor starts at 0 for this test.
    vi.resetModules();
    const { updatePlayerDirectory: fresh } = await import('../../src/services/playerDirectory.js');

    const docker = mockDocker('Player Spawned: steve xuid: 1');
    await fresh({ dataRoot: '/data', dockerService: docker, edition: 'bedrock' });
    expect(docker.calls[0].tail).toBe(2000);
    expect(docker.calls[0].since).toBeUndefined();

    await fresh({ dataRoot: '/data', dockerService: docker, edition: 'bedrock' });
    expect(docker.calls[1].since).toBeGreaterThan(0);
    expect(docker.calls[1].tail).toBeUndefined();
  });

  it('keeps previously-seen players even when no longer spawning (Scenario 2)', async () => {
    // Existing directory already has an old player; a new empty scan must not drop them.
    vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify({
      '999': { name: 'OldPlayer', xuid: '999', firstSeen: 'x', lastSeen: 'x' },
    }));
    const list = await updatePlayerDirectory({ dataRoot: '/data', dockerService: mockDocker(''), edition: 'bedrock' });
    expect(list).toEqual([expect.objectContaining({ xuid: '999', name: 'OldPlayer' })]);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { buildStatusPayload } from '../../src/sockets/statusSocket.js';

describe('buildStatusPayload', () => {
  it('aggregates state, stats and players when running', async () => {
    const dockerService = {
      inspect: vi.fn().mockResolvedValue({ state: 'running', type: 'PAPER' }),
      stats: vi.fn().mockResolvedValue({ cpuPct: 5, memUsedMb: 256, memPct: 25 }),
    };
    const appState = {
      getAdapter: vi.fn().mockResolvedValue({
        listPlayers: vi.fn().mockResolvedValue({ online: 2, max: 20, players: ['a', 'b'] }),
      }),
    };
    const payload = await buildStatusPayload({ dockerService, appState });
    expect(payload).toMatchObject({
      state: 'running', cpuPct: 5, memPct: 25,
      players: { online: 2, max: 20, players: ['a', 'b'] },
    });
  });

  it('returns zeros and empty players when not running', async () => {
    const dockerService = {
      inspect: vi.fn().mockResolvedValue({ state: 'exited', type: 'PAPER' }),
      stats: vi.fn(),
    };
    const appState = { getAdapter: vi.fn() };
    const payload = await buildStatusPayload({ dockerService, appState });
    expect(payload.state).toBe('exited');
    expect(payload.players).toEqual({ online: 0, max: 0, players: [] });
    expect(dockerService.stats).not.toHaveBeenCalled();
  });
});

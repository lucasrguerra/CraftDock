import { describe, it, expect, vi } from 'vitest';
import { createRconService, RconUnavailableError } from '../../src/services/rconService.js';

function fakeRconClass({ failConnect = false } = {}) {
  return class {
    static async connect() {
      if (failConnect) throw new Error('ECONNREFUSED');
      return {
        send: vi.fn().mockResolvedValue('command output'),
        end: vi.fn().mockResolvedValue(),
        on: vi.fn(),
      };
    }
  };
}

const config = { rconHost: 'h', rconPort: 25575, rconPassword: 'p' };

describe('rconService', () => {
  it('connects lazily and sends a command', async () => {
    const svc = createRconService(config, fakeRconClass());
    const out = await svc.send('list');
    expect(out).toBe('command output');
  });

  it('throws RconUnavailableError when connect fails', async () => {
    const svc = createRconService(config, fakeRconClass({ failConnect: true }));
    await expect(svc.send('list')).rejects.toBeInstanceOf(RconUnavailableError);
  });
});

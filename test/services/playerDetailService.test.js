import { describe, it, expect, vi } from 'vitest';
import { createPlayerDetailService } from '../../src/services/playerDetailService.js';

function setup({ edition, online, running = true, dir, bridge, readPlayer, listServerUuids, extraAdapter = {} }) {
  const adapter = {
    _edition: edition,
    listPlayers: vi.fn(async () => ({ players: online ? ['Lucas'] : [] })),
    queryUniqueId: vi.fn(async () => '-8589934591'),
    saveHold: vi.fn(async () => true),
    saveResume: vi.fn(async () => {}),
    forceSave: vi.fn(async () => {}),
    ...extraAdapter,
  };
  const deps = {
    config: { mcDataPath: '/data' },
    appState: { getAdapter: vi.fn(async () => adapter) },
    dockerService: { inspect: vi.fn(async () => ({ state: running ? 'running' : 'exited' })) },
    readDirectory: vi.fn(async () => dir),
    createFileAdapter: vi.fn(() => ({
      readPlayer: vi.fn(readPlayer),
      findByUniqueId: vi.fn(),
      listServerUuids: vi.fn(async () => listServerUuids ? listServerUuids() : []),
    })),
    createBridge: vi.fn(() => bridge),
  };
  return { adapter, service: createPlayerDetailService(deps), deps };
}

describe('playerDetailService', () => {
  it('returns null for an unknown xuid', async () => {
    const { service } = setup({ edition: 'bedrock', online: false, dir: {}, bridge: {} });
    expect(await service.getDetail('nope')).toBeNull();
  });

  it('bedrock online: learns the bridge and reads under a save snapshot', async () => {
    const bridge = {
      learn: vi.fn(async () => ({})),
      resolveLeveldbUuid: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('uuid-1'),
    };
    const { adapter, service } = setup({
      edition: 'bedrock', online: true,
      dir: { '2535': { name: 'Lucas', xuid: '2535' } },
      bridge,
      readPlayer: async (id) => id === 'uuid-1' ? { position: { x: 1, y: 2, z: 3 }, health: { current: 9, max: 20 } } : null,
    });
    const d = await service.getDetail('2535');
    expect(d.online).toBe(true);
    expect(d.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(bridge.learn).toHaveBeenCalledWith({ xuid: '2535', name: 'Lucas', uniqueId: '-8589934591' });
    expect(adapter.saveHold).toHaveBeenCalled();
    expect(adapter.saveResume).toHaveBeenCalled();
  });

  it('bedrock offline and never bridged: auto-binds single LevelDB uuid fallback', async () => {
    const bridge = { learn: vi.fn(async () => ({})), resolveLeveldbUuid: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('uuid-fallback-1') };
    const { service } = setup({
      edition: 'bedrock', online: false, running: false,
      dir: { '2535': { name: 'Lucas', xuid: '2535' } },
      bridge,
      readPlayer: async (id) => id === 'uuid-fallback-1' ? { health: 20 } : null,
      listServerUuids: () => ['uuid-fallback-1'],
    });

    const d = await service.getDetail('2535');
    expect(d.needsBridge).toBe(false);
    expect(d.health).toBe(20);
    expect(bridge.learn).toHaveBeenCalledWith({ xuid: '2535', name: 'Lucas', fallbackUuid: 'uuid-fallback-1' });
  });

  it('bedrock offline and never bridged with multiple uuids: returns needsBridge', async () => {
    const bridge = { learn: vi.fn(), resolveLeveldbUuid: vi.fn(async () => null) };
    const { service } = setup({
      edition: 'bedrock', online: false,
      dir: { '2535': { name: 'Lucas', xuid: '2535' } },
      bridge,
      readPlayer: async () => null,
      listServerUuids: () => ['uuid-1', 'uuid-2'],
    });
    const d = await service.getDetail('2535');
    expect(d.needsBridge).toBe(true);
  });



  it('java online: forces save then reads the player .dat', async () => {
    const { adapter, service } = setup({
      edition: 'java', online: true,
      dir: { 'uuid-xyz': { name: 'Lucas', xuid: 'uuid-xyz' } },
      bridge: {},
      readPlayer: async (id) => id === 'uuid-xyz' ? { position: { x: 0, y: 64, z: 0 }, food: 20 } : null,
    });
    const d = await service.getDetail('uuid-xyz');
    expect(adapter.forceSave).toHaveBeenCalled();
    expect(d.food).toBe(20);
    expect(d.needsBridge).toBe(false);
  });
});

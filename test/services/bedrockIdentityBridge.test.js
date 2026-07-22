import { describe, it, expect, vi, beforeEach } from 'vitest';
import fsp from 'node:fs/promises';
import { createBedrockIdentityBridge } from '../../src/services/bedrockIdentityBridge.js';

vi.mock('node:fs/promises');

describe('bedrockIdentityBridge', () => {
  let store;
  beforeEach(() => {
    store = null;
    vi.mocked(fsp.writeFile).mockImplementation(async (_p, data) => { store = data; });
    vi.mocked(fsp.readFile).mockImplementation(async () => {
      if (store == null) throw new Error('ENOENT');
      return store;
    });
  });

  it('learn binds xuid to the LevelDB uuid when uniqueId matches', async () => {
    const fileAdapter = { findByUniqueId: vi.fn(async (u) => u === '-8589934591' ? { uuid: 'abc-uuid', data: {} } : null) };
    const bridge = createBedrockIdentityBridge({ dataRoot: '/data', fileAdapter });

    const binding = await bridge.learn({ xuid: '2535407895138987', name: 'Lucasrguerra', uniqueId: '-8589934591' });
    expect(binding.leveldbUuid).toBe('abc-uuid');
    expect(await bridge.resolveLeveldbUuid('2535407895138987')).toBe('abc-uuid');
  });

  it('learn returns null and persists nothing when uniqueId matches no player', async () => {
    const fileAdapter = { findByUniqueId: vi.fn(async () => null) };
    const bridge = createBedrockIdentityBridge({ dataRoot: '/data', fileAdapter });
    expect(await bridge.learn({ xuid: 'x', name: 'n', uniqueId: '-1' })).toBeNull();
    expect(store).toBeNull();
  });

  it('learn returns null when uniqueId is missing (never queries)', async () => {
    const fileAdapter = { findByUniqueId: vi.fn() };
    const bridge = createBedrockIdentityBridge({ dataRoot: '/data', fileAdapter });
    expect(await bridge.learn({ xuid: 'x', name: 'n', uniqueId: null })).toBeNull();
    expect(fileAdapter.findByUniqueId).not.toHaveBeenCalled();
  });

  it('resolveLeveldbUuid returns null for an unknown xuid', async () => {
    const bridge = createBedrockIdentityBridge({ dataRoot: '/data', fileAdapter: {} });
    expect(await bridge.resolveLeveldbUuid('nope')).toBeNull();
  });
});

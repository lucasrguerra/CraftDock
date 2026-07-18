import { describe, it, expect, vi } from 'vitest';
import { createJavaAdapter } from '../../src/adapters/javaAdapter.js';

function make(sendImpl) {
  const rcon = { send: vi.fn(sendImpl || (async () => 'ok')) };
  return { rcon, adapter: createJavaAdapter(rcon) };
}

describe('JavaAdapter', () => {
  it('whitelistAdd issues "whitelist add"', async () => {
    const { rcon, adapter } = make();
    await adapter.whitelistAdd('steve');
    expect(rcon.send).toHaveBeenCalledWith('whitelist add steve');
  });

  it('ban issues "ban" with reason', async () => {
    const { rcon, adapter } = make();
    await adapter.ban('griefer', 'no griefing');
    expect(rcon.send).toHaveBeenCalledWith('ban griefer no griefing');
  });

  it('give issues "give" with item and count', async () => {
    const { rcon, adapter } = make();
    await adapter.give('steve', 'minecraft:diamond', 5);
    expect(rcon.send).toHaveBeenCalledWith('give steve minecraft:diamond 5');
  });

  it('listPlayers parses rcon output', async () => {
    const { adapter } = make(async () => 'There are 1 of a max of 20 players online: steve');
    expect(await adapter.listPlayers()).toEqual({ online: 1, max: 20, players: ['steve'] });
  });

  it('exposes JAVA capabilities', () => {
    const { adapter } = make();
    expect(adapter.capabilities.has('ban')).toBe(true);
  });
});

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

  it('getSeed parses seed correctly', async () => {
    const { adapter } = make(async () => 'Seed: [123456789]');
    const seed = await adapter.getSeed();
    expect(seed).toBe('123456789');
  });

  it('getPlayerPosition parses coordinates and dimension correctly', async () => {
    let callCount = 0;
    const { rcon, adapter } = make(async (cmd) => {
      callCount++;
      if (cmd.startsWith('tp')) {
        return 'Teleported steve to 10.5, 64, -20.3';
      }
      if (cmd.startsWith('data get')) {
        return 'steve has the following entity data: "minecraft:overworld"';
      }
      return '';
    });
    const pos = await adapter.getPlayerPosition('steve');
    expect(pos).toEqual({ x: 10.5, y: 64, z: -20.3, dimension: 'overworld' });
  });

  it('whitelistOn maps to "whitelist on"', async () => {
    const { rcon, adapter } = make();
    await adapter.whitelistOn();
    expect(rcon.send).toHaveBeenCalledWith('whitelist on');
  });

  it('whitelistOff maps to "whitelist off"', async () => {
    const { rcon, adapter } = make();
    await adapter.whitelistOff();
    expect(rcon.send).toHaveBeenCalledWith('whitelist off');
  });

  it('whitelistList parses "whitelist list" output into array', async () => {
    const { adapter } = make(async () => 'There are 3 whitelisted players: steve, alex, notch');
    const list = await adapter.whitelistList();
    expect(list).toEqual(['steve', 'alex', 'notch']);
  });

  it('whitelistList returns empty array when no players', async () => {
    const { adapter } = make(async () => 'There are 0 whitelisted players:');
    const list = await adapter.whitelistList();
    expect(list).toEqual([]);
  });

  it('sendCommand sends command unmodified if no slash', async () => {
    const { rcon, adapter } = make();
    await adapter.sendCommand('gamerule showcoordinates true');
    expect(rcon.send).toHaveBeenCalledWith('gamerule showcoordinates true');
  });

  it('sendCommand strips leading slash from command', async () => {
    const { rcon, adapter } = make();
    await adapter.sendCommand('/gamerule showcoordinates true');
    expect(rcon.send).toHaveBeenCalledWith('gamerule showcoordinates true');
  });

  it('exposes whitelistOn/Off/List capabilities', () => {
    const { adapter } = make();
    expect(adapter.capabilities.has('whitelistOn')).toBe(true);
    expect(adapter.capabilities.has('whitelistOff')).toBe(true);
    expect(adapter.capabilities.has('whitelistList')).toBe(true);
  });

  it('forceSave issues "save-all flush"', async () => {
    const { rcon, adapter } = make();
    await adapter.forceSave();
    expect(rcon.send).toHaveBeenCalledWith('save-all flush');
  });
});

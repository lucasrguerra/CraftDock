import { describe, it, expect, vi } from 'vitest';
import { createBedrockAdapter } from '../../src/adapters/bedrockAdapter.js';
import { NotSupportedError } from '../../src/adapters/serverAdapter.js';

function make(sendImpl) {
  const stdin = { send: vi.fn(sendImpl || (async () => 'ok')) };
  return { stdin, adapter: createBedrockAdapter(stdin) };
}

describe('BedrockAdapter', () => {
  it('whitelistAdd maps to "allowlist add"', async () => {
    const { stdin, adapter } = make();
    await adapter.whitelistAdd('steve');
    expect(stdin.send).toHaveBeenCalledWith('allowlist add "steve"');
  });

  it('whitelistRemove maps to "allowlist remove"', async () => {
    const { stdin, adapter } = make();
    await adapter.whitelistRemove('steve');
    expect(stdin.send).toHaveBeenCalledWith('allowlist remove "steve"');
  });

  it('ban throws NotSupportedError', async () => {
    const { adapter } = make();
    await expect(adapter.ban('x')).rejects.toBeInstanceOf(NotSupportedError);
  });

  it('does not advertise ban capability', () => {
    const { adapter } = make();
    expect(adapter.capabilities.has('ban')).toBe(false);
  });

  it('does not expose getSeed (Bedrock has no seed command; read from level.dat)', () => {
    const { adapter } = make();
    expect(adapter.getSeed).toBeUndefined();
  });

  it('getPlayerPosition parses querytarget response when it is clean JSON', async () => {
    const { adapter } = make(async (cmd) => {
      if (cmd.startsWith('querytarget')) {
        return '[{"position":{"x":15.0,"y":70.0,"z":-30.0},"dimension":1}]';
      }
      return '';
    });
    const pos = await adapter.getPlayerPosition('alex');
    expect(pos).toEqual({ x: 15, y: 70, z: -30, dimension: 'nether' });
  });

  it('getPlayerPosition parses querytarget response when it has a log/text prefix', async () => {
    const { adapter } = make(async (cmd) => {
      if (cmd.startsWith('querytarget')) {
        return '[2026-07-18 23:08:38:396 INFO] Target data: [\n' +
               '  {\n' +
               '     "dimension" : 0,\n' +
               '     "position" : {\n' +
               '        "x" : 12.5,\n' +
               '        "y" : 64.0,\n' +
               '        "z" : -25.5\n' +
               '     }\n' +
               '  }\n' +
               ']';
      }
      return '';
    });
    const pos = await adapter.getPlayerPosition('alex');
    expect(pos).toEqual({ x: 12.5, y: 64, z: -25.5, dimension: 'overworld' });
  });

  it('getPlayerPosition returns null when querytarget fails, and does not fall back to tp', async () => {
    const { stdin, adapter } = make(async (cmd) => {
      if (cmd.startsWith('querytarget')) {
        return 'Unknown command or failure';
      }
      return 'Teleported alex to 12.5, 64, -25.5';
    });
    const pos = await adapter.getPlayerPosition('alex');
    expect(pos).toBeNull();
    expect(stdin.send).not.toHaveBeenCalledWith(expect.stringContaining('tp '));
  });

  it('whitelistOn maps to "allowlist on"', async () => {
    const { stdin, adapter } = make();
    await adapter.whitelistOn();
    expect(stdin.send).toHaveBeenCalledWith('allowlist on');
  });

  it('whitelistOff maps to "allowlist off"', async () => {
    const { stdin, adapter } = make();
    await adapter.whitelistOff();
    expect(stdin.send).toHaveBeenCalledWith('allowlist off');
  });

  it('whitelistList parses "allowlist list" output into array', async () => {
    const { adapter } = make(async () => 'There are 2 allowlisted players: steve, alex');
    const list = await adapter.whitelistList();
    expect(list).toEqual(['steve', 'alex']);
  });

  it('whitelistList returns empty array when no players', async () => {
    const { adapter } = make(async () => 'There are 0 allowlisted players:');
    const list = await adapter.whitelistList();
    expect(list).toEqual([]);
  });

  it('sendCommand sends command unmodified if no slash', async () => {
    const { stdin, adapter } = make();
    await adapter.sendCommand('gamerule showcoordinates true');
    expect(stdin.send).toHaveBeenCalledWith('gamerule showcoordinates true');
  });

  it('sendCommand strips leading slash from command', async () => {
    const { stdin, adapter } = make();
    await adapter.sendCommand('/gamerule showcoordinates true');
    expect(stdin.send).toHaveBeenCalledWith('gamerule showcoordinates true');
  });

  it('exposes whitelistOn/Off/List capabilities', () => {
    const { adapter } = make();
    expect(adapter.capabilities.has('whitelistOn')).toBe(true);
    expect(adapter.capabilities.has('whitelistOff')).toBe(true);
    expect(adapter.capabilities.has('whitelistList')).toBe(true);
  });

  it('saveHold sends "save hold" then polls "save query" until ready', async () => {
    const { stdin, adapter } = make(async (cmd) =>
      cmd === 'save query' ? 'Data saved. Files are now ready to be copied.' : 'ok');
    const ok = await adapter.saveHold();
    expect(ok).toBe(true);
    expect(stdin.send).toHaveBeenCalledWith('save hold');
    expect(stdin.send).toHaveBeenCalledWith('save query');
  });

  it('saveResume sends "save resume"', async () => {
    const { stdin, adapter } = make();
    await adapter.saveResume();
    expect(stdin.send).toHaveBeenCalledWith('save resume');
  });

  it('queryUniqueId extracts the uniqueId from querytarget output', async () => {
    const { adapter } = make(async (cmd) =>
      cmd.startsWith('querytarget')
        ? '[{"dimension":0,"position":{"x":1,"y":2,"z":3},"uniqueId":"-8589934591"}]'
        : 'ok');
    expect(await adapter.queryUniqueId('alex')).toBe('-8589934591');
  });

  it('queryUniqueId extracts decimal uniqueId from noisy log output', async () => {
    const { adapter } = make(async (cmd) =>
      cmd.startsWith('querytarget')
        ? '[2026-07-22 22:43:05:123 INFO] Target data: [{"dimension":0,"position":{"x":100,"y":64,"z":-200},"uniqueId":2535407895138987}]'
        : 'ok');
    expect(await adapter.queryUniqueId('Lucasrguerra')).toBe('2535407895138987');
  });

  it('queryUniqueId parses the real multi-line 1.26 output (UUID uniqueId, id present)', async () => {
    // Captured verbatim from a live bedrock 1.26.33.2 server
    const real = [
      '[2026-07-23 02:40:43:441 INFO] Target data: [',
      '   {',
      '      "dimension" : 0,',
      '      "id" : -64424509439,',
      '      "position" : {',
      '         "x" : 79.52253723144531,',
      '         "y" : 98.62001037597656,',
      '         "z" : 14.37582015991211',
      '      },',
      '      "uniqueId" : "657cb1d4-99dd-3123-b27f-d0c27df79710",',
      '      "yRot" : -82.85218048095703',
      '   }',
      ']',
    ].join('\n');
    const { adapter } = make(async (cmd) => (cmd.startsWith('querytarget') ? real : 'ok'));
    expect(await adapter.queryUniqueId('Lucasrguerra')).toBe('657cb1d4-99dd-3123-b27f-d0c27df79710');
    expect(await adapter.getPlayerPosition('Lucasrguerra')).toEqual({
      x: 79.52253723144531, y: 98.62001037597656, z: 14.37582015991211, dimension: 'overworld',
    });
  });

  it('queryUniqueId returns null when querytarget fails', async () => {
    const { adapter } = make(async () => 'Unknown command');
    expect(await adapter.queryUniqueId('alex')).toBeNull();
  });
});


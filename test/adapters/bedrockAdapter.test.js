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
    expect(stdin.send).toHaveBeenCalledWith('allowlist add steve');
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

  it('getPlayerPosition parses querytarget response', async () => {
    const { adapter } = make(async (cmd) => {
      if (cmd.startsWith('querytarget')) {
        return '[{"position":{"x":15.0,"y":70.0,"z":-30.0},"dimension":1}]';
      }
      return '';
    });
    const pos = await adapter.getPlayerPosition('alex');
    expect(pos).toEqual({ x: 15, y: 70, z: -30, dimension: 'nether' });
  });

  it('getPlayerPosition falls back to tp when querytarget fails', async () => {
    const { adapter } = make(async (cmd) => {
      if (cmd.startsWith('querytarget')) {
        return 'Unknown command or failure';
      }
      if (cmd.startsWith('tp')) {
        return 'Teleported alex to 12.5, 64, -25.5';
      }
      return '';
    });
    const pos = await adapter.getPlayerPosition('alex');
    expect(pos).toEqual({ x: 12.5, y: 64, z: -25.5, dimension: 'overworld' });
  });
});

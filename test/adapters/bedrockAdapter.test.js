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
});

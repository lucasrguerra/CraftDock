import { describe, it, expect, vi } from 'vitest';
import { createAppState } from '../src/appState.js';

const deps = () => ({
  config: { mcEdition: 'auto' },
  dockerService: { inspect: vi.fn().mockResolvedValue({ type: 'PAPER' }) },
  rconService: { send: async () => 'r' },
  stdinService: { send: async () => 's' },
});

describe('appState', () => {
  it('resolves a java adapter when TYPE is PAPER', async () => {
    const state = createAppState(deps());
    const a = await state.getAdapter();
    expect(a.capabilities.has('ban')).toBe(true);
  });

  it('honors forced bedrock edition without inspecting', async () => {
    const d = deps();
    d.config.mcEdition = 'bedrock';
    const state = createAppState(d);
    const a = await state.getAdapter();
    expect(a.capabilities.has('ban')).toBe(false);
    expect(d.dockerService.inspect).not.toHaveBeenCalled();
  });
});

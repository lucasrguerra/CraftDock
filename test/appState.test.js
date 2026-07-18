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

  it('does not cache a fallback when TYPE is unknown, then re-resolves once known', async () => {
    const d = deps();
    // First inspect (container stopped) yields no type; second yields BEDROCK.
    d.dockerService.inspect = vi
      .fn()
      .mockResolvedValueOnce({ type: null })
      .mockResolvedValueOnce({ type: 'BEDROCK' });
    const state = createAppState(d);

    const first = await state.getAdapter();
    expect(first.capabilities.has('ban')).toBe(true); // java fallback, not cached

    const second = await state.getAdapter();
    expect(second.capabilities.has('ban')).toBe(false); // now correctly bedrock
    expect(d.dockerService.inspect).toHaveBeenCalledTimes(2);
  });

  it('caches once a definitive TYPE is resolved', async () => {
    const d = deps(); // inspect always returns PAPER
    const state = createAppState(d);
    await state.getAdapter();
    await state.getAdapter();
    expect(d.dockerService.inspect).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect } from 'vitest';
import { createAdapter, isBedrock } from '../../src/adapters/index.js';

const deps = {
  rconService: { send: async () => 'r' },
  stdinService: { send: async () => 's' },
};

describe('adapter factory', () => {
  it('isBedrock detects BEDROCK type case-insensitively', () => {
    expect(isBedrock('BEDROCK')).toBe(true);
    expect(isBedrock('bedrock')).toBe(true);
    expect(isBedrock('PAPER')).toBe(false);
    expect(isBedrock(null)).toBe(false);
  });

  it('creates a java adapter for PAPER', () => {
    const a = createAdapter('PAPER', deps);
    expect(a.capabilities.has('ban')).toBe(true);
  });

  it('creates a bedrock adapter for BEDROCK', () => {
    const a = createAdapter('BEDROCK', deps);
    expect(a.capabilities.has('ban')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { createPlayerFileAdapter } from '../../src/adapters/playerFile/index.js';

const config = { mcDataPath: '/data', mcWorldName: 'worlds' };

describe('createPlayerFileAdapter', () => {
  it('returns the bedrock adapter (with findByUniqueId) for bedrock', () => {
    const a = createPlayerFileAdapter('bedrock', config);
    expect(typeof a.readPlayer).toBe('function');
    expect(typeof a.findByUniqueId).toBe('function');
  });

  it('returns the java adapter for java', () => {
    const a = createPlayerFileAdapter('java', config);
    expect(typeof a.readPlayer).toBe('function');
    expect(a.findByUniqueId).toBeUndefined();
  });
});

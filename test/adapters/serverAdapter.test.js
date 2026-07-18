import { describe, it, expect } from 'vitest';
import { parsePlayerList, CAPABILITIES } from '../../src/adapters/serverAdapter.js';

describe('parsePlayerList', () => {
  it('parses Java list output', () => {
    const r = parsePlayerList(
      'There are 2 of a max of 20 players online: steve, alex'
    );
    expect(r).toEqual({ online: 2, max: 20, players: ['steve', 'alex'] });
  });

  it('parses Bedrock list output', () => {
    const r = parsePlayerList('There are 1/10 players online:\nnotch');
    expect(r).toEqual({ online: 1, max: 10, players: ['notch'] });
  });

  it('handles empty server', () => {
    const r = parsePlayerList('There are 0 of a max of 20 players online:');
    expect(r).toEqual({ online: 0, max: 20, players: [] });
  });
});

describe('CAPABILITIES', () => {
  it('java supports ban, bedrock does not', () => {
    expect(CAPABILITIES.JAVA.has('ban')).toBe(true);
    expect(CAPABILITIES.BEDROCK.has('ban')).toBe(false);
  });
});

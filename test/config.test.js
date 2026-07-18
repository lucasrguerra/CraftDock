import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = {
  ADMIN_PASSWORD_HASH: 'hash',
  SESSION_SECRET: 'secret',
  RCON_PASSWORD: 'rp',
};

describe('loadConfig', () => {
  it('applies defaults for optional vars', () => {
    const c = loadConfig(base);
    expect(c.mcContainerName).toBe('craftdock-mc-server');
    expect(c.rconPort).toBe(25575);
    expect(c.port).toBe(3000);
    expect(c.mcEdition).toBe('auto');
    expect(c.maxUploadBytes).toBe(1024 * 1024 * 1024);
  });

  it('throws when required vars are missing', () => {
    expect(() => loadConfig({})).toThrow(/ADMIN_PASSWORD_HASH/);
  });

  it('coerces numeric env vars', () => {
    const c = loadConfig({ ...base, RCON_PORT: '25580', PORT: '8080' });
    expect(c.rconPort).toBe(25580);
    expect(c.port).toBe(8080);
  });

  it('falls back to defaults for empty string or non-numeric numeric env vars', () => {
    const c = loadConfig({ ...base, RCON_PORT: '', PORT: 'abc' });
    expect(c.rconPort).toBe(25575);
    expect(c.port).toBe(3000);
  });
});

import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = {
  ADMIN_PASSWORD_HASH: 'hash',
  SESSION_SECRET: 'secret',
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

  it('does not require RCON_PASSWORD (Java-only), defaulting it to empty', () => {
    const c = loadConfig(base);
    expect(c.rconPassword).toBe('');
  });

  it('accepts a base64-encoded hash when the raw hash is absent', () => {
    const realHash = '$2a$12$YjrtHh2BNcUT0P76L2ZUF.mCtxzUwN.gZ4siUqji2oxrDbIXRdvfe';
    const b64 = Buffer.from(realHash, 'utf8').toString('base64');
    const c = loadConfig({ SESSION_SECRET: 's', ADMIN_PASSWORD_HASH_B64: b64 });
    expect(c.adminPasswordHash).toBe(realHash);
  });

  it('prefers the raw hash over the base64 one when both are set', () => {
    const b64 = Buffer.from('other', 'utf8').toString('base64');
    const c = loadConfig({ SESSION_SECRET: 's', ADMIN_PASSWORD_HASH: 'raw', ADMIN_PASSWORD_HASH_B64: b64 });
    expect(c.adminPasswordHash).toBe('raw');
  });

  it('throws when neither raw nor base64 hash is provided', () => {
    expect(() => loadConfig({ SESSION_SECRET: 's' })).toThrow(/ADMIN_PASSWORD_HASH/);
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

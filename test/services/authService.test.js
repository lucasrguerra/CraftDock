import { describe, it, expect, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { createAuthService } from '../../src/services/authService.js';

describe('authService', () => {
  let svc;
  beforeAll(() => {
    const hash = bcrypt.hashSync('correct', 12);
    svc = createAuthService({ adminPasswordHash: hash });
  });

  it('accepts the correct password', async () => {
    expect(await svc.verifyPassword('correct')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    expect(await svc.verifyPassword('wrong')).toBe(false);
  });

  it('rejects empty input without throwing', async () => {
    expect(await svc.verifyPassword('')).toBe(false);
  });
});

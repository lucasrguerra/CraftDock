import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/server.js';

function fakeDeps() {
  const config = {
    adminPasswordHash: bcrypt.hashSync('pw', 10),
    sessionSecret: 'test-secret',
    nodeEnv: 'test',
    mcDataPath: '/data',
  };
  const dockerService = {
    inspect: vi.fn().mockResolvedValue({ state: 'exited', type: 'PAPER' }),
    stats: vi.fn(), start: vi.fn(), stop: vi.fn(), restart: vi.fn(), kill: vi.fn(),
  };
  const appState = { getEdition: vi.fn().mockResolvedValue('java'), getAdapter: vi.fn() };
  const propertiesService = { read: vi.fn().mockResolvedValue({}), update: vi.fn() };
  const worldService = {};
  const authService = { verifyPassword: async (p) => p === 'pw' };
  const upload = { single: () => (req, _res, next) => next() };
  return { config, dockerService, appState, propertiesService, worldService, authService, upload };
}

describe('server auth guard', () => {
  it('blocks /api/status when unauthenticated', async () => {
    const { app } = createApp(fakeDeps());
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(401);
  });

  it('allows /api/status after login', async () => {
    const { app } = createApp(fakeDeps());
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ password: 'pw' });
    const res = await agent.get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('exited');
  });
});

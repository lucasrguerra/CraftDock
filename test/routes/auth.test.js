import { describe, it, expect } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { createAuthRouter } from '../../src/routes/auth.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  const authService = { verifyPassword: async (p) => p === 'right' };
  app.use('/api/auth', createAuthRouter(authService));
  return app;
}

describe('auth routes', () => {
  it('logs in with correct password and reports authed', async () => {
    const agent = request.agent(makeApp());
    const login = await agent.post('/api/auth/login').send({ password: 'right' });
    expect(login.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.body).toEqual({ authed: true });
  });

  it('rejects wrong password', async () => {
    const res = await request(makeApp()).post('/api/auth/login').send({ password: 'no' });
    expect(res.status).toBe(401);
  });

  it('logs out', async () => {
    const agent = request.agent(makeApp());
    await agent.post('/api/auth/login').send({ password: 'right' });
    await agent.post('/api/auth/logout');
    const me = await agent.get('/api/auth/me');
    expect(me.body).toEqual({ authed: false });
  });
});

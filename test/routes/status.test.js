import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createStatusRouter } from '../../src/routes/status.js';
import { ContainerNotFoundError } from '../../src/services/dockerService.js';

function makeApp(overrides = {}) {
  const dockerService = {
    inspect: vi.fn().mockResolvedValue({ state: 'running', type: 'PAPER' }),
    stats: vi.fn().mockResolvedValue({ cpuPct: 10, memUsedMb: 512, memPct: 50 }),
    start: vi.fn().mockResolvedValue(),
    stop: vi.fn().mockResolvedValue(),
    restart: vi.fn().mockResolvedValue(),
    kill: vi.fn().mockResolvedValue(),
    ...overrides.dockerService,
  };
  const adapter = { listPlayers: vi.fn().mockResolvedValue({ online: 1, max: 20, players: ['a'] }) };
  const appState = {
    getEdition: vi.fn().mockResolvedValue('java'),
    getAdapter: vi.fn().mockResolvedValue(adapter),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/status', createStatusRouter({ dockerService, appState }));
  return { app, dockerService };
}

describe('status routes', () => {
  it('GET / returns aggregated status', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      state: 'running', edition: 'java', cpuPct: 10, memPct: 50,
      players: { online: 1, max: 20, players: ['a'] },
    });
  });

  it('POST /start delegates to dockerService', async () => {
    const { app, dockerService } = makeApp();
    const res = await request(app).post('/api/status/start');
    expect(res.body).toEqual({ ok: true });
    expect(dockerService.start).toHaveBeenCalled();
  });

  it('POST /start returns 404 when container missing', async () => {
    const { app } = makeApp({
      dockerService: { start: vi.fn().mockRejectedValue(new ContainerNotFoundError('mc')) },
    });
    const res = await request(app).post('/api/status/start');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});

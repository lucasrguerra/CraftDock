import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPlayersRouter } from '../../src/routes/players.js';
import { NotSupportedError } from '../../src/adapters/serverAdapter.js';

function makeApp(adapterOverrides = {}) {
  const adapter = {
    capabilities: new Set(['whitelistAdd', 'ban', 'give']),
    listPlayers: vi.fn().mockResolvedValue({ online: 0, max: 20, players: [] }),
    whitelistAdd: vi.fn().mockResolvedValue('Added steve'),
    ban: vi.fn().mockResolvedValue('Banned'),
    give: vi.fn().mockResolvedValue('Gave'),
    ...adapterOverrides,
  };
  const appState = { getAdapter: vi.fn().mockResolvedValue(adapter) };
  const app = express();
  app.use(express.json());
  app.use('/api/players', createPlayersRouter({ appState }));
  return { app, adapter };
}

describe('players routes', () => {
  it('GET / returns players and capability list', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/players');
    expect(res.body.capabilities).toContain('ban');
    expect(res.body.players).toEqual({ online: 0, max: 20, players: [] });
  });

  it('POST /whitelistAdd delegates with name', async () => {
    const { app, adapter } = makeApp();
    const res = await request(app).post('/api/players/whitelistAdd').send({ name: 'steve' });
    expect(res.body).toEqual({ ok: true, output: 'Added steve' });
    expect(adapter.whitelistAdd).toHaveBeenCalledWith('steve');
  });

  it('POST /give passes item and count', async () => {
    const { app, adapter } = makeApp();
    await request(app).post('/api/players/give').send({ name: 'steve', item: 'minecraft:dirt', count: 3 });
    expect(adapter.give).toHaveBeenCalledWith('steve', 'minecraft:dirt', 3);
  });

  it('returns 409 on NotSupportedError', async () => {
    const { app } = makeApp({ ban: vi.fn().mockRejectedValue(new NotSupportedError('ban')) });
    const res = await request(app).post('/api/players/ban').send({ name: 'x' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'not_supported' });
  });

  it('returns 400 for unknown action', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/players/frobnicate').send({ name: 'x' });
    expect(res.status).toBe(400);
  });
});

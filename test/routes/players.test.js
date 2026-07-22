import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPlayersRouter } from '../../src/routes/players.js';
import { NotSupportedError } from '../../src/adapters/serverAdapter.js';

function makeApp(adapterOverrides = {}, { propertiesOverrides } = {}) {
  const adapter = {
    capabilities: new Set(['whitelistAdd', 'whitelistRemove', 'whitelistOn', 'whitelistOff', 'whitelistList', 'ban', 'give']),
    _edition: 'java',
    listPlayers: vi.fn().mockResolvedValue({ online: 0, max: 20, players: [] }),
    whitelistAdd: vi.fn().mockResolvedValue('Added steve'),
    whitelistRemove: vi.fn().mockResolvedValue('Removed steve'),
    whitelistOn: vi.fn().mockResolvedValue('Whitelist enabled'),
    whitelistOff: vi.fn().mockResolvedValue('Whitelist disabled'),
    whitelistList: vi.fn().mockResolvedValue(['steve', 'alex']),
    ban: vi.fn().mockResolvedValue('Banned'),
    give: vi.fn().mockResolvedValue('Gave'),
    ...adapterOverrides,
  };
  const propertiesService = {
    read: vi.fn().mockResolvedValue({ 'white-list': 'true' }),
    update: vi.fn().mockResolvedValue({}),
    ...propertiesOverrides,
  };
  const appState = { getAdapter: vi.fn().mockResolvedValue(adapter) };
  const app = express();
  app.use(express.json());
  app.use('/api/players', createPlayersRouter({ appState, propertiesService, config: { mcDataPath: '/data' } }));
  return { app, adapter, propertiesService };
}

describe('players routes', () => {
  it('rejects a name-requiring action with an empty name (does not call the adapter)', async () => {
    const { app, adapter } = makeApp();
    const res = await request(app).post('/api/players/whitelistRemove').send({ name: '  ' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'name_required' });
    expect(adapter.whitelistRemove).not.toHaveBeenCalled();
  });

  it('allows name-less actions (whitelistOn) without a name', async () => {
    const { app, adapter } = makeApp();
    const res = await request(app).post('/api/players/whitelistOn').send({});
    expect(res.status).toBe(200);
    expect(adapter.whitelistOn).toHaveBeenCalled();
  });

  it('GET / returns players and capability list', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/players');
    expect(res.body.capabilities).toContain('ban');
    expect(res.body.players).toEqual({ online: 0, max: 20, players: [], directory: [] });
  });

  it('GET / returns whitelistEnabled and whitelist', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/players');
    expect(res.body.whitelistEnabled).toBe(true);
    expect(res.body.whitelist).toEqual(['steve', 'alex']);
  });

  it('GET / returns whitelistEnabled=false when property is false', async () => {
    const { app } = makeApp({}, {
      propertiesOverrides: { read: vi.fn().mockResolvedValue({ 'white-list': 'false' }) },
    });
    const res = await request(app).get('/api/players');
    expect(res.body.whitelistEnabled).toBe(false);
  });

  it('GET / reads allow-list property for bedrock edition', async () => {
    const { app } = makeApp({ _edition: 'bedrock' }, {
      propertiesOverrides: { read: vi.fn().mockResolvedValue({ 'allow-list': 'true' }) },
    });
    const res = await request(app).get('/api/players');
    expect(res.body.whitelistEnabled).toBe(true);
  });

  it('POST /whitelistAdd delegates with name', async () => {
    const { app, adapter } = makeApp();
    const res = await request(app).post('/api/players/whitelistAdd').send({ name: 'steve' });
    expect(res.body).toEqual({ ok: true, output: 'Added steve' });
    expect(adapter.whitelistAdd).toHaveBeenCalledWith('steve');
  });

  it('POST /whitelistOn calls adapter and persists to properties', async () => {
    const { app, adapter, propertiesService } = makeApp();
    const res = await request(app).post('/api/players/whitelistOn').send({});
    expect(res.body.ok).toBe(true);
    expect(adapter.whitelistOn).toHaveBeenCalled();
    expect(propertiesService.update).toHaveBeenCalledWith({ 'white-list': 'true' });
  });

  it('POST /whitelistOff calls adapter and persists to properties', async () => {
    const { app, adapter, propertiesService } = makeApp();
    const res = await request(app).post('/api/players/whitelistOff').send({});
    expect(res.body.ok).toBe(true);
    expect(adapter.whitelistOff).toHaveBeenCalled();
    expect(propertiesService.update).toHaveBeenCalledWith({ 'white-list': 'false' });
  });

  it('POST /whitelistOn for bedrock persists allow-list property', async () => {
    const { app, adapter, propertiesService } = makeApp({ _edition: 'bedrock' });
    const res = await request(app).post('/api/players/whitelistOn').send({});
    expect(res.body.ok).toBe(true);
    expect(propertiesService.update).toHaveBeenCalledWith({ 'allow-list': 'true' });
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

import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPropertiesRouter } from '../../src/routes/properties.js';

function makeApp() {
  const propertiesService = {
    read: vi.fn().mockResolvedValue({ difficulty: 'easy', 'max-players': '20' }),
    update: vi.fn().mockImplementation(async (p) => ({ difficulty: 'easy', 'max-players': '20', ...p })),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/properties', createPropertiesRouter({ propertiesService }));
  return { app, propertiesService };
}

describe('properties routes', () => {
  it('GET / returns properties', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/properties');
    expect(res.body.properties.difficulty).toBe('easy');
  });

  it('GET / fills defaults for managed keys missing from the file (except motd)', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/properties');
    const p = res.body.properties;
    // present in the file → kept as-is
    expect(p.difficulty).toBe('easy');
    expect(p['max-players']).toBe('20');
    // absent from the file → default applied
    expect(p.pvp).toBe('true');
    expect(p['keep-inventory']).toBe('false');
    expect(p.hardcore).toBe('false');
    expect(p['allow-flight']).toBe('false');
    expect(p['force-gamemode']).toBe('false');
    expect(p['allow-nether']).toBe('true');
    expect(p['enable-command-block']).toBe('false');
    expect(p['spawn-monsters']).toBe('true');
    expect(p['spawn-animals']).toBe('true');
    expect(p['spawn-npcs']).toBe('true');
    expect(p.gamemode).toBe('survival');
    expect(p['view-distance']).toBe('10');
    expect(p['simulation-distance']).toBe('10');
    expect(p['spawn-protection']).toBe('16');
    // motd deliberately has no default
    expect(p.motd).toBeUndefined();
  });

  it('GET / serves pure defaults when server.properties does not exist yet', async () => {
    const propertiesService = {
      read: vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { code: 'ENOENT' })),
    };
    const app = express();
    app.use('/api/properties', createPropertiesRouter({ propertiesService }));
    const res = await request(app).get('/api/properties');
    expect(res.status).toBe(200);
    expect(res.body.properties.pvp).toBe('true');
    expect(res.body.properties.gamemode).toBe('survival');
  });

  it('PUT / accepts valid values', async () => {
    const { app, propertiesService } = makeApp();
    const res = await request(app).put('/api/properties').send({ properties: { difficulty: 'hard' } });
    expect(res.status).toBe(200);
    expect(propertiesService.update).toHaveBeenCalledWith({ difficulty: 'hard' });
  });

  it('PUT / rejects invalid enum with 400', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/properties').send({ properties: { difficulty: 'banana' } });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('difficulty');
  });

  it('PUT / rejects non-numeric max-players', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/properties').send({ properties: { 'max-players': 'lots' } });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('max-players');
  });
});

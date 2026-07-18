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

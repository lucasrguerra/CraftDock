import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PassThrough } from 'node:stream';
import { createWorldRouter } from '../../src/routes/world.js';

function noopUpload() {
  // fake multer middleware that sets req.file
  return { single: () => (req, _res, next) => { req.file = { path: '/tmp/up.zip' }; next(); } };
}

function makeApp(worldOverrides = {}) {
  const worldService = {
    regen: vi.fn().mockResolvedValue({ ok: true }),
    importWorld: vi.fn().mockResolvedValue({ ok: true }),
    createDownloadStream: vi.fn().mockImplementation(() => {
      const s = new PassThrough();
      process.nextTick(() => { s.end('zipbytes'); });
      return s;
    }),
    ...worldOverrides,
  };
  const app = express();
  app.use(express.json());
  app.use('/api/world', createWorldRouter({ worldService, upload: noopUpload() }));
  return { app, worldService };
}

describe('world routes', () => {
  it('POST /regen delegates with seed', async () => {
    const { app, worldService } = makeApp();
    const res = await request(app).post('/api/world/regen').send({ seed: '99988' });
    expect(res.body).toEqual({ ok: true });
    expect(worldService.regen).toHaveBeenCalledWith('99988');
  });

  it('GET /download streams a zip', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/world/download');
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.text).toContain('zipbytes');
  });

  it('POST /upload imports the world', async () => {
    const { app, worldService } = makeApp();
    const res = await request(app).post('/api/world/upload');
    expect(res.body).toEqual({ ok: true });
    expect(worldService.importWorld).toHaveBeenCalledWith('/tmp/up.zip');
  });

  it('POST /upload returns 400 on bad zip', async () => {
    const { app } = makeApp({ importWorld: vi.fn().mockRejectedValue(new Error('bad zip')) });
    const res = await request(app).post('/api/world/upload');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_world' });
  });
});

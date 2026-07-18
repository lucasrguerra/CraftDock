import { Router } from 'express';

export function createWorldRouter({ worldService, upload }) {
  const router = Router();

  router.post('/regen', async (req, res, next) => {
    const { seed } = req.body || {};
    try { res.json(await worldService.regen(seed)); } catch (err) { next(err); }
  });

  router.get('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="world.zip"');
    const archive = worldService.createDownloadStream();
    archive.on('error', () => res.destroy());
    archive.pipe(res);
  });

  router.post('/upload', upload.single('world'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    try {
      await worldService.importWorld(req.file.path);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'invalid_world' });
    }
  });

  return router;
}

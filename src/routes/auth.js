import { Router } from 'express';

export function createAuthRouter(authService) {
  const router = Router();

  router.post('/login', async (req, res) => {
    const ok = await authService.verifyPassword(req.body?.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    req.session.authed = true;
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/me', (req, res) => {
    res.json({ authed: req.session?.authed === true });
  });

  return router;
}

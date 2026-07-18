import { Router } from 'express';
import { ContainerNotFoundError } from '../services/dockerService.js';

export function createStatusRouter({ dockerService, appState }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const info = await dockerService.inspect();
      let stats = { cpuPct: 0, memUsedMb: 0, memPct: 0 };
      let players = { online: 0, max: 0, players: [] };
      let edition = null;
      if (info.state === 'running') {
        stats = await dockerService.stats();
        edition = await appState.getEdition();
        try {
          const adapter = await appState.getAdapter();
          players = await adapter.listPlayers();
        } catch { /* server up but not accepting commands yet */ }
      }
      res.json({ state: info.state, type: info.type, edition, ...stats, players });
    } catch (err) { next(err); }
  });

  for (const action of ['start', 'stop', 'restart', 'kill']) {
    router.post(`/${action}`, async (req, res) => {
      try {
        await dockerService[action]();
        res.json({ ok: true });
      } catch (err) {
        if (err instanceof ContainerNotFoundError) {
          return res.status(404).json({ error: 'not_found' });
        }
        res.status(500).json({ error: err.message });
      }
    });
  }

  return router;
}

import { Router } from 'express';
import { NotSupportedError } from '../adapters/serverAdapter.js';

const ARG_MAP = {
  whitelistAdd: (b) => [b.name],
  whitelistRemove: (b) => [b.name],
  whitelistOn: () => [],
  whitelistOff: () => [],
  op: (b) => [b.name],
  deop: (b) => [b.name],
  pardon: (b) => [b.name],
  ban: (b) => [b.name, b.reason || ''],
  kick: (b) => [b.name, b.reason || ''],
  give: (b) => [b.name, b.item, Number(b.count) || 1],
  gamemode: (b) => [b.name, b.mode],
  teleport: (b) => [b.name, b.target],
};

/** Returns the server.properties key for the whitelist toggle. */
function whitelistPropKey(edition) {
  return edition === 'bedrock' ? 'allow-list' : 'white-list';
}

export function createPlayersRouter({ appState, propertiesService }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const adapter = await appState.getAdapter();
      const [players, whitelist, props] = await Promise.all([
        adapter.listPlayers(),
        adapter.whitelistList(),
        propertiesService.read(),
      ]);
      const propKey = whitelistPropKey(adapter._edition);
      const whitelistEnabled = props[propKey] === 'true';
      res.json({ players, capabilities: [...adapter.capabilities], whitelistEnabled, whitelist });
    } catch (err) { next(err); }
  });

  router.post('/:action', async (req, res) => {
    const { action } = req.params;
    const argsFn = ARG_MAP[action];
    if (!argsFn) return res.status(400).json({ error: 'unknown_action' });
    try {
      const adapter = await appState.getAdapter();
      if (typeof adapter[action] !== 'function') {
        return res.status(400).json({ error: 'unknown_action' });
      }
      const output = await adapter[action](...argsFn(req.body || {}));

      // Persist toggle state to server.properties
      if (action === 'whitelistOn' || action === 'whitelistOff') {
        const propKey = whitelistPropKey(adapter._edition);
        const value = action === 'whitelistOn' ? 'true' : 'false';
        await propertiesService.update({ [propKey]: value });
      }

      res.json({ ok: true, output });
    } catch (err) {
      if (err instanceof NotSupportedError) {
        return res.status(409).json({ error: 'not_supported' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

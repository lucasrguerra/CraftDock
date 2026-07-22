import { Router } from 'express';
import { NotSupportedError } from '../adapters/serverAdapter.js';
import { resolveName, queryDirectory, readDirectory } from '../services/playerDirectory.js';
import { createPlayerFileAdapter } from '../adapters/playerFile/index.js';
import { createBedrockIdentityBridge } from '../services/bedrockIdentityBridge.js';
import { createPlayerDetailService } from '../services/playerDetailService.js';

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

// Actions whose first argument is a player name. Guarding against an empty name
// stops commands like `allowlist remove ` (which the server rejects) from ever
// being sent — defense in depth against a bad/ghost name reaching the console.
const NAME_REQUIRED = new Set([
  'whitelistAdd', 'whitelistRemove', 'op', 'deop', 'pardon', 'ban', 'kick', 'give', 'gamemode', 'teleport',
]);

/** Returns the server.properties key for the whitelist toggle. */
function whitelistPropKey(edition) {
  return edition === 'bedrock' ? 'allow-list' : 'white-list';
}

export function createPlayersRouter({ appState, propertiesService, config, dockerService }) {
  const router = Router();
  const dataRoot = config?.mcDataPath || '/minecraft/data';

  const detailService = createPlayerDetailService({
    config, appState, dockerService,
    readDirectory,
    createFileAdapter: createPlayerFileAdapter,
    createBridge: createBedrockIdentityBridge,
  });

  // Online players + whitelist + capabilities. The (potentially huge) directory
  // is NOT embedded here — it is fetched page-by-page from GET /directory.
  router.get('/', async (req, res, next) => {
    try {
      const adapter = await appState.getAdapter();
      const [players, whitelist, props] = await Promise.all([
        adapter.listPlayers(),
        adapter.whitelistList(),
        propertiesService.read(),
      ]);
      const edition = adapter._edition;
      const propKey = whitelistPropKey(edition);
      const whitelistEnabled = props[propKey] === 'true';
      res.json({
        players,
        capabilities: [...adapter.capabilities],
        whitelistEnabled,
        whitelist,
      });
    } catch (err) { next(err); }
  });

  // Server-side paginated + filtered directory; each item annotated `online`.
  router.get('/directory', async (req, res, next) => {
    try {
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 25;
      const q = req.query.q || '';
      const result = await queryDirectory(dataRoot, { page, pageSize, q });
      let onlineNames = [];
      try {
        const adapter = await appState.getAdapter();
        onlineNames = (await adapter.listPlayers())?.players || [];
      } catch { /* server may be down — everyone shows offline */ }
      const online = new Set(onlineNames);
      res.json({
        ...result,
        items: result.items.map((e) => ({ ...e, online: online.has(e.name) })),
      });
    } catch (err) { next(err); }
  });

  // Rich per-player data read from the world save (position/health/food/inventory).
  router.get('/detail', async (req, res, next) => {
    try {
      const xuid = String(req.query.xuid || '');
      if (!xuid) return res.status(400).json({ error: 'xuid_required' });
      const detail = await detailService.getDetail(xuid);
      if (!detail) return res.status(404).json({ error: 'not_found' });
      res.json(detail);
    } catch (err) { next(err); }
  });

  router.post('/:action', async (req, res) => {
    const { action } = req.params;
    const argsFn = ARG_MAP[action];
    if (!argsFn) return res.status(400).json({ error: 'unknown_action' });

    req.body = req.body || {};
    // XUID is the canonical identity. When the client targets a known player by
    // xuid, resolve it to the current gamertag here — Bedrock console commands are
    // name-based, so every action is ultimately issued by name.
    if (req.body.xuid && !String(req.body.name ?? '').trim()) {
      const name = await resolveName(dataRoot, String(req.body.xuid));
      if (name) req.body.name = name;
    }

    if (NAME_REQUIRED.has(action) && !String(req.body?.name ?? '').trim()) {
      return res.status(400).json({ error: 'name_required' });
    }
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

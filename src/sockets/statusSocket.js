import { updatePlayerDirectory } from '../services/playerDirectory.js';

export async function buildStatusPayload({ dockerService, appState, seedService, logger, config }) {
  const info = await dockerService.inspect();
  if (info.state !== 'running') {
    if (seedService?.clearCache) {
      seedService.clearCache();
    }
    return {
      state: info.state, type: info.type,
      cpuPct: 0, memUsedMb: 0, memPct: 0,
      players: { online: 0, max: 0, players: [] },
      seed: null,
    };
  }
  const stats = await dockerService.stats();
  let players = { online: 0, max: 0, players: [] };
  let seed = null;
  let type = info.type;

  try {
    const adapter = await appState.getAdapter();
    const edition = adapter._edition === 'bedrock' ? 'bedrock' : 'java';
    type = edition === 'bedrock' ? 'BEDROCK' : 'JAVA';

    players = await adapter.listPlayers();
    if (config) {
      // Keep the XUID directory fresh (captures Player Spawned lines) but do NOT
      // ship the whole list on the 2s status feed — it can hold thousands of
      // entries. The Players tab fetches it page-by-page from GET /players/directory.
      await updatePlayerDirectory({ dataRoot: config.mcDataPath, dockerService, edition });
    }
    seed = await seedService.resolve(adapter, edition);
  } catch (err) {
    logger?.warn('status payload: command channel not ready', { error: err.message });
  }
  return { state: info.state, type, ...stats, players, seed };
}

export function registerStatusSocket(namespace, { dockerService, appState, seedService, logger, config, intervalMs = 2000 }) {
  namespace.on('connection', (socket) => {
    logger?.debug('status socket connected', { id: socket.id });
    const push = async () => {
      try {
        socket.emit('status', await buildStatusPayload({ dockerService, appState, seedService, logger, config }));
      } catch (err) {
        logger?.error('status push failed', err);
        socket.emit('status', { state: 'error', error: err.message });
      }
    };
    push();
    const timer = setInterval(push, intervalMs);
    socket.on('disconnect', () => {
      logger?.debug('status socket disconnected', { id: socket.id });
      clearInterval(timer);
    });
  });
}

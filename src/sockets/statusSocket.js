export async function buildStatusPayload({ dockerService, appState, seedService, logger }) {
  const info = await dockerService.inspect();
  if (info.state !== 'running') {
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
    if (players?.players?.length && adapter.getPlayerPosition) {
      const positions = {};
      for (const name of players.players) {
        try {
          const pos = await adapter.getPlayerPosition(name);
          if (pos) positions[name] = pos;
        } catch (err) {
          logger?.debug('position lookup failed', { player: name, error: err.message });
        }
      }
      players.positions = positions;
    }

    seed = await seedService.resolve(adapter, edition);
  } catch (err) {
    logger?.warn('status payload: command channel not ready', { error: err.message });
  }
  return { state: info.state, type, ...stats, players, seed };
}

export function registerStatusSocket(namespace, { dockerService, appState, seedService, logger, intervalMs = 2000 }) {
  namespace.on('connection', (socket) => {
    logger?.debug('status socket connected', { id: socket.id });
    const push = async () => {
      try {
        socket.emit('status', await buildStatusPayload({ dockerService, appState, seedService, logger }));
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

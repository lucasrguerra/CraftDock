export async function buildStatusPayload({ dockerService, appState }) {
  const info = await dockerService.inspect();
  if (info.state !== 'running') {
    return {
      state: info.state, type: info.type,
      cpuPct: 0, memUsedMb: 0, memPct: 0,
      players: { online: 0, max: 0, players: [] },
    };
  }
  const stats = await dockerService.stats();
  let players = { online: 0, max: 0, players: [] };
  try {
    const adapter = await appState.getAdapter();
    players = await adapter.listPlayers();
  } catch { /* command channel not ready */ }
  return { state: info.state, type: info.type, ...stats, players };
}

export function registerStatusSocket(namespace, { dockerService, appState, intervalMs = 2000 }) {
  namespace.on('connection', (socket) => {
    const push = async () => {
      try {
        socket.emit('status', await buildStatusPayload({ dockerService, appState }));
      } catch (err) {
        socket.emit('status', { state: 'error', error: err.message });
      }
    };
    push();
    const timer = setInterval(push, intervalMs);
    socket.on('disconnect', () => clearInterval(timer));
  });
}

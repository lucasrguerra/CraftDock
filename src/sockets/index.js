import { registerLogsSocket } from './logsSocket.js';
import { registerStatusSocket } from './statusSocket.js';
import { socketAuth } from '../middleware/auth.js';

export function registerSockets(io, { dockerService, appState, seedService, sessionMiddleware, logger, config }) {
  const auth = socketAuth(sessionMiddleware);

  const logs = io.of('/logs');
  logs.use(auth);
  registerLogsSocket(logs, { dockerService, appState, logger: logger?.child('logs-socket') });

  const status = io.of('/status');
  status.use(auth);
  registerStatusSocket(status, { dockerService, appState, seedService, logger: logger?.child('status-socket'), config });

  return { logs, status };
}

import express from 'express';
import session from 'express-session';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as IOServer } from 'socket.io';

import { requireAuth } from './middleware/auth.js';
import { createAuthRouter } from './routes/auth.js';
import { createStatusRouter } from './routes/status.js';
import { createPlayersRouter } from './routes/players.js';
import { createPropertiesRouter } from './routes/properties.js';
import { createWorldRouter } from './routes/world.js';
import { registerSockets } from './sockets/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(deps) {
  const { config, dockerService, appState, propertiesService, worldService, authService, upload } = deps;
  const app = express();

  const sessionMiddleware = session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
    },
  });

  app.use(express.json());
  app.use(sessionMiddleware);

  // public
  app.use('/api/auth', createAuthRouter(authService));

  // guarded
  app.use('/api', requireAuth);
  app.use('/api/status', createStatusRouter({ dockerService, appState }));
  app.use('/api/players', createPlayersRouter({ appState }));
  app.use('/api/properties', createPropertiesRouter({ propertiesService }));
  app.use('/api/world', createWorldRouter({ worldService, upload }));

  // config exposure for the SPA (mapUrl only — no secrets)
  app.get('/api/client-config', requireAuth, (req, res) => {
    res.json({ mapUrl: config.mapUrl || '' });
  });

  // static SPA
  app.use(express.static(path.join(__dirname, 'public')));

  // error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message });
  });

  return { app, sessionMiddleware };
}

export function startServer(deps) {
  const { app, sessionMiddleware } = createApp(deps);
  const server = http.createServer(app);
  const io = new IOServer(server);
  registerSockets(io, {
    dockerService: deps.dockerService,
    appState: deps.appState,
    sessionMiddleware,
  });
  server.listen(deps.config.port, () => {
    console.log(`CraftDock listening on :${deps.config.port}`);
  });
  return server;
}

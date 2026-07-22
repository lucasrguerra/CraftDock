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
  const { config, dockerService, appState, propertiesService, worldService, authService, upload, seedService, logger } = deps;
  const app = express();

  // Request logging (info level).
  if (logger) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const durationMs = Date.now() - start;
        if (req.originalUrl === '/api/health' && res.statusCode === 200) return;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`, {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          durationMs,
        });
      });
      next();
    });
  }

  // Behind a TLS-terminating reverse proxy (e.g. Coolify/Traefik on 443), the
  // app receives plain http with X-Forwarded-Proto: https. Trusting the proxy
  // lets express-session recognize the request as secure and actually set the
  // `secure` session cookie — without this, login silently fails in production.
  app.set('trust proxy', 1);

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
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', createAuthRouter(authService));

  // guarded
  app.use('/api', requireAuth);
  app.use('/api/status', createStatusRouter({ dockerService, appState }));
  app.use('/api/players', createPlayersRouter({ appState, propertiesService, config, dockerService }));
  app.use('/api/properties', createPropertiesRouter({ propertiesService }));
  app.use('/api/world', createWorldRouter({ worldService, upload }));

  // config exposure for the SPA (no secrets): map settings + resolved world seed
  app.get('/api/client-config', requireAuth, async (req, res) => {
    let seed = null;
    let edition = null;
    try {
      const adapter = await appState.getAdapter();
      edition = adapter._edition || null;
      seed = await seedService.resolve(adapter, edition);
    } catch (err) {
      logger?.warn('client-config: seed resolution failed', { error: err.message });
    }
    res.json({
      mapVersion: config.mapVersion || '',
      seed,
      edition,
    });
  });

  // static SPA
  app.use(express.static(path.join(__dirname, 'public')));

  // error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger?.error('unhandled request error', { url: req.originalUrl, error: err.message, stack: err.stack });
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
    seedService: deps.seedService,
    sessionMiddleware,
    logger: deps.logger,
    config: deps.config,
  });
  server.listen(deps.config.port, () => {
    (deps.logger?.info ? deps.logger.info(`listening on :${deps.config.port}`) : console.log(`CraftDock listening on :${deps.config.port}`));
  });
  return server;
}

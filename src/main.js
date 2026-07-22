import Docker from 'dockerode';
import archiver from 'archiver';
import unzipper from 'unzipper';
import multer from 'multer';
import os from 'node:os';
import { createReadStream } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { createDockerService } from './services/dockerService.js';
import { createRconService } from './services/rconService.js';
import { createStdinService } from './services/stdinService.js';
import { createPropertiesService } from './services/propertiesService.js';
import { createWorldService } from './services/worldService.js';
import { createAuthService } from './services/authService.js';
import { createSeedService } from './services/seedService.js';
import { createAppState } from './appState.js';
import { startServer } from './server.js';

const config = loadConfig();

process.on('uncaughtException', (err) => {
  logger.error('uncaught exception', { error: err.message, stack: err.stack, cause: err.cause });
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// Ensure shared configuration files have correct permissions (writable by anyone)
// so the Minecraft container (running as user minecraft UID 1000) does not hit write permission errors.
const FILES_TO_CHMOD = [
  'allowlist.json', 'permissions.json',
  'whitelist.json', 'ops.json', 'usercache.json',
  'banned-players.json', 'banned-ips.json',
  'craftdock_players_history.json', 'craftdock_players.json',
  'server.properties'
];
for (const file of FILES_TO_CHMOD) {
  const p = path.join(config.mcDataPath, file);
  fsp.chmod(p, 0o666).catch(() => {});
}
const docker = new Docker(); // uses /var/run/docker.sock by default

const dockerService = createDockerService(config, docker);
const rconService = createRconService(config, undefined, logger.child('rcon'));
const stdinService = createStdinService(dockerService, { logger: logger.child('stdin') });
const propertiesService = createPropertiesService(config);
const authService = createAuthService(config);
const seedService = createSeedService({ config, propertiesService, logger: logger.child('seed') });
const appState = createAppState({ config, dockerService, rconService, stdinService });

const extractZip = (zip, dest) =>
  new Promise((resolve, reject) => {
    createReadStream(zip)
      .pipe(unzipper.Extract({ path: dest }))
      .on('close', resolve)
      .on('error', reject);
  });

const worldService = createWorldService({ config, dockerService, propertiesService, archiver, extractZip });
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: config.maxUploadBytes },
});

startServer({
  config, dockerService, appState, propertiesService,
  worldService, authService, upload, seedService, logger,
});

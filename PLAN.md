# CraftDock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight self-hosted web panel (Aternos-style) to manage a single Minecraft server (Java or Bedrock) running as a Docker container under Coolify.

**Architecture:** Node.js + Express backend controls a fixed, Coolify-managed Minecraft container over the Docker socket (Dockerode). Game commands go through a `ServerAdapter` abstraction — RCON for Java, container stdin (`docker attach`) for Bedrock. Socket.io streams logs and status in real time. A single-password session protects every HTTP route and the Socket.io handshake. The frontend is a vanilla-JS tabbed SPA served statically by the same Express app.

**Tech Stack:** Node.js (>=18), Express 4, Socket.io 4, dockerode, rcon-client, express-session, bcryptjs, archiver, unzipper, multer, Tailwind (CDN), Vitest (tests).

## Global Constraints

- **Node.js >= 18** (uses global `fetch`, `fs/promises`, ESM). `package.json` sets `"type": "module"`.
- **Single Minecraft server per instance.** No multi-server code paths.
- **Container is fixed.** CraftDock only does `start`/`stop`/`restart`/`kill` + edits volume files. It NEVER recreates the container or changes `TYPE`/`VERSION` at runtime.
- **Auth is mandatory on every `/api/*` route (except `/api/auth/login`) and on the Socket.io handshake.** The panel mounts `/var/run/docker.sock` (= host root), so no route may be reachable unauthenticated.
- **Editions:** Java (RCON) and Bedrock (stdin). Features with no Bedrock equivalent throw `NotSupportedError`; the UI hides them based on `adapter.capabilities`.
- **Deploy prerequisite:** the Minecraft service must set `OVERRIDE_SERVER_PROPERTIES=false`, else `itzg` regenerates `server.properties` from env vars on each start and the Options tab won't persist.
- **All file operations on the world write to a temp dir then swap** — never partial writes into the live world folder.
- **Test runner:** Vitest. Every task is TDD: failing test → run (fail) → minimal impl → run (pass) → commit.
- **Commits:** small and frequent, Conventional Commits style (`feat:`, `test:`, `chore:`).

---

## Architecture Reference

### Backend module map

| Module | Responsibility | Depends on |
|--------|----------------|-----------|
| `src/config.js` | read + validate env vars, export typed config object | — |
| `src/services/dockerService.js` | resolve target container by name; `start/stop/restart/kill`; `inspect` (state, TYPE); `stats` (CPU/mem); log stream; attach stream | dockerode |
| `src/services/rconService.js` | persistent RCON connection with reconnect; `send(cmd)` | rcon-client |
| `src/services/stdinService.js` | attach to container; write stdin; capture recent stdout | dockerService |
| `src/services/propertiesService.js` | read/parse/write `server.properties` | fs, config |
| `src/services/worldService.js` | zip/unzip/regen world with temp+swap | fs, archiver, unzipper, dockerService |
| `src/services/authService.js` | verify password (bcrypt) | bcryptjs, config |
| `src/adapters/serverAdapter.js` | base interface + `NotSupportedError` | — |
| `src/adapters/javaAdapter.js` | logical command → RCON command | rconService |
| `src/adapters/bedrockAdapter.js` | logical command → stdin command | stdinService |
| `src/adapters/index.js` | `createAdapter(type, deps)` factory | java/bedrock adapters |
| `src/middleware/auth.js` | `requireAuth` (HTTP) + `socketAuth` (handshake) | express-session |
| `src/routes/*.js` | HTTP endpoints, thin — delegate to services/adapters | services, adapters |
| `src/sockets/*.js` | log stream + status push namespaces | dockerService, adapter |
| `src/server.js` | compose everything, serve SPA | all |

### File tree (final)

```
craftdock/
├── src/
│   ├── server.js
│   ├── config.js
│   ├── appState.js               # shared singletons (adapter, container name)
│   ├── middleware/auth.js
│   ├── services/{docker,rcon,stdin,properties,world,auth}Service.js
│   ├── adapters/{serverAdapter,javaAdapter,bedrockAdapter,index}.js
│   ├── routes/{auth,status,players,properties,world}.js
│   ├── sockets/{index,logsSocket,statusSocket}.js
│   └── public/
│       ├── index.html
│       ├── css/styles.css
│       └── js/{app,socket}.js + js/tabs/{status,console,players,options,world,map}.js
├── scripts/hash-password.js
├── test/**                       # mirrors src/ with *.test.js
├── Dockerfile
├── docker-compose.example.yaml
├── .env.example
├── .dockerignore
├── vitest.config.js
├── package.json
└── README.md
```

---

# PHASE 0 — Project Scaffolding

### Task 0.1: Initialize project + tooling

**Files:**
- Create: `package.json`, `vitest.config.js`, `.gitignore`, `.dockerignore`, `.env.example`

**Interfaces:**
- Produces: npm scripts `test`, `start`, `dev`; ESM enabled project-wide.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "craftdock",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "hash": "node scripts/hash-password.js"
  },
  "dependencies": {
    "archiver": "^6.0.1",
    "bcryptjs": "^2.4.3",
    "dockerode": "^4.0.2",
    "express": "^4.19.2",
    "express-session": "^1.18.0",
    "multer": "^1.4.5-lts.1",
    "rcon-client": "^4.2.4",
    "socket.io": "^4.7.5",
    "unzipper": "^0.10.14"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    globals: false,
  },
});
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.env
panel-data/
*.log
coverage/
```

- [ ] **Step 4: Create `.dockerignore`**

```
node_modules
.git
.env
test
*.md
coverage
```

- [ ] **Step 5: Create `.env.example`**

```
# Auth
ADMIN_PASSWORD_HASH=
SESSION_SECRET=change-me-to-a-long-random-string

# Minecraft target
MC_CONTAINER_NAME=craftdock-mc-server
MC_DATA_PATH=/minecraft/data
MC_EDITION=auto            # auto | java | bedrock
MC_WORLD_NAME=world        # world folder name inside MC_DATA_PATH

# RCON (Java)
RCON_HOST=craftdock-mc-server
RCON_PORT=25575
RCON_PASSWORD=

# Map tab (optional)
MAP_URL=

# App
PORT=3000
NODE_ENV=production
MAX_UPLOAD_MB=1024
```

- [ ] **Step 6: Install and verify**

Run: `npm install && npx vitest run --passWithNoTests`
Expected: install succeeds; Vitest reports "no test files found" and exits 0.

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.js .gitignore .dockerignore .env.example package-lock.json
git commit -m "chore: scaffold project with vitest and dependencies"
```

---

### Task 0.2: Config loader

**Files:**
- Create: `src/config.js`
- Test: `test/config.test.js`

**Interfaces:**
- Produces: `loadConfig(env)` → validated config object with keys `adminPasswordHash, sessionSecret, mcContainerName, mcDataPath, mcEdition, mcWorldName, rconHost, rconPort, rconPassword, mapUrl, port, nodeEnv, maxUploadBytes`. Throws `Error` listing missing required vars.

- [ ] **Step 1: Write the failing test**

```js
// test/config.test.js
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = {
  ADMIN_PASSWORD_HASH: 'hash',
  SESSION_SECRET: 'secret',
  RCON_PASSWORD: 'rp',
};

describe('loadConfig', () => {
  it('applies defaults for optional vars', () => {
    const c = loadConfig(base);
    expect(c.mcContainerName).toBe('craftdock-mc-server');
    expect(c.rconPort).toBe(25575);
    expect(c.port).toBe(3000);
    expect(c.mcEdition).toBe('auto');
    expect(c.maxUploadBytes).toBe(1024 * 1024 * 1024);
  });

  it('throws when required vars are missing', () => {
    expect(() => loadConfig({})).toThrow(/ADMIN_PASSWORD_HASH/);
  });

  it('coerces numeric env vars', () => {
    const c = loadConfig({ ...base, RCON_PORT: '25580', PORT: '8080' });
    expect(c.rconPort).toBe(25580);
    expect(c.port).toBe(8080);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/config.test.js`
Expected: FAIL — cannot import `loadConfig` / module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/config.js
const REQUIRED = ['ADMIN_PASSWORD_HASH', 'SESSION_SECRET', 'RCON_PASSWORD'];

export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  const num = (v, d) => (v == null ? d : Number(v));
  return {
    adminPasswordHash: env.ADMIN_PASSWORD_HASH,
    sessionSecret: env.SESSION_SECRET,
    mcContainerName: env.MC_CONTAINER_NAME || 'craftdock-mc-server',
    mcDataPath: env.MC_DATA_PATH || '/minecraft/data',
    mcEdition: env.MC_EDITION || 'auto',
    mcWorldName: env.MC_WORLD_NAME || 'world',
    rconHost: env.RCON_HOST || 'craftdock-mc-server',
    rconPort: num(env.RCON_PORT, 25575),
    rconPassword: env.RCON_PASSWORD,
    mapUrl: env.MAP_URL || '',
    port: num(env.PORT, 3000),
    nodeEnv: env.NODE_ENV || 'development',
    maxUploadBytes: num(env.MAX_UPLOAD_MB, 1024) * 1024 * 1024,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/config.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config.js test/config.test.js
git commit -m "feat: add validated config loader"
```

---

### Task 0.3: Password hashing utility

**Files:**
- Create: `scripts/hash-password.js`

**Interfaces:**
- Produces: CLI `npm run hash -- <password>` prints a bcrypt hash to stdout.

- [ ] **Step 1: Implement the script**

```js
// scripts/hash-password.js
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash -- <password>');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
process.stdout.write(hash + '\n');
```

- [ ] **Step 2: Verify manually**

Run: `npm run hash -- testpass`
Expected: prints a `$2a$12$...` bcrypt string.

- [ ] **Step 3: Commit**

```bash
git add scripts/hash-password.js
git commit -m "feat: add password hashing CLI script"
```

---

# PHASE 1 — Authentication

### Task 1.1: authService

**Files:**
- Create: `src/services/authService.js`
- Test: `test/services/authService.test.js`

**Interfaces:**
- Consumes: config `{ adminPasswordHash }`.
- Produces: `createAuthService(config)` → `{ verifyPassword(plain): Promise<boolean> }`.

- [ ] **Step 1: Write the failing test**

```js
// test/services/authService.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { createAuthService } from '../../src/services/authService.js';

describe('authService', () => {
  let svc;
  beforeAll(() => {
    const hash = bcrypt.hashSync('correct', 12);
    svc = createAuthService({ adminPasswordHash: hash });
  });

  it('accepts the correct password', async () => {
    expect(await svc.verifyPassword('correct')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    expect(await svc.verifyPassword('wrong')).toBe(false);
  });

  it('rejects empty input without throwing', async () => {
    expect(await svc.verifyPassword('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/authService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/services/authService.js
import bcrypt from 'bcryptjs';

export function createAuthService(config) {
  return {
    async verifyPassword(plain) {
      if (!plain) return false;
      return bcrypt.compare(plain, config.adminPasswordHash);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/authService.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/authService.js test/services/authService.test.js
git commit -m "feat: add auth service with bcrypt password verification"
```

---

### Task 1.2: Auth middleware

**Files:**
- Create: `src/middleware/auth.js`
- Test: `test/middleware/auth.test.js`

**Interfaces:**
- Produces:
  - `requireAuth(req, res, next)` → `next()` if `req.session.authed === true`, else `401 { error: 'unauthorized' }`.
  - `socketAuth(sessionMiddleware)` → returns a Socket.io middleware `(socket, next)` that runs the express-session middleware over `socket.request` and calls `next(new Error('unauthorized'))` when `authed !== true`.

- [ ] **Step 1: Write the failing test**

```js
// test/middleware/auth.test.js
import { describe, it, expect, vi } from 'vitest';
import { requireAuth } from '../../src/middleware/auth.js';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('requireAuth', () => {
  it('calls next when session is authed', () => {
    const next = vi.fn();
    requireAuth({ session: { authed: true } }, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 when not authed', () => {
    const next = vi.fn();
    const res = mockRes();
    requireAuth({ session: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/middleware/auth.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/middleware/auth.js
export function requireAuth(req, res, next) {
  if (req.session && req.session.authed === true) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

export function socketAuth(sessionMiddleware) {
  return (socket, next) => {
    sessionMiddleware(socket.request, {}, () => {
      if (socket.request.session && socket.request.session.authed === true) {
        return next();
      }
      next(new Error('unauthorized'));
    });
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/middleware/auth.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/middleware/auth.js test/middleware/auth.test.js
git commit -m "feat: add auth middleware for HTTP and socket handshake"
```

---

### Task 1.3: Auth routes

**Files:**
- Create: `src/routes/auth.js`
- Test: `test/routes/auth.test.js`

**Interfaces:**
- Consumes: `authService.verifyPassword`.
- Produces: `createAuthRouter(authService)` → Express router with:
  - `POST /login` `{ password }` → sets `req.session.authed = true`, `200 { ok: true }`; wrong → `401 { error: 'invalid credentials' }`.
  - `POST /logout` → destroys session, `200 { ok: true }`.
  - `GET /me` → `200 { authed: boolean }`.

- [ ] **Step 1: Write the failing test**

```js
// test/routes/auth.test.js
import { describe, it, expect } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { createAuthRouter } from '../../src/routes/auth.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  const authService = { verifyPassword: async (p) => p === 'right' };
  app.use('/api/auth', createAuthRouter(authService));
  return app;
}

describe('auth routes', () => {
  it('logs in with correct password and reports authed', async () => {
    const agent = request.agent(makeApp());
    const login = await agent.post('/api/auth/login').send({ password: 'right' });
    expect(login.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.body).toEqual({ authed: true });
  });

  it('rejects wrong password', async () => {
    const res = await request(makeApp()).post('/api/auth/login').send({ password: 'no' });
    expect(res.status).toBe(401);
  });

  it('logs out', async () => {
    const agent = request.agent(makeApp());
    await agent.post('/api/auth/login').send({ password: 'right' });
    await agent.post('/api/auth/logout');
    const me = await agent.get('/api/auth/me');
    expect(me.body).toEqual({ authed: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/routes/auth.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/routes/auth.js
import { Router } from 'express';

export function createAuthRouter(authService) {
  const router = Router();

  router.post('/login', async (req, res) => {
    const ok = await authService.verifyPassword(req.body?.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    req.session.authed = true;
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/me', (req, res) => {
    res.json({ authed: req.session?.authed === true });
  });

  return router;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/routes/auth.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth.js test/routes/auth.test.js
git commit -m "feat: add auth routes (login/logout/me)"
```

---

# PHASE 2 — Docker Service

### Task 2.1: dockerService — lifecycle + inspect

**Files:**
- Create: `src/services/dockerService.js`
- Test: `test/services/dockerService.test.js`

**Interfaces:**
- Consumes: config `{ mcContainerName }`; an injected `docker` (Dockerode instance) for testability.
- Produces: `createDockerService(config, docker)` → `{ getContainer(), start(), stop(), restart(), kill(), inspect(), getState() }`.
  - `inspect()` → `{ found: boolean, state: 'running'|'exited'|'not_found'|..., type: string|null }` where `type` is the `TYPE` env var parsed from the container config.
  - Lifecycle methods resolve the container by name; when missing they throw `ContainerNotFoundError`.

- [ ] **Step 1: Write the failing test**

```js
// test/services/dockerService.test.js
import { describe, it, expect, vi } from 'vitest';
import { createDockerService, ContainerNotFoundError } from '../../src/services/dockerService.js';

function mockDocker({ inspectData, exists = true } = {}) {
  const container = {
    start: vi.fn().mockResolvedValue(),
    stop: vi.fn().mockResolvedValue(),
    restart: vi.fn().mockResolvedValue(),
    kill: vi.fn().mockResolvedValue(),
    inspect: vi.fn().mockResolvedValue(inspectData),
  };
  return {
    _container: container,
    listContainers: vi.fn().mockResolvedValue(
      exists ? [{ Names: ['/craftdock-mc-server'], Id: 'abc' }] : []
    ),
    getContainer: vi.fn().mockReturnValue(container),
  };
}

const config = { mcContainerName: 'craftdock-mc-server' };

describe('dockerService', () => {
  it('inspect returns state and parsed TYPE', async () => {
    const docker = mockDocker({
      inspectData: {
        State: { Status: 'running' },
        Config: { Env: ['EULA=TRUE', 'TYPE=PAPER'] },
      },
    });
    const svc = createDockerService(config, docker);
    const info = await svc.inspect();
    expect(info).toMatchObject({ found: true, state: 'running', type: 'PAPER' });
  });

  it('inspect reports not_found when container is absent', async () => {
    const svc = createDockerService(config, mockDocker({ exists: false }));
    const info = await svc.inspect();
    expect(info).toEqual({ found: false, state: 'not_found', type: null });
  });

  it('start delegates to the resolved container', async () => {
    const docker = mockDocker({ inspectData: { State: {}, Config: { Env: [] } } });
    const svc = createDockerService(config, docker);
    await svc.start();
    expect(docker._container.start).toHaveBeenCalledOnce();
  });

  it('start throws ContainerNotFoundError when absent', async () => {
    const svc = createDockerService(config, mockDocker({ exists: false }));
    await expect(svc.start()).rejects.toBeInstanceOf(ContainerNotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/dockerService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/services/dockerService.js
export class ContainerNotFoundError extends Error {
  constructor(name) {
    super(`Container not found: ${name}`);
    this.name = 'ContainerNotFoundError';
  }
}

function parseType(env = []) {
  const entry = env.find((e) => e.startsWith('TYPE='));
  return entry ? entry.slice('TYPE='.length) : null;
}

export function createDockerService(config, docker) {
  const name = config.mcContainerName;

  async function resolve() {
    const list = await docker.listContainers({ all: true });
    const match = list.find((c) => c.Names?.some((n) => n === `/${name}` || n === name));
    if (!match) throw new ContainerNotFoundError(name);
    return docker.getContainer(match.Id);
  }

  async function lifecycle(method) {
    const container = await resolve();
    await container[method]();
  }

  return {
    async getContainer() { return resolve(); },
    start: () => lifecycle('start'),
    stop: () => lifecycle('stop'),
    restart: () => lifecycle('restart'),
    kill: () => lifecycle('kill'),

    async inspect() {
      let container;
      try {
        container = await resolve();
      } catch (err) {
        if (err instanceof ContainerNotFoundError) {
          return { found: false, state: 'not_found', type: null };
        }
        throw err;
      }
      const data = await container.inspect();
      return {
        found: true,
        state: data.State?.Status || 'unknown',
        type: parseType(data.Config?.Env),
      };
    },

    async getState() {
      return (await this.inspect()).state;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/dockerService.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/dockerService.js test/services/dockerService.test.js
git commit -m "feat: add docker service lifecycle and inspect"
```

---

### Task 2.2: dockerService — stats (CPU/memory)

**Files:**
- Modify: `src/services/dockerService.js`
- Test: `test/services/dockerServiceStats.test.js`

**Interfaces:**
- Produces: `stats()` → `{ cpuPct: number, memUsedMb: number, memPct: number }` computed from Docker's stats delta formula. Returns zeros when container not running.

- [ ] **Step 1: Write the failing test**

```js
// test/services/dockerServiceStats.test.js
import { describe, it, expect, vi } from 'vitest';
import { createDockerService } from '../../src/services/dockerService.js';

const statsSample = {
  cpu_stats: {
    cpu_usage: { total_usage: 2000000000 },
    system_cpu_usage: 20000000000,
    online_cpus: 2,
  },
  precpu_stats: {
    cpu_usage: { total_usage: 1000000000 },
    system_cpu_usage: 10000000000,
  },
  memory_stats: { usage: 536870912, limit: 1073741824 }, // 512MB / 1GB
};

function mockDocker() {
  const container = {
    inspect: vi.fn().mockResolvedValue({ State: { Status: 'running' }, Config: { Env: [] } }),
    stats: vi.fn().mockResolvedValue(statsSample),
  };
  return {
    listContainers: vi.fn().mockResolvedValue([{ Names: ['/mc'], Id: 'x' }]),
    getContainer: vi.fn().mockReturnValue(container),
  };
}

describe('dockerService.stats', () => {
  it('computes cpu and memory percentages', async () => {
    const svc = createDockerService({ mcContainerName: 'mc' }, mockDocker());
    const s = await svc.stats();
    // cpuDelta=1e9, sysDelta=1e10 -> 0.1 * 2 cpus * 100 = 20%
    expect(s.cpuPct).toBeCloseTo(20, 1);
    expect(s.memUsedMb).toBeCloseTo(512, 0);
    expect(s.memPct).toBeCloseTo(50, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/dockerServiceStats.test.js`
Expected: FAIL — `svc.stats is not a function`.

- [ ] **Step 3: Add stats to the service**

Add this method inside the returned object of `createDockerService` (after `getState`):

```js
    async stats() {
      let container;
      try {
        container = await resolve();
      } catch {
        return { cpuPct: 0, memUsedMb: 0, memPct: 0 };
      }
      const s = await container.stats({ stream: false });
      const cpuDelta =
        s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage;
      const sysDelta =
        s.cpu_stats.system_cpu_usage - s.precpu_stats.system_cpu_usage;
      const cpus = s.cpu_stats.online_cpus || 1;
      const cpuPct = sysDelta > 0 ? (cpuDelta / sysDelta) * cpus * 100 : 0;
      const memUsed = s.memory_stats.usage || 0;
      const memLimit = s.memory_stats.limit || 1;
      return {
        cpuPct: Math.round(cpuPct * 10) / 10,
        memUsedMb: Math.round(memUsed / (1024 * 1024)),
        memPct: Math.round((memUsed / memLimit) * 1000) / 10,
      };
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/dockerServiceStats.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/services/dockerService.js test/services/dockerServiceStats.test.js
git commit -m "feat: add container cpu/memory stats"
```

---

### Task 2.3: dockerService — log stream + attach

**Files:**
- Modify: `src/services/dockerService.js`
- Test: `test/services/dockerServiceStreams.test.js`

**Interfaces:**
- Produces:
  - `logStream()` → resolves to a readable stream from `container.logs({ follow: true, stdout: true, stderr: true, tail: 200 })`.
  - `attach()` → resolves to a duplex stream from `container.attach({ stream: true, stdin: true, stdout: true, stderr: true })` (used by stdinService for Bedrock).

- [ ] **Step 1: Write the failing test**

```js
// test/services/dockerServiceStreams.test.js
import { describe, it, expect, vi } from 'vitest';
import { createDockerService } from '../../src/services/dockerService.js';

function mockDocker() {
  const container = {
    inspect: vi.fn().mockResolvedValue({ State: {}, Config: { Env: [] } }),
    logs: vi.fn().mockResolvedValue('LOGSTREAM'),
    attach: vi.fn().mockResolvedValue('ATTACHSTREAM'),
  };
  return {
    _container: container,
    listContainers: vi.fn().mockResolvedValue([{ Names: ['/mc'], Id: 'x' }]),
    getContainer: vi.fn().mockReturnValue(container),
  };
}

describe('dockerService streams', () => {
  it('logStream requests a following log stream with tail', async () => {
    const docker = mockDocker();
    const svc = createDockerService({ mcContainerName: 'mc' }, docker);
    const stream = await svc.logStream();
    expect(stream).toBe('LOGSTREAM');
    expect(docker._container.logs).toHaveBeenCalledWith(
      expect.objectContaining({ follow: true, stdout: true, stderr: true })
    );
  });

  it('attach requests a duplex stream with stdin', async () => {
    const docker = mockDocker();
    const svc = createDockerService({ mcContainerName: 'mc' }, docker);
    const stream = await svc.attach();
    expect(stream).toBe('ATTACHSTREAM');
    expect(docker._container.attach).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true, stdin: true })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/dockerServiceStreams.test.js`
Expected: FAIL — `svc.logStream is not a function`.

- [ ] **Step 3: Add stream methods to the service**

Add inside the returned object:

```js
    async logStream(tail = 200) {
      const container = await resolve();
      return container.logs({ follow: true, stdout: true, stderr: true, tail });
    },

    async attach() {
      const container = await resolve();
      return container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/dockerServiceStreams.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/dockerService.js test/services/dockerServiceStreams.test.js
git commit -m "feat: add log stream and attach helpers"
```

---

# PHASE 3 — Command Channels & Adapters

### Task 3.1: rconService

**Files:**
- Create: `src/services/rconService.js`
- Test: `test/services/rconService.test.js`

**Interfaces:**
- Consumes: config `{ rconHost, rconPort, rconPassword }`; injected `RconClass` (defaults to `rcon-client`'s `Rcon`) for testability.
- Produces: `createRconService(config, RconClass)` → `{ send(cmd): Promise<string>, close() }`. Lazily connects; on connection error throws `RconUnavailableError`; reconnects on next `send` after a failure.

- [ ] **Step 1: Write the failing test**

```js
// test/services/rconService.test.js
import { describe, it, expect, vi } from 'vitest';
import { createRconService, RconUnavailableError } from '../../src/services/rconService.js';

function fakeRconClass({ failConnect = false } = {}) {
  return class {
    static async connect() {
      if (failConnect) throw new Error('ECONNREFUSED');
      return {
        send: vi.fn().mockResolvedValue('command output'),
        end: vi.fn().mockResolvedValue(),
        on: vi.fn(),
      };
    }
  };
}

const config = { rconHost: 'h', rconPort: 25575, rconPassword: 'p' };

describe('rconService', () => {
  it('connects lazily and sends a command', async () => {
    const svc = createRconService(config, fakeRconClass());
    const out = await svc.send('list');
    expect(out).toBe('command output');
  });

  it('throws RconUnavailableError when connect fails', async () => {
    const svc = createRconService(config, fakeRconClass({ failConnect: true }));
    await expect(svc.send('list')).rejects.toBeInstanceOf(RconUnavailableError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/rconService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/services/rconService.js
import { Rcon } from 'rcon-client';

export class RconUnavailableError extends Error {
  constructor(cause) {
    super(`RCON unavailable: ${cause?.message || cause}`);
    this.name = 'RconUnavailableError';
  }
}

export function createRconService(config, RconClass = Rcon) {
  let conn = null;

  async function ensure() {
    if (conn) return conn;
    try {
      conn = await RconClass.connect({
        host: config.rconHost,
        port: config.rconPort,
        password: config.rconPassword,
      });
      conn.on?.('error', () => { conn = null; });
      conn.on?.('end', () => { conn = null; });
      return conn;
    } catch (err) {
      conn = null;
      throw new RconUnavailableError(err);
    }
  }

  return {
    async send(cmd) {
      const c = await ensure();
      try {
        return await c.send(cmd);
      } catch (err) {
        conn = null;
        throw new RconUnavailableError(err);
      }
    },
    async close() {
      if (conn) { await conn.end?.(); conn = null; }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/rconService.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/rconService.js test/services/rconService.test.js
git commit -m "feat: add rcon service with lazy connect and reconnect"
```

---

### Task 3.2: stdinService (Bedrock command channel)

**Files:**
- Create: `src/services/stdinService.js`
- Test: `test/services/stdinService.test.js`

**Interfaces:**
- Consumes: `dockerService.attach()`.
- Produces: `createStdinService(dockerService)` → `{ send(cmd): Promise<string> }`. Writes `cmd + '\n'` to the attach stream's stdin, collects stdout for a short window (~300ms), returns captured text (best-effort — documented as such).

- [ ] **Step 1: Write the failing test**

```js
// test/services/stdinService.test.js
import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { createStdinService } from '../../src/services/stdinService.js';

describe('stdinService', () => {
  it('writes command with newline and captures output window', async () => {
    const stream = new PassThrough();
    const dockerService = { attach: vi.fn().mockResolvedValue(stream) };
    const svc = createStdinService(dockerService, { windowMs: 20 });

    const p = svc.send('list');
    // simulate server echoing output
    setTimeout(() => stream.write('There are 2 players online\n'), 5);
    const out = await p;

    expect(out).toContain('2 players online');
  });

  it('appends a newline to the written command', async () => {
    const stream = new PassThrough();
    const written = [];
    stream.write = (chunk) => { written.push(chunk.toString()); return true; };
    const dockerService = { attach: vi.fn().mockResolvedValue(stream) };
    const svc = createStdinService(dockerService, { windowMs: 5 });
    await svc.send('op steve');
    expect(written[0]).toBe('op steve\n');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/stdinService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/services/stdinService.js
export function createStdinService(dockerService, { windowMs = 300 } = {}) {
  let stream = null;

  async function ensure() {
    if (stream && !stream.destroyed) return stream;
    stream = await dockerService.attach();
    return stream;
  }

  return {
    async send(cmd) {
      const s = await ensure();
      return new Promise((resolve) => {
        let buf = '';
        const onData = (chunk) => { buf += chunk.toString(); };
        s.on('data', onData);
        s.write(cmd + '\n');
        setTimeout(() => {
          s.off('data', onData);
          resolve(buf.trim());
        }, windowMs);
      });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/stdinService.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/stdinService.js test/services/stdinService.test.js
git commit -m "feat: add bedrock stdin command channel"
```

---

### Task 3.3: ServerAdapter base + player-list parsing

**Files:**
- Create: `src/adapters/serverAdapter.js`
- Test: `test/adapters/serverAdapter.test.js`

**Interfaces:**
- Produces:
  - `class NotSupportedError extends Error`.
  - `parsePlayerList(text)` → `{ online: number, max: number, players: string[] }`. Handles Java (`There are 2 of a max of 20 players online: steve, alex`) and Bedrock (`There are 2/20 players online:\nsteve, alex`).
  - `CAPABILITIES` constant: `{ JAVA: Set, BEDROCK: Set }` listing supported action names per edition.

- [ ] **Step 1: Write the failing test**

```js
// test/adapters/serverAdapter.test.js
import { describe, it, expect } from 'vitest';
import { parsePlayerList, CAPABILITIES } from '../../src/adapters/serverAdapter.js';

describe('parsePlayerList', () => {
  it('parses Java list output', () => {
    const r = parsePlayerList(
      'There are 2 of a max of 20 players online: steve, alex'
    );
    expect(r).toEqual({ online: 2, max: 20, players: ['steve', 'alex'] });
  });

  it('parses Bedrock list output', () => {
    const r = parsePlayerList('There are 1/10 players online:\nnotch');
    expect(r).toEqual({ online: 1, max: 10, players: ['notch'] });
  });

  it('handles empty server', () => {
    const r = parsePlayerList('There are 0 of a max of 20 players online:');
    expect(r).toEqual({ online: 0, max: 20, players: [] });
  });
});

describe('CAPABILITIES', () => {
  it('java supports ban, bedrock does not', () => {
    expect(CAPABILITIES.JAVA.has('ban')).toBe(true);
    expect(CAPABILITIES.BEDROCK.has('ban')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/adapters/serverAdapter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/adapters/serverAdapter.js
export class NotSupportedError extends Error {
  constructor(action) {
    super(`Action not supported on this edition: ${action}`);
    this.name = 'NotSupportedError';
  }
}

const COMMON = ['listPlayers', 'whitelistAdd', 'whitelistRemove', 'op', 'deop', 'kick', 'give', 'gamemode', 'teleport', 'sendCommand'];

export const CAPABILITIES = {
  JAVA: new Set([...COMMON, 'ban', 'pardon']),
  BEDROCK: new Set([...COMMON]),
};

export function parsePlayerList(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  // Java: "There are 2 of a max of 20 players online: a, b"
  let m = clean.match(/There are (\d+) of a max of (\d+) players online:?\s*(.*)$/i);
  // Bedrock: "There are 2/20 players online: a, b"
  if (!m) m = clean.match(/There are (\d+)\/(\d+) players online:?\s*(.*)$/i);
  if (!m) return { online: 0, max: 0, players: [] };
  const online = Number(m[1]);
  const max = Number(m[2]);
  const players = (m[3] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { online, max, players };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/adapters/serverAdapter.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/serverAdapter.js test/adapters/serverAdapter.test.js
git commit -m "feat: add adapter base, player-list parser, capabilities"
```

---

### Task 3.4: JavaAdapter

**Files:**
- Create: `src/adapters/javaAdapter.js`
- Test: `test/adapters/javaAdapter.test.js`

**Interfaces:**
- Consumes: `rconService.send`; `parsePlayerList`, `CAPABILITIES` from serverAdapter.
- Produces: `createJavaAdapter(rconService)` → object implementing all actions from the interface. `capabilities` getter returns `CAPABILITIES.JAVA`. `listPlayers()` returns parsed object.

- [ ] **Step 1: Write the failing test**

```js
// test/adapters/javaAdapter.test.js
import { describe, it, expect, vi } from 'vitest';
import { createJavaAdapter } from '../../src/adapters/javaAdapter.js';

function make(sendImpl) {
  const rcon = { send: vi.fn(sendImpl || (async () => 'ok')) };
  return { rcon, adapter: createJavaAdapter(rcon) };
}

describe('JavaAdapter', () => {
  it('whitelistAdd issues "whitelist add"', async () => {
    const { rcon, adapter } = make();
    await adapter.whitelistAdd('steve');
    expect(rcon.send).toHaveBeenCalledWith('whitelist add steve');
  });

  it('ban issues "ban" with reason', async () => {
    const { rcon, adapter } = make();
    await adapter.ban('griefer', 'no griefing');
    expect(rcon.send).toHaveBeenCalledWith('ban griefer no griefing');
  });

  it('give issues "give" with item and count', async () => {
    const { rcon, adapter } = make();
    await adapter.give('steve', 'minecraft:diamond', 5);
    expect(rcon.send).toHaveBeenCalledWith('give steve minecraft:diamond 5');
  });

  it('listPlayers parses rcon output', async () => {
    const { adapter } = make(async () => 'There are 1 of a max of 20 players online: steve');
    expect(await adapter.listPlayers()).toEqual({ online: 1, max: 20, players: ['steve'] });
  });

  it('exposes JAVA capabilities', () => {
    const { adapter } = make();
    expect(adapter.capabilities.has('ban')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/adapters/javaAdapter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/adapters/javaAdapter.js
import { parsePlayerList, CAPABILITIES } from './serverAdapter.js';

export function createJavaAdapter(rconService) {
  const send = (cmd) => rconService.send(cmd);
  return {
    get capabilities() { return CAPABILITIES.JAVA; },
    sendCommand: (raw) => send(raw),
    async listPlayers() { return parsePlayerList(await send('list')); },
    whitelistAdd: (n) => send(`whitelist add ${n}`),
    whitelistRemove: (n) => send(`whitelist remove ${n}`),
    ban: (n, reason = '') => send(`ban ${n} ${reason}`.trim()),
    pardon: (n) => send(`pardon ${n}`),
    op: (n) => send(`op ${n}`),
    deop: (n) => send(`deop ${n}`),
    kick: (n, reason = '') => send(`kick ${n} ${reason}`.trim()),
    give: (n, item, count = 1) => send(`give ${n} ${item} ${count}`),
    gamemode: (n, mode) => send(`gamemode ${mode} ${n}`),
    teleport: (n, target) => send(`tp ${n} ${target}`),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/adapters/javaAdapter.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/javaAdapter.js test/adapters/javaAdapter.test.js
git commit -m "feat: add java adapter (rcon command mapping)"
```

---

### Task 3.5: BedrockAdapter

**Files:**
- Create: `src/adapters/bedrockAdapter.js`
- Test: `test/adapters/bedrockAdapter.test.js`

**Interfaces:**
- Consumes: `stdinService.send`; `parsePlayerList`, `CAPABILITIES`, `NotSupportedError`.
- Produces: `createBedrockAdapter(stdinService)` → object; `whitelistAdd/Remove` map to `allowlist add/remove`; `ban`/`pardon` throw `NotSupportedError`; `capabilities` returns `CAPABILITIES.BEDROCK`.

- [ ] **Step 1: Write the failing test**

```js
// test/adapters/bedrockAdapter.test.js
import { describe, it, expect, vi } from 'vitest';
import { createBedrockAdapter } from '../../src/adapters/bedrockAdapter.js';
import { NotSupportedError } from '../../src/adapters/serverAdapter.js';

function make(sendImpl) {
  const stdin = { send: vi.fn(sendImpl || (async () => 'ok')) };
  return { stdin, adapter: createBedrockAdapter(stdin) };
}

describe('BedrockAdapter', () => {
  it('whitelistAdd maps to "allowlist add"', async () => {
    const { stdin, adapter } = make();
    await adapter.whitelistAdd('steve');
    expect(stdin.send).toHaveBeenCalledWith('allowlist add steve');
  });

  it('ban throws NotSupportedError', async () => {
    const { adapter } = make();
    await expect(adapter.ban('x')).rejects.toBeInstanceOf(NotSupportedError);
  });

  it('does not advertise ban capability', () => {
    const { adapter } = make();
    expect(adapter.capabilities.has('ban')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/adapters/bedrockAdapter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/adapters/bedrockAdapter.js
import { parsePlayerList, CAPABILITIES, NotSupportedError } from './serverAdapter.js';

export function createBedrockAdapter(stdinService) {
  const send = (cmd) => stdinService.send(cmd);
  return {
    get capabilities() { return CAPABILITIES.BEDROCK; },
    sendCommand: (raw) => send(raw),
    async listPlayers() { return parsePlayerList(await send('list')); },
    whitelistAdd: (n) => send(`allowlist add ${n}`),
    whitelistRemove: (n) => send(`allowlist remove ${n}`),
    ban() { throw new NotSupportedError('ban'); },
    pardon() { throw new NotSupportedError('pardon'); },
    op: (n) => send(`op ${n}`),
    deop: (n) => send(`deop ${n}`),
    kick: (n, reason = '') => send(`kick ${n} ${reason}`.trim()),
    give: (n, item, count = 1) => send(`give ${n} ${item} ${count}`),
    gamemode: (n, mode) => send(`gamemode ${mode} ${n}`),
    teleport: (n, target) => send(`tp ${n} ${target}`),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/adapters/bedrockAdapter.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/bedrockAdapter.js test/adapters/bedrockAdapter.test.js
git commit -m "feat: add bedrock adapter (stdin command mapping)"
```

---

### Task 3.6: Adapter factory

**Files:**
- Create: `src/adapters/index.js`
- Test: `test/adapters/index.test.js`

**Interfaces:**
- Consumes: `createJavaAdapter`, `createBedrockAdapter`.
- Produces: `isBedrock(type)` → boolean (true when type is `BEDROCK`, case-insensitive); `createAdapter(type, { rconService, stdinService })` → Java or Bedrock adapter.

- [ ] **Step 1: Write the failing test**

```js
// test/adapters/index.test.js
import { describe, it, expect } from 'vitest';
import { createAdapter, isBedrock } from '../../src/adapters/index.js';

const deps = {
  rconService: { send: async () => 'r' },
  stdinService: { send: async () => 's' },
};

describe('adapter factory', () => {
  it('isBedrock detects BEDROCK type case-insensitively', () => {
    expect(isBedrock('BEDROCK')).toBe(true);
    expect(isBedrock('bedrock')).toBe(true);
    expect(isBedrock('PAPER')).toBe(false);
    expect(isBedrock(null)).toBe(false);
  });

  it('creates a java adapter for PAPER', () => {
    const a = createAdapter('PAPER', deps);
    expect(a.capabilities.has('ban')).toBe(true);
  });

  it('creates a bedrock adapter for BEDROCK', () => {
    const a = createAdapter('BEDROCK', deps);
    expect(a.capabilities.has('ban')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/adapters/index.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/adapters/index.js
import { createJavaAdapter } from './javaAdapter.js';
import { createBedrockAdapter } from './bedrockAdapter.js';

export function isBedrock(type) {
  return typeof type === 'string' && type.toUpperCase() === 'BEDROCK';
}

export function createAdapter(type, { rconService, stdinService }) {
  return isBedrock(type)
    ? createBedrockAdapter(stdinService)
    : createJavaAdapter(rconService);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/adapters/index.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/index.js test/adapters/index.test.js
git commit -m "feat: add adapter factory with edition detection"
```

---

# PHASE 4 — App State & Server Composition

### Task 4.1: appState (shared singletons + adapter resolution)

**Files:**
- Create: `src/appState.js`
- Test: `test/appState.test.js`

**Interfaces:**
- Produces: `createAppState({ config, dockerService, rconService, stdinService })` → `{ getAdapter(): Promise<adapter>, getEdition(): Promise<'java'|'bedrock'> }`. `getAdapter()` inspects the container `TYPE` (unless `config.mcEdition` forces java/bedrock) and returns the matching adapter, caching it.

- [ ] **Step 1: Write the failing test**

```js
// test/appState.test.js
import { describe, it, expect, vi } from 'vitest';
import { createAppState } from '../src/appState.js';

const deps = () => ({
  config: { mcEdition: 'auto' },
  dockerService: { inspect: vi.fn().mockResolvedValue({ type: 'PAPER' }) },
  rconService: { send: async () => 'r' },
  stdinService: { send: async () => 's' },
});

describe('appState', () => {
  it('resolves a java adapter when TYPE is PAPER', async () => {
    const state = createAppState(deps());
    const a = await state.getAdapter();
    expect(a.capabilities.has('ban')).toBe(true);
  });

  it('honors forced bedrock edition without inspecting', async () => {
    const d = deps();
    d.config.mcEdition = 'bedrock';
    const state = createAppState(d);
    const a = await state.getAdapter();
    expect(a.capabilities.has('ban')).toBe(false);
    expect(d.dockerService.inspect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/appState.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/appState.js
import { createAdapter, isBedrock } from './adapters/index.js';

export function createAppState({ config, dockerService, rconService, stdinService }) {
  let cached = null;

  async function resolveType() {
    if (config.mcEdition === 'bedrock') return 'BEDROCK';
    if (config.mcEdition === 'java') return 'PAPER';
    const info = await dockerService.inspect();
    return info.type || 'PAPER';
  }

  return {
    async getAdapter() {
      if (cached) return cached;
      const type = await resolveType();
      cached = createAdapter(type, { rconService, stdinService });
      cached._edition = isBedrock(type) ? 'bedrock' : 'java';
      return cached;
    },
    async getEdition() {
      return (await this.getAdapter())._edition;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/appState.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/appState.js test/appState.test.js
git commit -m "feat: add app state with cached adapter resolution"
```

---

# PHASE 5 — Status & Players Routes

### Task 5.1: Status routes

**Files:**
- Create: `src/routes/status.js`
- Test: `test/routes/status.test.js`

**Interfaces:**
- Consumes: `dockerService.{start,stop,restart,kill,inspect,stats}`, `appState.getEdition`, adapter `listPlayers`.
- Produces: `createStatusRouter({ dockerService, appState })`:
  - `GET /` → `{ state, type, edition, cpuPct, memUsedMb, memPct, players: {online,max,players} }`.
  - `POST /start|/stop|/restart|/kill` → `{ ok: true }`; `ContainerNotFoundError` → `404 { error: 'not_found' }`.

- [ ] **Step 1: Write the failing test**

```js
// test/routes/status.test.js
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createStatusRouter } from '../../src/routes/status.js';
import { ContainerNotFoundError } from '../../src/services/dockerService.js';

function makeApp(overrides = {}) {
  const dockerService = {
    inspect: vi.fn().mockResolvedValue({ state: 'running', type: 'PAPER' }),
    stats: vi.fn().mockResolvedValue({ cpuPct: 10, memUsedMb: 512, memPct: 50 }),
    start: vi.fn().mockResolvedValue(),
    stop: vi.fn().mockResolvedValue(),
    restart: vi.fn().mockResolvedValue(),
    kill: vi.fn().mockResolvedValue(),
    ...overrides.dockerService,
  };
  const adapter = { listPlayers: vi.fn().mockResolvedValue({ online: 1, max: 20, players: ['a'] }) };
  const appState = {
    getEdition: vi.fn().mockResolvedValue('java'),
    getAdapter: vi.fn().mockResolvedValue(adapter),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/status', createStatusRouter({ dockerService, appState }));
  return { app, dockerService };
}

describe('status routes', () => {
  it('GET / returns aggregated status', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      state: 'running', edition: 'java', cpuPct: 10, memPct: 50,
      players: { online: 1, max: 20, players: ['a'] },
    });
  });

  it('POST /start delegates to dockerService', async () => {
    const { app, dockerService } = makeApp();
    const res = await request(app).post('/api/status/start');
    expect(res.body).toEqual({ ok: true });
    expect(dockerService.start).toHaveBeenCalled();
  });

  it('POST /start returns 404 when container missing', async () => {
    const { app } = makeApp({
      dockerService: { start: vi.fn().mockRejectedValue(new ContainerNotFoundError('mc')) },
    });
    const res = await request(app).post('/api/status/start');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/routes/status.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/routes/status.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/routes/status.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/routes/status.js test/routes/status.test.js
git commit -m "feat: add status routes (lifecycle + aggregated status)"
```

---

### Task 5.2: Players routes

**Files:**
- Create: `src/routes/players.js`
- Test: `test/routes/players.test.js`

**Interfaces:**
- Consumes: `appState.getAdapter`; adapter action methods; `NotSupportedError`.
- Produces: `createPlayersRouter({ appState })`:
  - `GET /` → `{ players, capabilities: string[] }`.
  - `POST /:action` with body params → delegates to `adapter[action](...)`, returns `{ ok: true, output }`.
  - `NotSupportedError` → `409 { error: 'not_supported' }`; unknown action → `400`.
  - Action→args map: `whitelistAdd/whitelistRemove/op/deop/pardon(name)`, `ban(name,reason)`, `kick(name,reason)`, `give(name,item,count)`, `gamemode(name,mode)`, `teleport(name,target)`.

- [ ] **Step 1: Write the failing test**

```js
// test/routes/players.test.js
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPlayersRouter } from '../../src/routes/players.js';
import { NotSupportedError } from '../../src/adapters/serverAdapter.js';

function makeApp(adapterOverrides = {}) {
  const adapter = {
    capabilities: new Set(['whitelistAdd', 'ban', 'give']),
    listPlayers: vi.fn().mockResolvedValue({ online: 0, max: 20, players: [] }),
    whitelistAdd: vi.fn().mockResolvedValue('Added steve'),
    ban: vi.fn().mockResolvedValue('Banned'),
    give: vi.fn().mockResolvedValue('Gave'),
    ...adapterOverrides,
  };
  const appState = { getAdapter: vi.fn().mockResolvedValue(adapter) };
  const app = express();
  app.use(express.json());
  app.use('/api/players', createPlayersRouter({ appState }));
  return { app, adapter };
}

describe('players routes', () => {
  it('GET / returns players and capability list', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/players');
    expect(res.body.capabilities).toContain('ban');
    expect(res.body.players).toEqual({ online: 0, max: 20, players: [] });
  });

  it('POST /whitelistAdd delegates with name', async () => {
    const { app, adapter } = makeApp();
    const res = await request(app).post('/api/players/whitelistAdd').send({ name: 'steve' });
    expect(res.body).toEqual({ ok: true, output: 'Added steve' });
    expect(adapter.whitelistAdd).toHaveBeenCalledWith('steve');
  });

  it('POST /give passes item and count', async () => {
    const { app, adapter } = makeApp();
    await request(app).post('/api/players/give').send({ name: 'steve', item: 'minecraft:dirt', count: 3 });
    expect(adapter.give).toHaveBeenCalledWith('steve', 'minecraft:dirt', 3);
  });

  it('returns 409 on NotSupportedError', async () => {
    const { app } = makeApp({ ban: vi.fn().mockRejectedValue(new NotSupportedError('ban')) });
    const res = await request(app).post('/api/players/ban').send({ name: 'x' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'not_supported' });
  });

  it('returns 400 for unknown action', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/players/frobnicate').send({ name: 'x' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/routes/players.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/routes/players.js
import { Router } from 'express';
import { NotSupportedError } from '../adapters/serverAdapter.js';

const ARG_MAP = {
  whitelistAdd: (b) => [b.name],
  whitelistRemove: (b) => [b.name],
  op: (b) => [b.name],
  deop: (b) => [b.name],
  pardon: (b) => [b.name],
  ban: (b) => [b.name, b.reason || ''],
  kick: (b) => [b.name, b.reason || ''],
  give: (b) => [b.name, b.item, Number(b.count) || 1],
  gamemode: (b) => [b.name, b.mode],
  teleport: (b) => [b.name, b.target],
};

export function createPlayersRouter({ appState }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const adapter = await appState.getAdapter();
      const players = await adapter.listPlayers();
      res.json({ players, capabilities: [...adapter.capabilities] });
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/routes/players.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/routes/players.js test/routes/players.test.js
git commit -m "feat: add players routes delegating to adapter"
```

---

# PHASE 6 — Properties Service & Routes

### Task 6.1: propertiesService (parse/serialize)

**Files:**
- Create: `src/services/propertiesService.js`
- Test: `test/services/propertiesService.test.js`

**Interfaces:**
- Consumes: config `{ mcDataPath }`; injected `fs` (defaults to `node:fs/promises`).
- Produces: `createPropertiesService(config, fs)`:
  - `parse(text)` → object (ignores comments/blank lines).
  - `serialize(obj, originalText)` → string preserving comments and key order, updating changed values, appending new keys.
  - `read()` → object from `${mcDataPath}/server.properties`.
  - `update(patch)` → merges patch, writes file, returns merged object.

- [ ] **Step 1: Write the failing test**

```js
// test/services/propertiesService.test.js
import { describe, it, expect, vi } from 'vitest';
import { createPropertiesService } from '../../src/services/propertiesService.js';

const SAMPLE = `#Minecraft server properties
#Mon Jul 18
difficulty=easy
pvp=true
max-players=20`;

function makeFs(content) {
  const store = { value: content };
  return {
    store,
    readFile: vi.fn().mockImplementation(async () => store.value),
    writeFile: vi.fn().mockImplementation(async (_p, data) => { store.value = data; }),
  };
}

describe('propertiesService', () => {
  it('parses key=value ignoring comments', () => {
    const svc = createPropertiesService({ mcDataPath: '/d' }, makeFs(SAMPLE));
    const obj = svc.parse(SAMPLE);
    expect(obj).toEqual({ difficulty: 'easy', pvp: 'true', 'max-players': '20' });
  });

  it('serialize preserves comments and updates values', () => {
    const svc = createPropertiesService({ mcDataPath: '/d' }, makeFs(SAMPLE));
    const out = svc.serialize({ difficulty: 'hard', pvp: 'true', 'max-players': '20' }, SAMPLE);
    expect(out).toContain('#Minecraft server properties');
    expect(out).toContain('difficulty=hard');
  });

  it('update merges patch and writes file', async () => {
    const fs = makeFs(SAMPLE);
    const svc = createPropertiesService({ mcDataPath: '/d' }, fs);
    const merged = await svc.update({ difficulty: 'hard' });
    expect(merged.difficulty).toBe('hard');
    expect(fs.writeFile).toHaveBeenCalled();
    expect(fs.store.value).toContain('difficulty=hard');
  });

  it('update appends new keys not present originally', async () => {
    const fs = makeFs(SAMPLE);
    const svc = createPropertiesService({ mcDataPath: '/d' }, fs);
    await svc.update({ motd: 'Hello' });
    expect(fs.store.value).toContain('motd=Hello');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/propertiesService.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/services/propertiesService.js
import fsp from 'node:fs/promises';
import path from 'node:path';

export function createPropertiesService(config, fs = fsp) {
  const file = path.join(config.mcDataPath, 'server.properties');

  function parse(text) {
    const obj = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      obj[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
    return obj;
  }

  function serialize(obj, originalText = '') {
    const seen = new Set();
    const lines = originalText.split(/\r?\n/).map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return line;
      const key = trimmed.slice(0, idx);
      if (!(key in obj)) return line;
      seen.add(key);
      return `${key}=${obj[key]}`;
    });
    for (const [key, value] of Object.entries(obj)) {
      if (!seen.has(key)) lines.push(`${key}=${value}`);
    }
    return lines.join('\n');
  }

  async function read() {
    return parse(await fs.readFile(file, 'utf8'));
  }

  async function update(patch) {
    let original = '';
    try { original = await fs.readFile(file, 'utf8'); } catch { original = ''; }
    const merged = { ...parse(original), ...patch };
    await fs.writeFile(file, serialize(merged, original), 'utf8');
    return merged;
  }

  return { parse, serialize, read, update };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/propertiesService.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/propertiesService.js test/services/propertiesService.test.js
git commit -m "feat: add server.properties parse/serialize/update service"
```

---

### Task 6.2: Properties routes + validation

**Files:**
- Create: `src/routes/properties.js`
- Test: `test/routes/properties.test.js`

**Interfaces:**
- Consumes: `propertiesService.{read,update}`.
- Produces: `createPropertiesRouter({ propertiesService })`:
  - `GET /` → `{ properties }`.
  - `PUT /` `{ properties }` → validates known keys against `PROPERTY_SCHEMA` (type/enum), rejects invalid with `400 { error, field }`, otherwise updates and returns `{ ok: true, properties }`.
- `PROPERTY_SCHEMA` exported: maps `difficulty` (enum peaceful/easy/normal/hard), `pvp/allow-flight/hardcore` (boolean), `max-players/view-distance` (int), `gamemode` (enum), `motd` (string).

- [ ] **Step 1: Write the failing test**

```js
// test/routes/properties.test.js
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPropertiesRouter } from '../../src/routes/properties.js';

function makeApp() {
  const propertiesService = {
    read: vi.fn().mockResolvedValue({ difficulty: 'easy', 'max-players': '20' }),
    update: vi.fn().mockImplementation(async (p) => ({ difficulty: 'easy', 'max-players': '20', ...p })),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/properties', createPropertiesRouter({ propertiesService }));
  return { app, propertiesService };
}

describe('properties routes', () => {
  it('GET / returns properties', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/properties');
    expect(res.body.properties.difficulty).toBe('easy');
  });

  it('PUT / accepts valid values', async () => {
    const { app, propertiesService } = makeApp();
    const res = await request(app).put('/api/properties').send({ properties: { difficulty: 'hard' } });
    expect(res.status).toBe(200);
    expect(propertiesService.update).toHaveBeenCalledWith({ difficulty: 'hard' });
  });

  it('PUT / rejects invalid enum with 400', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/properties').send({ properties: { difficulty: 'banana' } });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('difficulty');
  });

  it('PUT / rejects non-numeric max-players', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/api/properties').send({ properties: { 'max-players': 'lots' } });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('max-players');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/routes/properties.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/routes/properties.js
import { Router } from 'express';

export const PROPERTY_SCHEMA = {
  difficulty: { type: 'enum', values: ['peaceful', 'easy', 'normal', 'hard'] },
  gamemode: { type: 'enum', values: ['survival', 'creative', 'adventure', 'spectator'] },
  pvp: { type: 'boolean' },
  'allow-flight': { type: 'boolean' },
  hardcore: { type: 'boolean' },
  'max-players': { type: 'int' },
  'view-distance': { type: 'int' },
  motd: { type: 'string' },
};

function validate(properties) {
  for (const [key, value] of Object.entries(properties)) {
    const schema = PROPERTY_SCHEMA[key];
    if (!schema) continue; // unmanaged keys pass through
    const str = String(value);
    if (schema.type === 'enum' && !schema.values.includes(str)) return key;
    if (schema.type === 'boolean' && str !== 'true' && str !== 'false') return key;
    if (schema.type === 'int' && !/^-?\d+$/.test(str)) return key;
  }
  return null;
}

export function createPropertiesRouter({ propertiesService }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      res.json({ properties: await propertiesService.read() });
    } catch (err) { next(err); }
  });

  router.put('/', async (req, res, next) => {
    const properties = req.body?.properties || {};
    const bad = validate(properties);
    if (bad) return res.status(400).json({ error: 'invalid_value', field: bad });
    try {
      const merged = await propertiesService.update(properties);
      res.json({ ok: true, properties: merged });
    } catch (err) { next(err); }
  });

  return router;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/routes/properties.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/routes/properties.js test/routes/properties.test.js
git commit -m "feat: add properties routes with schema validation"
```

---

# PHASE 7 — World Manager

### Task 7.1: worldService — regen

**Files:**
- Create: `src/services/worldService.js`
- Test: `test/services/worldServiceRegen.test.js`

**Interfaces:**
- Consumes: config `{ mcDataPath, mcWorldName }`; `dockerService.{stop,start,getState}`; injected `fs`.
- Produces: `createWorldService({ config, dockerService, fs, archiver, unzipperFactory })`:
  - `regen()` → stops server if running, removes `${mcDataPath}/${mcWorldName}` recursively, starts server. Returns `{ ok: true }`.

- [ ] **Step 1: Write the failing test**

```js
// test/services/worldServiceRegen.test.js
import { describe, it, expect, vi } from 'vitest';
import { createWorldService } from '../../src/services/worldService.js';

function deps() {
  return {
    config: { mcDataPath: '/data', mcWorldName: 'world' },
    dockerService: {
      getState: vi.fn().mockResolvedValue('running'),
      stop: vi.fn().mockResolvedValue(),
      start: vi.fn().mockResolvedValue(),
    },
    fs: { rm: vi.fn().mockResolvedValue() },
  };
}

describe('worldService.regen', () => {
  it('stops, removes world dir, restarts', async () => {
    const d = deps();
    const svc = createWorldService(d);
    const res = await svc.regen();
    expect(d.dockerService.stop).toHaveBeenCalled();
    expect(d.fs.rm).toHaveBeenCalledWith('/data/world', { recursive: true, force: true });
    expect(d.dockerService.start).toHaveBeenCalled();
    expect(res).toEqual({ ok: true });
  });

  it('does not stop if already stopped', async () => {
    const d = deps();
    d.dockerService.getState.mockResolvedValue('exited');
    const svc = createWorldService(d);
    await svc.regen();
    expect(d.dockerService.stop).not.toHaveBeenCalled();
    expect(d.dockerService.start).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/worldServiceRegen.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/services/worldService.js
import fsp from 'node:fs/promises';
import path from 'node:path';

export function createWorldService({ config, dockerService, fs = fsp, archiver, unzipperFactory }) {
  const worldPath = path.join(config.mcDataPath, config.mcWorldName);

  async function stopIfRunning() {
    if ((await dockerService.getState()) === 'running') {
      await dockerService.stop();
      return true;
    }
    return false;
  }

  async function regen() {
    await stopIfRunning();
    await fs.rm(worldPath, { recursive: true, force: true });
    await dockerService.start();
    return { ok: true };
  }

  return { regen, _worldPath: worldPath, _stopIfRunning: stopIfRunning, _archiver: archiver, _unzipperFactory: unzipperFactory };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/worldServiceRegen.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/worldService.js test/services/worldServiceRegen.test.js
git commit -m "feat: add world regen (stop, wipe world, start)"
```

---

### Task 7.2: worldService — download (zip stream)

**Files:**
- Modify: `src/services/worldService.js`
- Test: `test/services/worldServiceDownload.test.js`

**Interfaces:**
- Produces: `createDownloadStream()` → returns an archiver instance with the world directory queued and finalized. (Uses injected `archiver` factory so it's mockable.)

- [ ] **Step 1: Write the failing test**

```js
// test/services/worldServiceDownload.test.js
import { describe, it, expect, vi } from 'vitest';
import { createWorldService } from '../../src/services/worldService.js';

describe('worldService.createDownloadStream', () => {
  it('queues the world directory and finalizes the archive', () => {
    const archive = { directory: vi.fn(), finalize: vi.fn(), on: vi.fn() };
    const archiver = vi.fn().mockReturnValue(archive);
    const svc = createWorldService({
      config: { mcDataPath: '/data', mcWorldName: 'world' },
      dockerService: {},
      fs: {},
      archiver,
    });
    const out = svc.createDownloadStream();
    expect(archiver).toHaveBeenCalledWith('zip', expect.any(Object));
    expect(archive.directory).toHaveBeenCalledWith('/data/world', 'world');
    expect(archive.finalize).toHaveBeenCalled();
    expect(out).toBe(archive);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/worldServiceDownload.test.js`
Expected: FAIL — `svc.createDownloadStream is not a function`.

- [ ] **Step 3: Add the method**

Add inside `createWorldService`, before the `return`:

```js
  function createDownloadStream() {
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.directory(worldPath, config.mcWorldName);
    archive.finalize();
    return archive;
  }
```

And add `createDownloadStream` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/worldServiceDownload.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/services/worldService.js test/services/worldServiceDownload.test.js
git commit -m "feat: add world download zip stream"
```

---

### Task 7.3: worldService — upload (temp extract + swap)

**Files:**
- Modify: `src/services/worldService.js`
- Test: `test/services/worldServiceUpload.test.js`

**Interfaces:**
- Produces: `importWorld(zipPath)` → stops server if running; extracts zip to a temp dir under `mcDataPath`; on success removes old world and renames temp→world; starts server. On extract failure, leaves the live world untouched and throws. Returns `{ ok: true }`.

- [ ] **Step 1: Write the failing test**

```js
// test/services/worldServiceUpload.test.js
import { describe, it, expect, vi } from 'vitest';
import { createWorldService } from '../../src/services/worldService.js';

function deps(extractOk = true) {
  return {
    config: { mcDataPath: '/data', mcWorldName: 'world' },
    dockerService: {
      getState: vi.fn().mockResolvedValue('running'),
      stop: vi.fn().mockResolvedValue(),
      start: vi.fn().mockResolvedValue(),
    },
    fs: {
      rm: vi.fn().mockResolvedValue(),
      rename: vi.fn().mockResolvedValue(),
      mkdir: vi.fn().mockResolvedValue(),
    },
    // extractZip is injected for testability
    extractZip: vi.fn().mockImplementation(async () => {
      if (!extractOk) throw new Error('bad zip');
    }),
  };
}

describe('worldService.importWorld', () => {
  it('extracts to temp, swaps, restarts on success', async () => {
    const d = deps(true);
    const svc = createWorldService(d);
    const res = await svc.importWorld('/tmp/upload.zip');
    expect(d.extractZip).toHaveBeenCalledWith('/tmp/upload.zip', '/data/world.import');
    expect(d.fs.rm).toHaveBeenCalledWith('/data/world', { recursive: true, force: true });
    expect(d.fs.rename).toHaveBeenCalledWith('/data/world.import', '/data/world');
    expect(d.dockerService.start).toHaveBeenCalled();
    expect(res).toEqual({ ok: true });
  });

  it('leaves live world intact and restarts server on bad zip', async () => {
    const d = deps(false);
    const svc = createWorldService(d);
    await expect(svc.importWorld('/tmp/upload.zip')).rejects.toThrow('bad zip');
    // live world never removed
    expect(d.fs.rm).not.toHaveBeenCalledWith('/data/world', expect.anything());
    expect(d.fs.rename).not.toHaveBeenCalled();
    // temp cleaned + server restarted
    expect(d.fs.rm).toHaveBeenCalledWith('/data/world.import', { recursive: true, force: true });
    expect(d.dockerService.start).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/services/worldServiceUpload.test.js`
Expected: FAIL — `svc.importWorld is not a function`.

- [ ] **Step 3: Add the method + wire injected `extractZip`**

Update the destructuring signature and add the method. Change the function signature line to:

```js
export function createWorldService({ config, dockerService, fs = fsp, archiver, extractZip }) {
```

Add inside, before `return`:

```js
  const importPath = worldPath + '.import';

  async function importWorld(zipPath) {
    const wasRunning = await stopIfRunning();
    try {
      await fs.mkdir(importPath, { recursive: true });
      await extractZip(zipPath, importPath);
    } catch (err) {
      await fs.rm(importPath, { recursive: true, force: true });
      if (wasRunning) await dockerService.start();
      throw err;
    }
    await fs.rm(worldPath, { recursive: true, force: true });
    await fs.rename(importPath, worldPath);
    await dockerService.start();
    return { ok: true };
  }
```

Add `importWorld` to the returned object.

> Note: the real `extractZip` (wired in `server.js`) uses `unzipper`:
> ```js
> import unzipper from 'unzipper';
> import { createReadStream } from 'node:fs';
> const extractZip = (zip, dest) =>
>   new Promise((resolve, reject) => {
>     createReadStream(zip)
>       .pipe(unzipper.Extract({ path: dest }))
>       .on('close', resolve).on('error', reject);
>   });
> ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/services/worldServiceUpload.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/worldService.js test/services/worldServiceUpload.test.js
git commit -m "feat: add world import with temp-extract and atomic swap"
```

---

### Task 7.4: World routes

**Files:**
- Create: `src/routes/world.js`
- Test: `test/routes/world.test.js`

**Interfaces:**
- Consumes: `worldService.{regen, createDownloadStream, importWorld}`; `multer` for upload; config `{ maxUploadBytes }`.
- Produces: `createWorldRouter({ worldService, upload })`:
  - `POST /regen` → `{ ok: true }`.
  - `GET /download` → sets `Content-Type: application/zip` + `Content-Disposition`, pipes the archive.
  - `POST /upload` (multipart field `world`) → calls `importWorld(file.path)`, `{ ok: true }`; bad zip → `400 { error: 'invalid_world' }`.

- [ ] **Step 1: Write the failing test**

```js
// test/routes/world.test.js
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PassThrough } from 'node:stream';
import { createWorldRouter } from '../../src/routes/world.js';

function noopUpload() {
  // fake multer middleware that sets req.file
  return { single: () => (req, _res, next) => { req.file = { path: '/tmp/up.zip' }; next(); } };
}

function makeApp(worldOverrides = {}) {
  const worldService = {
    regen: vi.fn().mockResolvedValue({ ok: true }),
    importWorld: vi.fn().mockResolvedValue({ ok: true }),
    createDownloadStream: vi.fn().mockImplementation(() => {
      const s = new PassThrough();
      process.nextTick(() => { s.end('zipbytes'); });
      return s;
    }),
    ...worldOverrides,
  };
  const app = express();
  app.use(express.json());
  app.use('/api/world', createWorldRouter({ worldService, upload: noopUpload() }));
  return { app, worldService };
}

describe('world routes', () => {
  it('POST /regen delegates', async () => {
    const { app, worldService } = makeApp();
    const res = await request(app).post('/api/world/regen');
    expect(res.body).toEqual({ ok: true });
    expect(worldService.regen).toHaveBeenCalled();
  });

  it('GET /download streams a zip', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/world/download');
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.text).toContain('zipbytes');
  });

  it('POST /upload imports the world', async () => {
    const { app, worldService } = makeApp();
    const res = await request(app).post('/api/world/upload');
    expect(res.body).toEqual({ ok: true });
    expect(worldService.importWorld).toHaveBeenCalledWith('/tmp/up.zip');
  });

  it('POST /upload returns 400 on bad zip', async () => {
    const { app } = makeApp({ importWorld: vi.fn().mockRejectedValue(new Error('bad zip')) });
    const res = await request(app).post('/api/world/upload');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_world' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/routes/world.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/routes/world.js
import { Router } from 'express';

export function createWorldRouter({ worldService, upload }) {
  const router = Router();

  router.post('/regen', async (req, res, next) => {
    try { res.json(await worldService.regen()); } catch (err) { next(err); }
  });

  router.get('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="world.zip"');
    const archive = worldService.createDownloadStream();
    archive.on('error', () => res.destroy());
    archive.pipe(res);
  });

  router.post('/upload', upload.single('world'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    try {
      await worldService.importWorld(req.file.path);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'invalid_world' });
    }
  });

  return router;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/routes/world.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/routes/world.js test/routes/world.test.js
git commit -m "feat: add world routes (regen/download/upload)"
```

---

# PHASE 8 — Sockets

### Task 8.1: logsSocket

**Files:**
- Create: `src/sockets/logsSocket.js`
- Test: `test/sockets/logsSocket.test.js`

**Interfaces:**
- Consumes: `dockerService.logStream`, `appState.getAdapter`.
- Produces: `registerLogsSocket(namespace, { dockerService, appState })`. On `connection`: pipes log stream chunks as `log` events; on client `command` event, calls `adapter.sendCommand(cmd)` and emits the output back as a `log` event; cleans the stream up on `disconnect`.

- [ ] **Step 1: Write the failing test**

```js
// test/sockets/logsSocket.test.js
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { registerLogsSocket } from '../../src/sockets/logsSocket.js';

function fakeNamespace() {
  const ns = new EventEmitter();
  ns.on = ns.on.bind(ns);
  return ns;
}
function fakeSocket() {
  const s = new EventEmitter();
  s.emit = s.emit.bind(s);
  s.emitted = [];
  const origEmit = s.emit;
  s.emit = (ev, payload) => { s.emitted.push([ev, payload]); return origEmit(ev, payload); };
  return s;
}

describe('logsSocket', () => {
  it('streams log chunks to the client', async () => {
    const logStream = new PassThrough();
    const dockerService = { logStream: vi.fn().mockResolvedValue(logStream) };
    const appState = { getAdapter: vi.fn().mockResolvedValue({ sendCommand: vi.fn() }) };
    const ns = fakeNamespace();
    registerLogsSocket(ns, { dockerService, appState });

    const socket = fakeSocket();
    ns.emit('connection', socket);
    await new Promise((r) => setTimeout(r, 10)); // allow async logStream()

    logStream.write('hello world');
    await new Promise((r) => setTimeout(r, 5));

    const logs = socket.emitted.filter(([ev]) => ev === 'log').map(([, p]) => p);
    expect(logs.join('')).toContain('hello world');
  });

  it('routes command events to adapter.sendCommand', async () => {
    const logStream = new PassThrough();
    const sendCommand = vi.fn().mockResolvedValue('command result');
    const dockerService = { logStream: vi.fn().mockResolvedValue(logStream) };
    const appState = { getAdapter: vi.fn().mockResolvedValue({ sendCommand }) };
    const ns = fakeNamespace();
    registerLogsSocket(ns, { dockerService, appState });

    const socket = fakeSocket();
    ns.emit('connection', socket);
    await new Promise((r) => setTimeout(r, 10));

    socket.emit('command', 'list');
    await new Promise((r) => setTimeout(r, 5));

    expect(sendCommand).toHaveBeenCalledWith('list');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/sockets/logsSocket.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/sockets/logsSocket.js
export function registerLogsSocket(namespace, { dockerService, appState }) {
  namespace.on('connection', async (socket) => {
    let stream = null;
    try {
      stream = await dockerService.logStream();
      const onData = (chunk) => socket.emit('log', chunk.toString());
      stream.on('data', onData);
      socket.on('disconnect', () => {
        stream?.off?.('data', onData);
        stream?.destroy?.();
      });
    } catch (err) {
      socket.emit('log', `[craftdock] log stream unavailable: ${err.message}\n`);
    }

    socket.on('command', async (cmd) => {
      try {
        const adapter = await appState.getAdapter();
        const output = await adapter.sendCommand(cmd);
        if (output) socket.emit('log', `> ${cmd}\n${output}\n`);
      } catch (err) {
        socket.emit('log', `[craftdock] command failed: ${err.message}\n`);
      }
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/sockets/logsSocket.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sockets/logsSocket.js test/sockets/logsSocket.test.js
git commit -m "feat: add logs socket (stream + command relay)"
```

---

### Task 8.2: statusSocket

**Files:**
- Create: `src/sockets/statusSocket.js`
- Test: `test/sockets/statusSocket.test.js`

**Interfaces:**
- Consumes: `dockerService.{inspect,stats}`, `appState.getAdapter`.
- Produces: `registerStatusSocket(namespace, { dockerService, appState, intervalMs })`. On connection, immediately pushes one `status` event and then every `intervalMs`; clears the interval on disconnect. Exports `buildStatusPayload({ dockerService, appState })` (the pure aggregator) for direct unit testing.

- [ ] **Step 1: Write the failing test**

```js
// test/sockets/statusSocket.test.js
import { describe, it, expect, vi } from 'vitest';
import { buildStatusPayload } from '../../src/sockets/statusSocket.js';

describe('buildStatusPayload', () => {
  it('aggregates state, stats and players when running', async () => {
    const dockerService = {
      inspect: vi.fn().mockResolvedValue({ state: 'running', type: 'PAPER' }),
      stats: vi.fn().mockResolvedValue({ cpuPct: 5, memUsedMb: 256, memPct: 25 }),
    };
    const appState = {
      getAdapter: vi.fn().mockResolvedValue({
        listPlayers: vi.fn().mockResolvedValue({ online: 2, max: 20, players: ['a', 'b'] }),
      }),
    };
    const payload = await buildStatusPayload({ dockerService, appState });
    expect(payload).toMatchObject({
      state: 'running', cpuPct: 5, memPct: 25,
      players: { online: 2, max: 20, players: ['a', 'b'] },
    });
  });

  it('returns zeros and empty players when not running', async () => {
    const dockerService = {
      inspect: vi.fn().mockResolvedValue({ state: 'exited', type: 'PAPER' }),
      stats: vi.fn(),
    };
    const appState = { getAdapter: vi.fn() };
    const payload = await buildStatusPayload({ dockerService, appState });
    expect(payload.state).toBe('exited');
    expect(payload.players).toEqual({ online: 0, max: 0, players: [] });
    expect(dockerService.stats).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/sockets/statusSocket.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/sockets/statusSocket.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/sockets/statusSocket.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sockets/statusSocket.js test/sockets/statusSocket.test.js
git commit -m "feat: add status socket with periodic push"
```

---

### Task 8.3: Sockets index (wire namespaces + auth)

**Files:**
- Create: `src/sockets/index.js`
- Test: `test/sockets/index.test.js`

**Interfaces:**
- Consumes: `registerLogsSocket`, `registerStatusSocket`, `socketAuth`.
- Produces: `registerSockets(io, { dockerService, appState, sessionMiddleware })` → applies `socketAuth(sessionMiddleware)` to `/logs` and `/status` namespaces and registers their handlers. Returns the namespaces for assertion.

- [ ] **Step 1: Write the failing test**

```js
// test/sockets/index.test.js
import { describe, it, expect, vi } from 'vitest';
import { registerSockets } from '../../src/sockets/index.js';

describe('registerSockets', () => {
  it('creates /logs and /status namespaces with auth middleware', () => {
    const namespaces = {};
    const io = {
      of: vi.fn((name) => {
        const ns = { use: vi.fn(), on: vi.fn() };
        namespaces[name] = ns;
        return ns;
      }),
    };
    registerSockets(io, {
      dockerService: {}, appState: {}, sessionMiddleware: (req, res, next) => next(),
    });
    expect(io.of).toHaveBeenCalledWith('/logs');
    expect(io.of).toHaveBeenCalledWith('/status');
    expect(namespaces['/logs'].use).toHaveBeenCalled();
    expect(namespaces['/status'].use).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/sockets/index.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/sockets/index.js
import { registerLogsSocket } from './logsSocket.js';
import { registerStatusSocket } from './statusSocket.js';
import { socketAuth } from '../middleware/auth.js';

export function registerSockets(io, { dockerService, appState, sessionMiddleware }) {
  const auth = socketAuth(sessionMiddleware);

  const logs = io.of('/logs');
  logs.use(auth);
  registerLogsSocket(logs, { dockerService, appState });

  const status = io.of('/status');
  status.use(auth);
  registerStatusSocket(status, { dockerService, appState });

  return { logs, status };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/sockets/index.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/sockets/index.js test/sockets/index.test.js
git commit -m "feat: wire socket namespaces with handshake auth"
```

---

# PHASE 9 — Server Composition

### Task 9.1: server.js (compose everything)

**Files:**
- Create: `src/server.js`
- Test: `test/server.integration.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces: `createApp(deps)` → returns `{ app, sessionMiddleware }` where `app` is a configured Express app (session, json, static SPA, auth-guarded API routers). `startServer()` wires HTTP + Socket.io and listens. The test exercises the auth guard end-to-end using injected fake services.

- [ ] **Step 1: Write the failing test**

```js
// test/server.integration.test.js
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/server.js';

function fakeDeps() {
  const config = {
    adminPasswordHash: bcrypt.hashSync('pw', 10),
    sessionSecret: 'test-secret',
    nodeEnv: 'test',
    mcDataPath: '/data',
  };
  const dockerService = {
    inspect: vi.fn().mockResolvedValue({ state: 'exited', type: 'PAPER' }),
    stats: vi.fn(), start: vi.fn(), stop: vi.fn(), restart: vi.fn(), kill: vi.fn(),
  };
  const appState = { getEdition: vi.fn().mockResolvedValue('java'), getAdapter: vi.fn() };
  const propertiesService = { read: vi.fn().mockResolvedValue({}), update: vi.fn() };
  const worldService = {};
  const authService = { verifyPassword: async (p) => p === 'pw' };
  const upload = { single: () => (req, _res, next) => next() };
  return { config, dockerService, appState, propertiesService, worldService, authService, upload };
}

describe('server auth guard', () => {
  it('blocks /api/status when unauthenticated', async () => {
    const { app } = createApp(fakeDeps());
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(401);
  });

  it('allows /api/status after login', async () => {
    const { app } = createApp(fakeDeps());
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ password: 'pw' });
    const res = await agent.get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('exited');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/server.integration.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/server.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/server.integration.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server.js test/server.integration.test.js
git commit -m "feat: compose express app with guarded routers"
```

---

### Task 9.2: Composition root (main entrypoint wiring real deps)

**Files:**
- Create: `src/main.js`
- Modify: `package.json` (`start`/`dev` → `src/main.js`)

**Interfaces:**
- Consumes: all `create*` factories + real libs (Docker, Rcon, archiver, unzipper, multer).
- Produces: builds real dependency graph and calls `startServer`. No unit test (thin wiring); verified by the manual smoke run in Task 11.1.

- [ ] **Step 1: Write the entrypoint**

```js
// src/main.js
import Docker from 'dockerode';
import archiver from 'archiver';
import unzipper from 'unzipper';
import multer from 'multer';
import os from 'node:os';
import { createReadStream } from 'node:fs';

import { loadConfig } from './config.js';
import { createDockerService } from './services/dockerService.js';
import { createRconService } from './services/rconService.js';
import { createStdinService } from './services/stdinService.js';
import { createPropertiesService } from './services/propertiesService.js';
import { createWorldService } from './services/worldService.js';
import { createAuthService } from './services/authService.js';
import { createAppState } from './appState.js';
import { startServer } from './server.js';

const config = loadConfig();
const docker = new Docker(); // uses /var/run/docker.sock by default

const dockerService = createDockerService(config, docker);
const rconService = createRconService(config);
const stdinService = createStdinService(dockerService);
const propertiesService = createPropertiesService(config);
const authService = createAuthService(config);
const appState = createAppState({ config, dockerService, rconService, stdinService });

const extractZip = (zip, dest) =>
  new Promise((resolve, reject) => {
    createReadStream(zip)
      .pipe(unzipper.Extract({ path: dest }))
      .on('close', resolve)
      .on('error', reject);
  });

const worldService = createWorldService({ config, dockerService, archiver, extractZip });
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: config.maxUploadBytes },
});

startServer({
  config, dockerService, appState, propertiesService,
  worldService, authService, upload,
});
```

- [ ] **Step 2: Point npm scripts at the entrypoint**

Edit `package.json` scripts:

```json
    "start": "node src/main.js",
    "dev": "node --watch src/main.js",
```

- [ ] **Step 3: Verify the full suite still passes**

Run: `npx vitest run`
Expected: PASS — all suites green.

- [ ] **Step 4: Commit**

```bash
git add src/main.js package.json
git commit -m "feat: add composition root wiring real dependencies"
```

---

# PHASE 10 — Frontend SPA

> Frontend is vanilla JS with Tailwind via CDN. No build step. Tabs are ES modules imported by `app.js`. There is no automated test harness for the browser here; each task ends with a manual DOM/interaction check plus a commit. Keep DOM helpers tiny and shared.

### Task 10.1: SPA shell + auth gate + tab router

**Files:**
- Create: `src/public/index.html`, `src/public/css/styles.css`, `src/public/js/app.js`, `src/public/js/socket.js`

**Interfaces:**
- Produces: login screen (hidden when authed via `GET /api/auth/me`); tab bar switching between six panels; a shared `api(path, opts)` fetch helper that redirects to login on `401`.

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CraftDock</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="/socket.io/socket.io.js"></script>
  <link rel="stylesheet" href="/css/styles.css" />
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">
  <div id="login" class="hidden max-w-sm mx-auto mt-32 p-6 bg-slate-800 rounded-xl">
    <h1 class="text-2xl font-bold mb-4">CraftDock</h1>
    <input id="password" type="password" placeholder="Senha de admin"
           class="w-full p-2 rounded bg-slate-700 mb-3" />
    <button id="loginBtn" class="w-full p-2 rounded bg-emerald-600 hover:bg-emerald-500">Entrar</button>
    <p id="loginError" class="text-red-400 text-sm mt-2 hidden">Senha incorreta</p>
  </div>

  <div id="app" class="hidden">
    <header class="flex items-center justify-between px-6 py-3 bg-slate-800">
      <h1 class="text-xl font-bold">CraftDock</h1>
      <nav id="tabs" class="flex gap-2 text-sm"></nav>
      <button id="logoutBtn" class="text-sm text-slate-400 hover:text-white">Sair</button>
    </header>
    <main id="panels" class="p-6"></main>
  </div>

  <script type="module" src="/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `css/styles.css`**

```css
.tab-btn { padding: 0.25rem 0.75rem; border-radius: 0.375rem; }
.tab-btn.active { background: #059669; }
#console { font-family: ui-monospace, monospace; white-space: pre-wrap; }
```

- [ ] **Step 3: Create `js/socket.js`**

```js
export async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { window.location.reload(); return; }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res;
}
```

- [ ] **Step 4: Create `js/app.js` (shell + router; tabs imported lazily)**

```js
import { api } from './socket.js';
import { renderStatus } from './tabs/status.js';
import { renderConsole } from './tabs/console.js';
import { renderPlayers } from './tabs/players.js';
import { renderOptions } from './tabs/options.js';
import { renderWorld } from './tabs/world.js';
import { renderMap } from './tabs/map.js';

const TABS = [
  { id: 'status', label: 'Início', render: renderStatus },
  { id: 'console', label: 'Console', render: renderConsole },
  { id: 'players', label: 'Jogadores', render: renderPlayers },
  { id: 'options', label: 'Opções', render: renderOptions },
  { id: 'world', label: 'Mundo', render: renderWorld },
  { id: 'map', label: 'Mapa', render: renderMap },
];

let cleanup = null;

function showTab(id) {
  if (cleanup) { cleanup(); cleanup = null; }
  document.querySelectorAll('.tab-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === id));
  const panels = document.getElementById('panels');
  panels.innerHTML = '';
  const tab = TABS.find((t) => t.id === id);
  cleanup = tab.render(panels) || null;
}

function initTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  for (const tab of TABS) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.tab = tab.id;
    btn.textContent = tab.label;
    btn.onclick = () => showTab(tab.id);
    nav.appendChild(btn);
  }
  showTab('status');
}

async function boot() {
  const me = await api('/api/auth/me');
  if (me?.authed) {
    document.getElementById('app').classList.remove('hidden');
    initTabs();
  } else {
    document.getElementById('login').classList.remove('hidden');
  }
}

document.getElementById('loginBtn').onclick = async () => {
  const password = document.getElementById('password').value;
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) window.location.reload();
  else document.getElementById('loginError').classList.remove('hidden');
};

document.getElementById('logoutBtn').onclick = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.reload();
};

boot();
```

- [ ] **Step 5: Manual check**

Run: `npm run dev` (requires `.env` with a hash; if no Docker, the login screen still renders). Open `http://localhost:3000`.
Expected: login screen renders; wrong password shows error; correct password reveals the tab bar with six tabs.

- [ ] **Step 6: Commit**

```bash
git add src/public/index.html src/public/css/styles.css src/public/js/app.js src/public/js/socket.js
git commit -m "feat: add SPA shell, auth gate, and tab router"
```

---

### Task 10.2: Status tab (live stats via socket)

**Files:**
- Create: `src/public/js/tabs/status.js`

**Interfaces:**
- Consumes: `/status` socket namespace; `POST /api/status/{action}`.
- Produces: `renderStatus(container)` → renders state badge, CPU/RAM/players cards, and lifecycle buttons; subscribes to `status` events; returns a cleanup function that disconnects the socket.

- [ ] **Step 1: Implement the tab**

```js
// src/public/js/tabs/status.js
import { api } from '../socket.js';

export function renderStatus(root) {
  root.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <span id="state" class="px-3 py-1 rounded bg-slate-700">...</span>
      <span id="edition" class="text-sm text-slate-400"></span>
    </div>
    <div class="grid grid-cols-3 gap-4 mb-6 max-w-xl">
      <div class="bg-slate-800 p-4 rounded"><div class="text-xs text-slate-400">CPU</div><div id="cpu" class="text-2xl">–</div></div>
      <div class="bg-slate-800 p-4 rounded"><div class="text-xs text-slate-400">RAM</div><div id="mem" class="text-2xl">–</div></div>
      <div class="bg-slate-800 p-4 rounded"><div class="text-xs text-slate-400">Jogadores</div><div id="players" class="text-2xl">–</div></div>
    </div>
    <div class="flex gap-2">
      <button data-act="start" class="px-4 py-2 rounded bg-emerald-600">Ligar</button>
      <button data-act="stop" class="px-4 py-2 rounded bg-yellow-600">Desligar</button>
      <button data-act="restart" class="px-4 py-2 rounded bg-blue-600">Reiniciar</button>
      <button data-act="kill" class="px-4 py-2 rounded bg-red-700">Forçar Parada</button>
    </div>`;

  root.querySelectorAll('button[data-act]').forEach((b) => {
    b.onclick = () => api(`/api/status/${b.dataset.act}`, { method: 'POST' });
  });

  const socket = io('/status');
  socket.on('status', (s) => {
    root.querySelector('#state').textContent = s.state;
    root.querySelector('#edition').textContent = s.edition ? `Edição: ${s.edition}` : '';
    root.querySelector('#cpu').textContent = s.state === 'running' ? `${s.cpuPct}%` : '–';
    root.querySelector('#mem').textContent = s.state === 'running' ? `${s.memUsedMb} MB` : '–';
    root.querySelector('#players').textContent = s.players ? `${s.players.online}/${s.players.max}` : '–';
  });

  return () => socket.disconnect();
}
```

- [ ] **Step 2: Manual check**

With a running MC container: open the Início tab.
Expected: state badge updates ~every 2s; CPU/RAM/players populate; lifecycle buttons work.

- [ ] **Step 3: Commit**

```bash
git add src/public/js/tabs/status.js
git commit -m "feat: add status tab with live stats and lifecycle controls"
```

---

### Task 10.3: Console tab (log stream + command input)

**Files:**
- Create: `src/public/js/tabs/console.js`

**Interfaces:**
- Consumes: `/logs` socket namespace.
- Produces: `renderConsole(container)` → black console div (bounded buffer, auto-scroll) + command input; emits `command` on submit; returns cleanup that disconnects.

- [ ] **Step 1: Implement the tab**

```js
// src/public/js/tabs/console.js
export function renderConsole(root) {
  root.innerHTML = `
    <div id="console" class="bg-black text-green-400 h-96 overflow-y-auto p-3 rounded text-sm"></div>
    <form id="cmdForm" class="mt-2 flex gap-2">
      <input id="cmd" class="flex-1 p-2 rounded bg-slate-700" placeholder="Comando (ex: list)" autocomplete="off" />
      <button class="px-4 rounded bg-emerald-600">Enviar</button>
    </form>`;

  const consoleEl = root.querySelector('#console');
  const MAX = 500;
  const append = (text) => {
    consoleEl.textContent += text;
    const lines = consoleEl.textContent.split('\n');
    if (lines.length > MAX) consoleEl.textContent = lines.slice(-MAX).join('\n');
    consoleEl.scrollTop = consoleEl.scrollHeight;
  };

  const socket = io('/logs');
  socket.on('log', append);
  socket.on('connect_error', () => append('[craftdock] conexão perdida\n'));

  root.querySelector('#cmdForm').onsubmit = (e) => {
    e.preventDefault();
    const input = root.querySelector('#cmd');
    if (input.value.trim()) { socket.emit('command', input.value.trim()); input.value = ''; }
  };

  return () => socket.disconnect();
}
```

- [ ] **Step 2: Manual check**

Open Console tab with a running server.
Expected: live logs stream in; typing `list` shows output; buffer stays bounded.

- [ ] **Step 3: Commit**

```bash
git add src/public/js/tabs/console.js
git commit -m "feat: add console tab with log stream and command input"
```

---

### Task 10.4: Players tab (capability-aware controls)

**Files:**
- Create: `src/public/js/tabs/players.js`

**Interfaces:**
- Consumes: `GET /api/players`, `POST /api/players/:action`.
- Produces: `renderPlayers(container)` → online list; whitelist/ban/op add-remove forms; per-player quick actions (kick/give/gamemode/tp). Controls whose action is absent from `capabilities` are hidden. Returns cleanup that clears its refresh interval.

- [ ] **Step 1: Implement the tab**

```js
// src/public/js/tabs/players.js
import { api } from '../socket.js';

export function renderPlayers(root) {
  root.innerHTML = `
    <div id="caps"></div>
    <h2 class="text-lg font-bold mb-2">Online</h2>
    <ul id="online" class="mb-6 space-y-1"></ul>
    <div id="mgmt" class="grid gap-4 max-w-lg"></div>`;

  let capabilities = new Set();

  const action = (act, body) => api(`/api/players/${act}`, { method: 'POST', body }).then(refresh);

  function mgmtForm(act, label) {
    if (!capabilities.has(act)) return '';
    return `<form data-act="${act}" class="flex gap-2">
      <input name="name" placeholder="Jogador" class="flex-1 p-2 rounded bg-slate-700" />
      <button class="px-3 rounded bg-emerald-600">${label}</button></form>`;
  }

  async function refresh() {
    const data = await api('/api/players');
    if (!data) return;
    capabilities = new Set(data.capabilities);
    const online = root.querySelector('#online');
    online.innerHTML = data.players.players.length
      ? data.players.players.map((p) => `
          <li class="flex items-center gap-2 bg-slate-800 p-2 rounded">
            <span class="flex-1">${p}</span>
            <button data-kick="${p}" class="text-xs px-2 py-1 bg-red-700 rounded">Kick</button>
            <button data-tp="${p}" class="text-xs px-2 py-1 bg-blue-700 rounded">TP</button>
          </li>`).join('')
      : '<li class="text-slate-400">Ninguém online</li>';

    root.querySelector('#mgmt').innerHTML =
      mgmtForm('whitelistAdd', 'Whitelist +') +
      mgmtForm('ban', 'Banir') +
      mgmtForm('op', 'Op');

    root.querySelectorAll('#mgmt form').forEach((f) => {
      f.onsubmit = (e) => { e.preventDefault(); action(f.dataset.act, { name: f.name.value }); };
    });
    online.querySelectorAll('[data-kick]').forEach((b) =>
      b.onclick = () => action('kick', { name: b.dataset.kick }));
    online.querySelectorAll('[data-tp]').forEach((b) =>
      b.onclick = () => {
        const target = prompt('Teleportar para (jogador ou x y z):');
        if (target) action('teleport', { name: b.dataset.tp, target });
      });
  }

  refresh();
  const timer = setInterval(refresh, 5000);
  return () => clearInterval(timer);
}
```

- [ ] **Step 2: Manual check**

Open Players tab on Java: whitelist/ban/op forms appear; kick/tp work. On Bedrock: ban form is hidden.
Expected: capability-aware rendering; actions succeed.

- [ ] **Step 3: Commit**

```bash
git add src/public/js/tabs/players.js
git commit -m "feat: add capability-aware players tab"
```

---

### Task 10.5: Options tab (server.properties form)

**Files:**
- Create: `src/public/js/tabs/options.js`

**Interfaces:**
- Consumes: `GET /api/properties`, `PUT /api/properties`.
- Produces: `renderOptions(container)` → friendly form for known keys (difficulty, pvp, allow-flight, max-players, gamemode, hardcore, view-distance, motd); Save calls PUT and shows the "restart required" notice.

- [ ] **Step 1: Implement the tab**

```js
// src/public/js/tabs/options.js
import { api } from '../socket.js';

const FIELDS = [
  { key: 'difficulty', type: 'enum', values: ['peaceful', 'easy', 'normal', 'hard'] },
  { key: 'gamemode', type: 'enum', values: ['survival', 'creative', 'adventure', 'spectator'] },
  { key: 'pvp', type: 'boolean' },
  { key: 'allow-flight', type: 'boolean' },
  { key: 'hardcore', type: 'boolean' },
  { key: 'max-players', type: 'int' },
  { key: 'view-distance', type: 'int' },
  { key: 'motd', type: 'string' },
];

export function renderOptions(root) {
  root.innerHTML = `<form id="opts" class="grid gap-3 max-w-md"></form>
    <p class="text-yellow-400 text-sm mt-3">As mudanças exigem reiniciar o servidor.</p>
    <p id="optMsg" class="text-sm mt-1"></p>`;

  function field(f, value) {
    if (f.type === 'enum') {
      return `<label class="flex justify-between items-center gap-2">${f.key}
        <select name="${f.key}" class="p-2 rounded bg-slate-700">
          ${f.values.map((v) => `<option ${v === value ? 'selected' : ''}>${v}</option>`).join('')}
        </select></label>`;
    }
    if (f.type === 'boolean') {
      return `<label class="flex justify-between items-center gap-2">${f.key}
        <input type="checkbox" name="${f.key}" ${value === 'true' ? 'checked' : ''} /></label>`;
    }
    const inputType = f.type === 'int' ? 'number' : 'text';
    return `<label class="flex justify-between items-center gap-2">${f.key}
      <input type="${inputType}" name="${f.key}" value="${value ?? ''}" class="p-2 rounded bg-slate-700" /></label>`;
  }

  api('/api/properties').then((data) => {
    if (!data) return;
    const props = data.properties || {};
    const form = root.querySelector('#opts');
    form.innerHTML = FIELDS.map((f) => field(f, props[f.key])).join('') +
      `<button class="px-4 py-2 rounded bg-emerald-600">Salvar</button>`;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const patch = {};
      for (const f of FIELDS) {
        const el = form.elements[f.key];
        patch[f.key] = f.type === 'boolean' ? String(el.checked) : el.value;
      }
      const res = await api('/api/properties', { method: 'PUT', body: { properties: patch } });
      const msg = root.querySelector('#optMsg');
      msg.textContent = res?.ok ? 'Salvo. Reinicie para aplicar.' : `Erro no campo: ${res?.field}`;
      msg.className = res?.ok ? 'text-emerald-400 text-sm mt-1' : 'text-red-400 text-sm mt-1';
    };
  });
}
```

- [ ] **Step 2: Manual check**

Open Options tab: fields populate from current properties; saving persists (verify by reloading) and shows the restart notice; invalid values report the field.

- [ ] **Step 3: Commit**

```bash
git add src/public/js/tabs/options.js
git commit -m "feat: add options tab for server.properties"
```

---

### Task 10.6: World tab (regen/download/upload)

**Files:**
- Create: `src/public/js/tabs/world.js`

**Interfaces:**
- Consumes: `POST /api/world/regen`, `GET /api/world/download`, `POST /api/world/upload`.
- Produces: `renderWorld(container)` → three actions with double-confirmation for destructive ones; upload uses `FormData` (field `world`).

- [ ] **Step 1: Implement the tab**

```js
// src/public/js/tabs/world.js
import { api } from '../socket.js';

export function renderWorld(root) {
  root.innerHTML = `
    <div class="space-y-4 max-w-md">
      <div class="bg-slate-800 p-4 rounded">
        <h3 class="font-bold mb-2">Baixar mundo atual</h3>
        <a href="/api/world/download" class="inline-block px-4 py-2 rounded bg-blue-600">Baixar .zip</a>
        <p class="text-xs text-slate-400 mt-1">Recomendado parar o servidor antes.</p>
      </div>
      <div class="bg-slate-800 p-4 rounded">
        <h3 class="font-bold mb-2">Subir novo mundo</h3>
        <input id="worldFile" type="file" accept=".zip" class="mb-2" />
        <button id="uploadBtn" class="px-4 py-2 rounded bg-emerald-600">Enviar e substituir</button>
        <p id="upMsg" class="text-sm mt-1"></p>
      </div>
      <div class="bg-slate-800 p-4 rounded">
        <h3 class="font-bold mb-2 text-red-400">Gerar novo mundo</h3>
        <button id="regenBtn" class="px-4 py-2 rounded bg-red-700">Apagar e gerar novo</button>
      </div>
    </div>`;

  root.querySelector('#regenBtn').onclick = async () => {
    if (!confirm('Isto APAGA o mundo atual. Continuar?')) return;
    if (!confirm('Tem certeza absoluta? Não há como desfazer.')) return;
    await api('/api/world/regen', { method: 'POST' });
    alert('Novo mundo sendo gerado. O servidor irá reiniciar.');
  };

  root.querySelector('#uploadBtn').onclick = async () => {
    const file = root.querySelector('#worldFile').files[0];
    if (!file) return;
    if (!confirm('Isto substitui o mundo atual. Continuar?')) return;
    const msg = root.querySelector('#upMsg');
    msg.textContent = 'Enviando...';
    const fd = new FormData();
    fd.append('world', file);
    const res = await fetch('/api/world/upload', { method: 'POST', body: fd });
    msg.textContent = res.ok ? 'Mundo importado. Servidor reiniciando.' : 'Falha: arquivo inválido.';
    msg.className = res.ok ? 'text-emerald-400 text-sm mt-1' : 'text-red-400 text-sm mt-1';
  };
}
```

- [ ] **Step 2: Manual check**

Download returns a valid zip; upload of a valid world zip replaces and restarts; regen wipes and restarts. Bad zip reports failure without corrupting the live world.

- [ ] **Step 3: Commit**

```bash
git add src/public/js/tabs/world.js
git commit -m "feat: add world tab (download/upload/regen)"
```

---

### Task 10.7: Map tab (configurable iframe)

**Files:**
- Create: `src/public/js/tabs/map.js`

**Interfaces:**
- Consumes: `GET /api/client-config` (returns `{ mapUrl }`).
- Produces: `renderMap(container)` → embeds `mapUrl` in an iframe; when empty, shows setup instructions.

- [ ] **Step 1: Implement the tab**

```js
// src/public/js/tabs/map.js
import { api } from '../socket.js';

export function renderMap(root) {
  root.innerHTML = `<div id="mapWrap">Carregando...</div>`;
  api('/api/client-config').then((cfg) => {
    const wrap = root.querySelector('#mapWrap');
    if (cfg?.mapUrl) {
      wrap.innerHTML = `<iframe src="${cfg.mapUrl}" class="w-full rounded" style="height:80vh;border:0"></iframe>`;
    } else {
      wrap.innerHTML = `
        <div class="bg-slate-800 p-6 rounded max-w-lg">
          <h3 class="font-bold mb-2">Mapa não configurado</h3>
          <p class="text-slate-300 text-sm">Instale um plugin de mapa (BlueMap ou Pl3xMap) no servidor
          e defina a variável <code>MAP_URL</code> apontando para ele. O serviço de mapa precisa
          permitir embedding (sem <code>X-Frame-Options: DENY</code>).</p>
        </div>`;
    }
  });
}
```

- [ ] **Step 2: Manual check**

With `MAP_URL` set: iframe loads the map. Without it: instructions show.

- [ ] **Step 3: Commit**

```bash
git add src/public/js/tabs/map.js
git commit -m "feat: add map tab with configurable iframe"
```

---

# PHASE 11 — Deploy Artifacts & Verification

### Task 11.1: Dockerfile + compose + README

**Files:**
- Create: `Dockerfile`, `docker-compose.example.yaml`, `README.md`

**Interfaces:**
- Produces: container image build + reference deployment + documented prerequisites.

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/main.js"]
```

- [ ] **Step 2: Create `docker-compose.example.yaml`**

```yaml
services:
  craftdock-panel:
    image: craftdock-panel:latest
    container_name: craftdock-panel
    ports:
      - "3000:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./panel-data:/app/data
      - mc-data:/minecraft/data
    environment:
      - NODE_ENV=production
      - ADMIN_PASSWORD_HASH=${ADMIN_PASSWORD_HASH}
      - SESSION_SECRET=${SESSION_SECRET}
      - MC_CONTAINER_NAME=craftdock-mc-server
      - MC_DATA_PATH=/minecraft/data
      - MC_EDITION=auto
      - RCON_HOST=craftdock-mc-server
      - RCON_PASSWORD=${RCON_PASSWORD}
      - MAP_URL=${MAP_URL}
    networks: [craftdock-net]
    restart: unless-stopped

  minecraft-server:
    image: itzg/minecraft-server:latest   # or itzg/minecraft-bedrock-server
    container_name: craftdock-mc-server
    ports:
      - "25565:25565"
      - "19132:19132/udp"
    volumes:
      - mc-data:/data
    environment:
      - EULA=TRUE
      - ENABLE_RCON=true
      - RCON_PASSWORD=${RCON_PASSWORD}
      - OVERRIDE_SERVER_PROPERTIES=false
      - TYPE=PAPER
      - VERSION=LATEST
    networks: [craftdock-net]
    restart: unless-stopped

volumes:
  mc-data:
networks:
  craftdock-net:
    driver: bridge
```

- [ ] **Step 3: Create `README.md`**

````markdown
# CraftDock

Lightweight self-hosted panel to manage a single Minecraft server (Java or Bedrock) via Docker.

## Prerequisites (deploy)

1. Minecraft service must set `OVERRIDE_SERVER_PROPERTIES=false`, else the Options tab won't persist.
2. Java servers: `ENABLE_RCON=true` + a shared `RCON_PASSWORD`.
3. Panel and MC server on the **same Docker network**.
4. The `mc-data` volume shared between panel and MC server.
5. Generate an admin password hash: `npm run hash -- <your-password>` → set as `ADMIN_PASSWORD_HASH`.
6. (Optional) Set `MAP_URL` for the Map tab; the map service must allow iframe embedding.

## Editions

- **Java** uses RCON — all player controls work (whitelist/ban/op/give/gamemode/kick/tp).
- **Bedrock** uses container stdin — `allowlist` instead of `whitelist`, and **ban/pardon are unavailable** (hidden in the UI).

## Development

```bash
cp .env.example .env   # fill ADMIN_PASSWORD_HASH, SESSION_SECRET, RCON_PASSWORD
npm install
npm test
npm run dev
```
````

- [ ] **Step 4: Build the image to verify the Dockerfile**

Run: `docker build -t craftdock-panel:latest .`
Expected: image builds successfully.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.example.yaml README.md
git commit -m "chore: add Dockerfile, reference compose, and README"
```

---

### Task 11.2: Full-suite verification + end-to-end smoke

**Files:**
- None (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: all suites PASS.

- [ ] **Step 2: Bring up the reference stack**

Run:
```bash
export ADMIN_PASSWORD_HASH=$(npm run hash -- testpass | tail -1)
export SESSION_SECRET=devsecret RCON_PASSWORD=devrcon
docker compose -f docker-compose.example.yaml up -d --build
```
Expected: both containers start; `craftdock-panel` reachable at `http://localhost:3000`.

- [ ] **Step 3: Manually validate each tab (Java)**

Walk through: login → Início (start server, watch stats) → Console (`list`) → Jogadores (whitelist/op) → Opções (change difficulty, restart, confirm persisted) → Mundo (download zip) → Mapa (instructions or iframe).
Expected: every tab behaves per its spec.

- [ ] **Step 4: (If available) validate Bedrock**

Swap the MC service to `itzg/minecraft-bedrock-server` with `TYPE`/edition Bedrock; confirm ban controls are hidden and `allowlist` works.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verified full stack end-to-end" --allow-empty
```

---

## Self-Review Notes (coverage map)

- **Auth (§6 spec):** Tasks 1.1–1.3, middleware wired in 9.1, socket auth in 8.3. ✔
- **ServerAdapter / editions (§3):** Tasks 3.3–3.6, appState 4.1. ✔
- **dockerService (§4):** Tasks 2.1–2.3. ✔
- **Tab A Status:** routes 5.1, socket 8.2, UI 10.2. ✔
- **Tab B Console:** socket 8.1, UI 10.3. ✔
- **Tab C Players:** routes 5.2, UI 10.4. ✔
- **Tab D Options:** service 6.1, routes 6.2, UI 10.5. ✔
- **Tab E World:** service 7.1–7.3, routes 7.4, UI 10.6. ✔
- **Tab F Map:** client-config in 9.1, UI 10.7. ✔
- **Deploy prereqs (§13):** Task 11.1. ✔

---

## Out of Scope (YAGNI / future)

- Runtime `TYPE`/`VERSION` switching (container recreation).
- Multi-server / multi-instance.
- Multi-user / RBAC.
- Automatic map-plugin installation.
- Native Bedrock ban via command.

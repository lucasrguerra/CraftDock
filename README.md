# CraftDock

Lightweight, self-hosted web panel to manage a **single** Minecraft server (Java *or* Bedrock) running as a Docker container — an Aternos-style dashboard you host yourself. Built for a Docker/Coolify deployment.

The panel never modifies the Minecraft core. It controls the game container over the Docker socket (start/stop/restart/kill, stats, logs) and sends commands through **RCON** (Java) or **container stdin** (Bedrock).

---

## Features

| Tab | What it does |
|-----|--------------|
| **Início / Status** | Start / Stop / Restart / Kill, live CPU / RAM / player count, edition badge |
| **Console** | Real-time log stream over WebSocket + command input (RCON / stdin) |
| **Jogadores** | Online list, whitelist / ban / op management, per-player kick & teleport — controls adapt to what the edition supports |
| **Opções** | Friendly editor for `server.properties` (difficulty, PvP, max-players, gamemode, …) |
| **Mundo** | Download the world as `.zip`, upload/replace a world, regenerate a new world |
| **Mapa** | Shows the world seed and embeds a seed map (mcseedmap.net) rendered for that seed |

---

## Editions

CraftDock supports both Minecraft editions through an adapter layer, but they are **not** equivalent:

- **Java** — commands go over **RCON**. All player controls work: whitelist, ban/pardon, op/deop, give, gamemode, kick, teleport.
- **Bedrock** — commands go over the container's **stdin** (`docker attach`). `whitelist` becomes `allowlist`, and **ban / pardon have no native command** — those buttons are hidden in the UI.

The edition is detected from the container's `TYPE` env var when `MC_EDITION=auto`, or forced with `MC_EDITION=java|bedrock`.

---

## Live map & seed

The Map tab shows the world seed and embeds [mcseedmap.net](https://mcseedmap.net) pointed at it (a real biome/structure map that allows iframe embedding). The seed is resolved automatically:

1. `level-seed` from `server.properties` (when the operator set a fixed seed), else
2. **Bedrock** — read from `worlds/<level-name>/level.dat` (the `RandomSeed` NBT long). Bedrock has **no** `seed` console command, so this is the only reliable source.
3. **Java** — the `seed` command over RCON.

The mcseedmap version segment defaults per edition; override it with `MAP_VERSION` (e.g. `1.21-Java`, `26.30.0-Bedrock`) if the biomes don't match your server version.

---

## Logging

The panel emits structured JSON logs (one record per line: `ts`, `level`, `component`, `msg`, optional `meta`) to stdout. Level is controlled by `LOG_LEVEL` (`error` < `warn` < `info` < `debug`; default `info`). Command channels (RCON / stdin), seed resolution, HTTP requests, and unhandled errors are all logged — run with `LOG_LEVEL=debug` to see every command sent to the server and its response.

```bash
docker compose -f docker-compose.bedrock.yaml logs -f    # follow panel + server logs
```

---

## Requirements

- **Node.js ≥ 18** (dev) or Docker (deploy).
- A Docker host — the panel mounts `/var/run/docker.sock` to control the game container.

---

## Quick start (local development)

```bash
git clone <repo> && cd CraftDock
npm install

# 1. Generate the admin password hash (prints a raw and a base64 line):
npm run hash -- <your-password>

# 2. Create .env from the template and fill it in:
cp .env.example .env
#    - ADMIN_PASSWORD_HASH = the raw hash line from step 1 (best for `npm run dev`)
#    - SESSION_SECRET      = any long random string
#    - RCON_PASSWORD       = your server's RCON password (leave empty for Bedrock)

# 3. Run the tests and start the dev server:
npm test
npm run dev            # loads .env automatically, hot-reloads on change
```

Open <http://localhost:3000> and log in with your password.

> `npm run dev` uses `node --env-file=.env`, so your `.env` is loaded automatically.
> `npm start` (production) does **not** load `.env` — it reads real environment
> variables provided by the container/host.

---

## Running with Docker

The panel image is built locally from the included `Dockerfile` — it is **not** published to any registry, so a plain `docker compose pull`/`up` without a build step fails with *"pull access denied"*. Always build it:

Two reference stacks are provided:

### Java (`docker-compose.java.yaml`)

```bash
# secrets are read from .env by docker compose (${ADMIN_PASSWORD_HASH}, etc.)
docker compose -f docker-compose.java.yaml up -d --build
docker compose -f docker-compose.java.yaml logs -f
```

### Bedrock (`docker-compose.bedrock.yaml`)

```bash
docker compose -f docker-compose.bedrock.yaml up -d --build
docker compose -f docker-compose.bedrock.yaml logs -f
```

Both stacks share the **same** panel env block (only the edition, world folder and
Minecraft image differ) and read their values from `.env` — see [`.env.example`](.env.example)
for the canonical list.

> **The panel uses `expose`, not a host port.** These stacks target a reverse proxy
> (Coolify/Traefik routes your domain to port 3000). For **local** `docker compose`
> testing without a proxy, uncomment the `ports: ["3000:3000"]` line in the compose
> and set `NODE_ENV=development` in `.env`, then open <http://localhost:3000>.
> (For everyday local work, `npm run dev` is simpler and needs no compose.)

> **Rebuild after changing panel code:** `--build` is required the first time and
> whenever you change the panel source. A runtime-only change (env var) just needs
> `up -d --force-recreate`.

> **First Bedrock boot is slow** — `itzg/minecraft-bedrock-server` downloads the
> latest version. Watch the logs until you see the server report it has started.

---

## Deployment prerequisites (Coolify / production)

The panel controls an existing, **fixed** container — it never recreates it or changes `TYPE`/`VERSION`. For everything to work, the Minecraft service must be configured as follows:

1. **`stdin_open: true` and `tty: true`** on the Minecraft service. Without a TTY, Docker returns a *multiplexed* log stream (8-byte frame headers) that garbles the Console tab, and stdin (the Bedrock command channel) never reaches the server process.
2. **`OVERRIDE_SERVER_PROPERTIES=false`**, otherwise the `itzg` image regenerates `server.properties` from env vars on every start and the Options tab won't persist.
3. **Java only:** `ENABLE_RCON=true` + a shared `RCON_PASSWORD`.
4. Panel and Minecraft server on the **same Docker network**.
5. The `mc-data` volume **shared** between the panel and the Minecraft server (the panel reads/writes world files directly).
6. Set `ADMIN_PASSWORD_HASH_B64` (the base64 line from `npm run hash`) and a strong `SESSION_SECRET`. Prefer the base64 form here — a raw bcrypt hash's `$` chars get mangled by docker compose / Coolify interpolation.
7. Run the panel with **`NODE_ENV=production`** so the session cookie is marked `secure` — this requires serving the panel over **HTTPS** (Coolify/Traefik terminate TLS on 443). The app already calls `trust proxy`, so the secure cookie works correctly behind the reverse proxy.
8. *(Optional)* Set `MAP_VERSION` if the Map tab's mcseedmap version doesn't match your server.

---

## Environment variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `ADMIN_PASSWORD_HASH` | ✅¹ | — | Raw bcrypt hash (`npm run hash -- <pw>`). Best for `npm run dev` |
| `ADMIN_PASSWORD_HASH_B64` | ✅¹ | — | Base64 of the bcrypt hash. Best for docker compose / Coolify (no `$` escaping) |
| `SESSION_SECRET` | ✅ | — | Long random string signing the session cookie |
| `MC_CONTAINER_NAME` | | `craftdock-mc-server` | Minecraft container name (matched first) |
| `MC_SERVICE_NAME` | | `minecraft-server` | Compose service name — fallback match when the container name is auto-generated (e.g. Coolify) |
| `MC_DATA_PATH` | | `/minecraft/data` | Path (inside the panel) to the shared MC data volume |
| `MC_EDITION` | | `auto` | `auto` \| `java` \| `bedrock` |
| `MC_WORLD_NAME` | | `world` | World folder under `MC_DATA_PATH` (Bedrock: `worlds`) |
| `RCON_HOST` | | `craftdock-mc-server` | RCON host (Java) |
| `RCON_PORT` | | `25575` | RCON port (Java) |
| `RCON_PASSWORD` | | *(empty)* | RCON password — **required for Java**, leave empty for Bedrock |
| `MAP_VERSION` | | *(per edition)* | mcseedmap version segment override (e.g. `1.21-Java`, `26.30.0-Bedrock`) |
| `PORT` | | `3000` | Port the panel listens on |
| `NODE_ENV` | | `development` | `production` marks the session cookie `secure` (needs HTTPS) |
| `LOG_LEVEL` | | `info` | `error` \| `warn` \| `info` \| `debug` |
| `MAX_UPLOAD_MB` | | `1024` | Max world upload size (MB) |

¹ Provide **one** of `ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD_HASH_B64`. `npm run hash -- <pw>` prints both; the raw hash wins if both are set.

---

## Security notes

- The panel mounts the Docker socket, which is **equivalent to root on the host**. Never expose it unauthenticated. Access is gated by a single admin password (bcrypt) with a signed session, enforced on every `/api/*` route **and** the Socket.io handshake.
- Always serve the panel over **HTTPS** in production (secure session cookie).
- Keep `SESSION_SECRET` secret and unique per deployment.

---

## Troubleshooting

**`pull access denied for craftdock-panel` on `docker compose up`**
The panel image is built locally, not pulled. Add `--build`: `docker compose up -d --build`.

**`failed to bind host port 0.0.0.0:3000: address already in use`**
Something else is on port 3000 — usually a leftover `npm run dev`. Find and stop it:
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen        # find the PID
Stop-Process -Id <PID> -Force                             # stop it
```
Then bring the stack up again.

**`ERR_CONNECTION_REFUSED` even though the panel logs "listening on :3000"**
The container is listening internally but the host port wasn't published — typically a container that was *created* during a failed port-bind and then only restarted. Recreate it:
```bash
docker compose -f <compose-file> down
docker compose -f <compose-file> up -d --force-recreate
```
Confirm the host is listening: `Get-NetTCPConnection -LocalPort 3000 -State Listen`.

**Login succeeds (no error) but the page stays on the login screen**
The session cookie isn't being stored. It's marked `secure` (from `NODE_ENV=production`) while you're on plain `http://localhost` — browsers drop secure cookies over HTTP. For local HTTP testing set `NODE_ENV=development`; in production serve over HTTPS. (Behind a reverse proxy, the app already trusts `X-Forwarded-Proto` via `trust proxy`.)

**Console tab shows garbled/binary characters**
The Minecraft container is missing `stdin_open: true` + `tty: true`. Add both and recreate it.

**Options tab changes don't persist after restart**
The Minecraft service is missing `OVERRIDE_SERVER_PROPERTIES=false`.

**Coolify: `Bind for 0.0.0.0:3000 failed: port is already allocated`**
Don't publish the panel's port on the host under Coolify — its Traefik reaches the container over the network. Use `expose: ["3000"]` (not `ports:`) on `craftdock-panel` and set the service **domain** in Coolify pointing to port **3000**. Keep `ports:` only on the Minecraft service (the raw game port).

**Coolify / docker compose: login fails, or warning `The "…" variable is not set. Defaulting to a blank string.`**
The `…` is the tail of your bcrypt hash — bcrypt hashes contain `$`, which docker compose interprets as variable interpolation, corrupting the hash. **Use `ADMIN_PASSWORD_HASH_B64`** (the base64 line from `npm run hash`) instead of the raw `ADMIN_PASSWORD_HASH` — base64 has no `$`, so nothing gets mangled. (Alternatively, keep the raw hash but escape every `$` as `$$`.)

**Status shows `not_found` on Coolify (panel can't see the server)**
Coolify ignores `container_name` and auto-generates names like `minecraft-server-<project>-<hash>`, so matching by `MC_CONTAINER_NAME` fails. The panel falls back to the compose **service** name — make sure the Minecraft service is named `minecraft-server` (or set `MC_SERVICE_NAME` to match) and that both services are in the **same** Coolify resource (project). The panel also needs the Docker socket mounted (`/var/run/docker.sock`).

**Map tab shows "waiting for seed" / no map**
The seed is resolved only while the server is **running**. For Bedrock it comes from `worlds/<level-name>/level.dat`, so the `mc-data` volume must be shared with the panel.

---

## Development

```bash
npm test          # run the full Vitest suite
npm run test:watch
npm run dev       # start with --env-file=.env and --watch
```

### Project layout

```
src/
├── server.js          # Express + Socket.io composition
├── main.js            # composition root (wires real dependencies)
├── config.js          # env var loading + validation
├── logger.js          # structured JSON logger
├── appState.js        # cached edition/adapter resolution
├── middleware/        # auth (HTTP + socket handshake)
├── services/          # docker, rcon, stdin, properties, world, auth, seed
├── adapters/          # ServerAdapter: java (RCON) / bedrock (stdin)
├── routes/            # auth, status, players, properties, world
├── sockets/           # logs stream + status push namespaces
└── public/            # vanilla-JS tabbed SPA (Tailwind via CDN)
```

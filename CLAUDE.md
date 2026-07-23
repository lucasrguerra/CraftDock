# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What CraftDock is

A lightweight, self-hosted web panel that manages a **single** Minecraft server (Java *or* Bedrock) running as a Docker container. Node.js + Express + Socket.io backend, vanilla-JS tabbed SPA frontend (Tailwind via CDN). The panel never modifies the Minecraft core: it controls the game container over the Docker socket and sends commands via RCON (Java) or container stdin (Bedrock).

## Commands

```bash
npm test              # full Vitest suite — must pass before any commit
npm run test:watch
npm run dev           # dev server (loads .env, watches files), panel on :8081
npm run hash -- <pw>  # generate the admin bcrypt hash (raw + base64 forms)
docker compose -f docker-compose.bedrock.yaml up -d --build   # full Bedrock stack
docker compose -f docker-compose.java.yaml up -d --build      # full Java stack
```

Run a single test file: `npx vitest run test/services/playerDetailService.test.js`.

## Git workflow (mandatory)

- **One numbered branch per feature/fix**: `feature/N-slug` or `fix/N-slug`, where N is sequential across the repo (check `git branch -a` for the highest existing N).
- **Every commit message is prefixed with the branch number**: `#N: message` (e.g. `#10: resolve Bedrock player detail via player_<uuid> ServerId mapping`). This makes it trivial to see which branch a change came from.
- **Merge into `main` with `--no-ff`** so the graph shows one merge bubble per feature. Never commit directly to `main`.
- **Squash small commits**: repeated touch-ups to the same file or tiny adjustments belong inside one larger, complete commit — don't inflate the tree.
- Messages in English, imperative, descriptive of the *why* when non-obvious.

## Architecture

### Composition root + dependency injection

`src/main.js` is the only place that wires real dependencies; `src/server.js` composes the Express app + Socket.io namespaces from injected pieces. Every service/route/adapter is a **factory function taking its collaborators as arguments** (`createXxx({ dep1, dep2 })`), so unit tests inject fakes — never module-level singletons for anything that touches I/O.

### Layers

```
src/
├── main.js            # composition root (real deps wired here, and only here)
├── server.js          # Express + Socket.io composition (takes deps)
├── config.js          # env loading + validation (single source of env truth)
├── logger.js          # structured JSON logger (ts/level/component/msg/meta)
├── appState.js        # cached edition detection + adapter resolution
├── middleware/auth.js # session auth for HTTP routes AND socket handshake
├── adapters/          # ServerAdapter interface: java (RCON) / bedrock (stdin)
│   └── playerFile/    # read-only world-save readers (see below)
├── services/          # docker, rcon, stdin, properties, world, seed, auth,
│                      # playerDirectory, playerDetailService, bedrockIdentityBridge
├── routes/            # auth, status, players, properties, world (Express routers)
├── sockets/           # logs stream + status push namespaces
└── public/            # vanilla-JS SPA: js/app.js shell + js/tabs/*.js (one file per tab)
```

### The adapter pattern (edition differences)

`ServerAdapter` abstracts the two editions behind one interface. Capability differences are declared, not special-cased in routes/UI:

| | Java | Bedrock |
|---|---|---|
| Command channel | RCON (`rconService`) | container stdin via `docker attach` (`stdinService`) |
| whitelist | `whitelist ...` | `allowlist ...` |
| ban/pardon | supported | **no native command** → `NotSupportedError`, buttons hidden |
| seed | `seed` command | **no command** — read `RandomSeed` from `level.dat` (`seedService`) |
| save snapshot | `save-all flush` | `save hold` → poll `save query` → read → `save resume` |

The frontend gets `capabilities` from `/api/players` and only renders controls the edition supports. When adding a command, add it to both adapters (or throw `NotSupportedError`) and update `CAPABILITIES` in `serverAdapter.js`.

### Player data: read-only from world saves

**Rule: ALL player data (position, health, food, inventory, gamemode, XP) is read directly from the world save files, read-only — never via console commands.** Per-edition file adapters in `src/adapters/playerFile/`:

- `nbtPlayer.js` — normalizes decoded NBT into one edition-agnostic `PlayerData` shape.
- `javaPlayerFile.js` — reads `world/playerdata/<uuid>.dat` (gzip NBT, big-endian).
- `bedrockPlayerFile.js` — reads the world **LevelDB** (`leveldb-zlib`, Mojang variant, little-endian NBT).

While the server runs, reads happen inside a save snapshot (`save hold`/`save-all flush`) orchestrated by `playerDetailService` — never open the live LevelDB without it.

### Bedrock identity model (critical, hard-won knowledge)

Bedrock never stores the gamertag or XUID readably inside the world DB. Three identity layers exist:

1. **XUID + gamertag** — only appear in the server log (`Player Spawned: <name> xuid: <n>`). `playerDirectory.js` scans docker logs for these lines and persists an XUID-keyed directory at `<dataRoot>/craftdock_players.json` (Java seeds from `usercache.json` instead).
2. **`uniqueId` UUID** (MsaId/SelfSignedId) — returned by the `querytarget` console command for an *online* player. ⚠️ `querytarget` also returns an int64 `id` (the entity UniqueID); do not confuse the two.
3. **LevelDB records** — `player_<uuid>` mapping records (keyed by MsaId or SelfSignedId) whose NBT `ServerId` field points to the actual data record `player_server_<leveldb-uuid>`.

`bedrockIdentityBridge.js` learns and persists the XUID → leveldbUuid binding at `<dataRoot>/craftdock_bedrock_ids.json` (learned once while the player is online, works offline forever after). Resolution order in `bedrockPlayerFile.findByUniqueId`: direct `player_<uuid>` mapping lookup first, NBT `UniqueID` scan as fallback.

### Properties (Options tab)

`PROPERTY_SCHEMA` in `src/routes/properties.js` is the single source of managed keys: type-based validation on PUT **and** vanilla defaults merged into GET (so the UI always starts fully populated; `motd` deliberately has no default). The frontend `options.js` renders from its own `CATEGORIES` list — when adding a property, update both the schema (backend) and CATEGORIES (frontend).

### CraftDock metadata files

Panel-owned files live at the data root, siblings of the world, so they ride along in world exports/backups: `craftdock_players.json` (XUID directory), `craftdock_bedrock_ids.json` (identity bridge).

## Testing rules

- **Vitest**, tests mirror `src/` under `test/`. TDD: write the failing test before the fix/feature.
- Unit tests inject fake collaborators (plain objects with `vi.fn()`); route tests use `supertest` against a minimal Express app.
- `test/fixtures/bedrock-player.nbt` is a **real captured Bedrock player NBT**; the bedrockPlayerFile tests build a real LevelDB in a temp dir around it. Prefer real-format fixtures over hand-mocked parsing.
- The whole suite must stay green (`npm test`) before committing.

## Environment & deployment facts

- Panel listens on **8081** (config default; composes publish `8081:8081`).
- Auth: single admin password; prefer `ADMIN_PASSWORD_HASH_B64` under docker compose/Coolify (bcrypt `$` gets eaten by interpolation). `SESSION_SECRET` signs the cookie; `NODE_ENV=production` marks it `secure` (needs HTTPS).
- The Minecraft service **must** have `stdin_open: true` + `tty: true` (stdin channel + non-multiplexed logs) and `OVERRIDE_SERVER_PROPERTIES=false` (so the Options tab persists).
- The `mc-data` volume is shared panel ↔ game container; `MC_DATA_PATH` points at it inside the panel.
- Edition: `MC_EDITION=auto|java|bedrock` (auto reads the container's `TYPE` env). `MC_WORLD_NAME` is `world` (Java) / `worlds` (Bedrock).
- Local integration testing: the maintainer runs the stacks via **WSL docker**; the world lives in the `craftdock_mc-data` volume. To inspect real world data safely, stop the containers and copy it out (e.g. `docker run --rm -v craftdock_mc-data:/d alpine tar cf - -C /d worlds`).

## Code style

- ES modules (`"type": "module"`), Node ≥ 18, no build step, no TypeScript.
- Factory functions + closures over classes. Small focused files — split before a file grows into multiple responsibilities.
- Frontend: no framework, no bundler; each tab exports `render<Tab>(root)` and returns an optional cleanup function. Escape all user-derived strings with the local `esc()` before injecting into HTML.
- Comments explain *why*/constraints (protocol quirks, Bedrock oddities), not what the next line does.
- UI text is Brazilian Portuguese; code, comments and commits are English.

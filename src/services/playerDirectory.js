import fsp from 'node:fs/promises';
import path from 'node:path';
import { PLAYER_NAME_REGEX } from '../adapters/serverAdapter.js';

// A persistent XUID→name directory of players who REALLY accessed the world.
//
// Why not the world files directly? A Bedrock world is a compressed LevelDB that
// stores player data keyed by XUID with NO readable gamertag — the name only ever
// appears in the server log, at login. So we build the mapping from the log, but
// keyed by XUID (the canonical identity: survives renames, never duplicates) and
// persisted here so it outlives log rotation.
//
// "Really accessed" = a `Player Spawned` line. A player rejected by the allowlist
// gets a `Player connected` line but is disconnected BEFORE spawning, so keying on
// spawn is what excludes them (Scenario 1). Because entries are persisted, players
// who joined while the server was public stay listed even after an allowlist is
// later enabled and they're no longer on it (Scenario 2).
//
// File lives at the data root (sibling of allowlist.json) so it's bundled into the
// world export/backup, like the rest of CraftDock's metadata.

const FILE = 'craftdock_players.json';
const LEGACY_HISTORY = 'craftdock_players_history.json';

// Bedrock spawn line, e.g.
//   [2026-07-19 02:29:10:123 INFO] Player Spawned: Lucas Guerra xuid: 2535407895138987, pfid: ...
// Gamertags may contain spaces, so capture non-greedily up to " xuid:".
const SPAWN_RE = /Player Spawned:\s*(.+?)\s+xuid:\s*(\d+)/gi;

// Control chars docker interleaves as stream-framing bytes; strip them but keep
// newlines so log lines stay separated. Built from char codes to avoid embedding
// raw control bytes in source.
const CTRL_RE = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F-\\x9F]', 'g');

// Module-level cursor (single server instance): Unix seconds of the last log scan.
// First scan reads a bounded tail; later scans read only new lines via `since`, so
// the 2s status poll never re-parses the whole (ever-growing) container log.
let lastScanSec = 0;

function filePath(dataRoot) {
  return path.join(dataRoot, FILE);
}

export async function readDirectory(dataRoot) {
  try {
    const raw = await fsp.readFile(filePath(dataRoot), 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

async function writeDirectory(dataRoot, dir) {
  try {
    await fsp.writeFile(filePath(dataRoot), JSON.stringify(dir, null, 2), 'utf8');
  } catch { /* best-effort: a failed write just means we re-scan next tick */ }
}

// One-time import of the old name-only history array. Those entries have no XUID,
// so they're keyed `legacy:<name>` and superseded the first time the same name is
// seen spawning with a real XUID (see mergeSpawn).
async function migrateLegacy(dataRoot, dir) {
  const legacyPath = path.join(dataRoot, LEGACY_HISTORY);
  let names;
  try {
    names = JSON.parse(await fsp.readFile(legacyPath, 'utf8'));
  } catch {
    return false;
  }
  if (!Array.isArray(names)) { await fsp.rm(legacyPath, { force: true }).catch(() => {}); return false; }

  const known = new Set(Object.values(dir).map((e) => e.name));
  for (const name of names) {
    if (typeof name === 'string' && PLAYER_NAME_REGEX.test(name) && !known.has(name)) {
      dir[`legacy:${name}`] = { name, xuid: null, firstSeen: null, lastSeen: null };
      known.add(name);
    }
  }
  await fsp.rm(legacyPath, { force: true }).catch(() => {});
  return true;
}

// Merge one spawn (xuid + current name) into the directory. Returns true if the
// directory changed. Promotes any matching `legacy:<name>` placeholder to the real
// XUID-keyed entry.
function mergeSpawn(dir, xuid, name, nowIso) {
  if (!/^\d+$/.test(xuid) || !PLAYER_NAME_REGEX.test(name)) return false;

  const legacyKey = `legacy:${name}`;
  const hadLegacy = legacyKey in dir;
  if (hadLegacy) delete dir[legacyKey];

  const existing = dir[xuid];
  if (!existing) {
    dir[xuid] = { name, xuid, firstSeen: nowIso, lastSeen: nowIso };
    return true;
  }
  // Same identity: refresh the name (rename) and lastSeen.
  const renamed = existing.name !== name;
  existing.name = name;
  existing.lastSeen = nowIso;
  if (!existing.xuid) existing.xuid = xuid;
  return renamed || hadLegacy;
}

async function scanSpawns(dockerService, sinceSec) {
  const spawns = [];
  try {
    const container = await dockerService.getContainer();
    const opts = { stdout: true, stderr: true, follow: false };
    if (sinceSec) opts.since = sinceSec;
    else opts.tail = 2000;
    const buf = await container.logs(opts);
    const text = buf.toString('utf8').replace(CTRL_RE, '');
    let m;
    while ((m = SPAWN_RE.exec(text)) !== null) {
      spawns.push({ name: m[1].trim(), xuid: m[2] });
    }
    SPAWN_RE.lastIndex = 0;
  } catch { /* container gone / not ready — return what we have */ }
  return spawns;
}

// For Java, the world already carries name↔uuid in usercache.json (real world
// data), so seed the directory from it — no log scanning needed.
async function seedFromUsercache(dataRoot, dir, nowIso) {
  let changed = false;
  try {
    const cache = JSON.parse(await fsp.readFile(path.join(dataRoot, 'usercache.json'), 'utf8'));
    if (Array.isArray(cache)) {
      for (const e of cache) {
        if (e?.name && e?.uuid && PLAYER_NAME_REGEX.test(e.name) && !dir[e.uuid]) {
          dir[e.uuid] = { name: e.name, xuid: e.uuid, firstSeen: nowIso, lastSeen: nowIso };
          changed = true;
        }
      }
    }
  } catch { /* no usercache (Bedrock, or none yet) */ }
  return changed;
}

/**
 * Update and return the player directory as a flat, sorted list.
 * @returns {Promise<Array<{xuid: string|null, name: string, firstSeen: string|null, lastSeen: string|null}>>}
 */
export async function updatePlayerDirectory({ dataRoot, dockerService, edition }) {
  const dir = await readDirectory(dataRoot);
  const nowIso = new Date().toISOString();
  let changed = await migrateLegacy(dataRoot, dir);

  if (edition === 'java') {
    if (await seedFromUsercache(dataRoot, dir, nowIso)) changed = true;
  } else if (dockerService) {
    // Capture the cursor BEFORE scanning so lines written during the scan aren't
    // lost on the next pass.
    const nowSec = Math.floor(Date.now() / 1000);
    const spawns = await scanSpawns(dockerService, lastScanSec || undefined);
    lastScanSec = nowSec;
    for (const s of spawns) {
      if (mergeSpawn(dir, s.xuid, s.name, nowIso)) changed = true;
    }
  }

  if (changed) await writeDirectory(dataRoot, dir);
  return Object.values(dir).sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve an XUID to its current gamertag (Bedrock console commands are name-based). */
export async function resolveName(dataRoot, xuid) {
  const dir = await readDirectory(dataRoot);
  return dir[xuid]?.name || null;
}

/**
 * Server-side paginated + filtered view of the directory. Scales to very large
 * directories: the client fetches one page at a time instead of the whole list.
 * @returns {Promise<{ items: Array, total: number, page: number, pageSize: number }>}
 */
export async function queryDirectory(dataRoot, { page = 1, pageSize = 25, q = '' } = {}) {
  const dir = await readDirectory(dataRoot);
  const needle = String(q || '').trim().toLowerCase();
  let items = Object.values(dir);
  if (needle) items = items.filter((e) => e.name?.toLowerCase().includes(needle));
  items.sort((a, b) => a.name.localeCompare(b.name));

  const total = items.length;
  const size = Math.max(1, pageSize | 0);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page | 0), pageCount);
  const start = (current - 1) * size;
  return { items: items.slice(start, start + size), total, page: current, pageSize: size };
}

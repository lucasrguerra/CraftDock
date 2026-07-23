import fs from 'node:fs';
import path from 'node:path';
import pkg from 'leveldb-zlib';
import nbt from 'prismarine-nbt';
import { normalizeBedrock } from './nbtPlayer.js';

const { LevelDB, Iterator } = pkg;

const SERVER_PREFIX = 'player_server_';
const PLAYER_PREFIX = 'player_';

// Helper for matching uniqueId whether given as a decimal integer string or UUID format string
export function matchUniqueId(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const cleanA = String(a).replace(/-/g, '').toLowerCase();
  const cleanB = String(b).replace(/-/g, '').toLowerCase();
  if (cleanA === cleanB) return true;

  // Bedrock querytarget uniqueId can be a 128-bit UUID string or 64-bit int string / decimal
  // Compare low 64 bits or numeric BigInt representations if compatible
  try {
    const toBigInt = (str) => {
      const c = str.replace(/-/g, '');
      if (/^[0-9a-f]{32}$/i.test(c)) {
        // Take lower 64 bits of hex UUID
        const lowHex = c.slice(16);
        const big = BigInt('0x' + lowHex);
        const shift = 1n << 63n;
        const mask = (1n << 64n) - 1n;
        const val = big & mask;
        return val >= shift ? val - (1n << 64n) : val;
      }
      if (/^-?\d+$/.test(str)) {
        return BigInt(str);
      }
      return null;
    };
    const bigA = toBigInt(String(a));
    const bigB = toBigInt(String(b));
    if (bigA !== null && bigB !== null && bigA === bigB) return true;
  } catch { /* ignore parse error */ }

  return false;
}

// Parse one Bedrock player NBT value (little-endian) into PlayerData.
export async function parsePlayerBuffer(buf) {
  const { parsed } = await nbt.parse(Buffer.from(buf), 'little');
  return normalizeBedrock(nbt.simplify(parsed));
}

// Locate the world's LevelDB directory. Bedrock stores it at
// <mcDataPath>/<mcWorldName>/<Level Name>/db (CraftDock uses MC_WORLD_NAME=worlds
// with the actual level folder inside). Falls back to <mcDataPath>/<mcWorldName>/db.
export function resolveDbPath(config) {
  const base = path.join(config.mcDataPath, config.mcWorldName || 'worlds');
  try {
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'db'))) {
        return path.join(base, entry.name, 'db');
      }
    }
  } catch { /* base missing */ }
  const direct = path.join(base, 'db');
  return fs.existsSync(direct) ? direct : null;
}

export function createBedrockPlayerFile(config) {
  const latin1 = (b) => Buffer.from(b).toString('latin1');

  // Open read-only, run fn, always close. Ultra-light: one short-lived handle
  // per read. Concurrency with the running server is handled upstream by the
  // detail service issuing `save hold` before reading.
  async function withDb(fn) {
    const dbPath = resolveDbPath(config);
    if (!dbPath) return null;
    let db = null;
    try {
      db = new LevelDB(dbPath, { createIfMissing: false });
      let openTimer;
      const openPromise = db.open();
      const timeoutPromise = new Promise((_, reject) => {
        openTimer = setTimeout(() => reject(new Error('LevelDB open timeout')), 2000);
      });
      await Promise.race([openPromise, timeoutPromise]).finally(() => clearTimeout(openTimer));
      return await fn(db);
    } catch {
      return null;
    } finally {
      if (db) {
        try { await db.close(); } catch {}
      }
    }
  }


  async function readPlayer(uuid) {
    const data = await withDb(async (db) => {
      const val = await db.get(Buffer.from(SERVER_PREFIX + uuid, 'latin1'));
      return val ? parsePlayerBuffer(val) : null;
    });
    if (!data) return null;
    try {
      data.savedAt = fs.statSync(resolveDbPath(config)).mtime.toISOString();
    } catch { data.savedAt = null; }
    return data;
  }

  // The DB stores identity mapping records keyed player_<uuid> (uuid = MsaId or
  // SelfSignedId — querytarget's `uniqueId` is one of these) whose NBT holds
  // ServerId = "player_server_<leveldb uuid>". Direct lookup, no scan.
  async function resolveViaMapping(db, uniqueId) {
    if (!/^[0-9a-f-]{36}$/i.test(String(uniqueId))) return null;
    const val = await db.get(Buffer.from(PLAYER_PREFIX + String(uniqueId).toLowerCase(), 'latin1')).catch(() => null);
    if (!val) return null;
    try {
      const { parsed } = await nbt.parse(Buffer.from(val), 'little');
      const serverId = nbt.simplify(parsed)?.ServerId;
      if (typeof serverId === 'string' && serverId.startsWith(SERVER_PREFIX)) {
        return serverId.slice(SERVER_PREFIX.length);
      }
    } catch { /* not a mapping record */ }
    return null;
  }

  // Resolve a live uniqueId to its player_server_ record: first via the
  // player_<uuid> mapping record, then by scanning player_server_* entries for
  // a matching NBT UniqueID. NOTE the leveldb-zlib iterator yields [value, key].
  async function findByUniqueId(uniqueId) {
    const targetStr = String(uniqueId);
    return withDb(async (db) => {
      const mapped = await resolveViaMapping(db, targetStr);
      if (mapped) {
        const val = await db.get(Buffer.from(SERVER_PREFIX + mapped, 'latin1')).catch(() => null);
        return { uuid: mapped, data: val ? await parsePlayerBuffer(val) : null };
      }
      const iter = new Iterator(db, { keys: true, values: true });
      try {
        let e;
        while ((e = await iter.next()) != null) {
          const key = latin1(e[1]);
          if (!key.startsWith(SERVER_PREFIX)) continue;
          const data = await parsePlayerBuffer(e[0]);
          if (!data?.uniqueId) continue;
          
          if (
            data.uniqueId === targetStr ||
            matchUniqueId(data.uniqueId, targetStr)
          ) {
            return { uuid: key.slice(SERVER_PREFIX.length), data };
          }
        }
        return null;
      } finally {
        await iter.end();
      }
    });
  }

  async function listServerUuids() {
    return withDb(async (db) => {
      const iter = new Iterator(db, { keys: true, values: true });
      const out = [];
      try {
        let e;
        while ((e = await iter.next()) != null) {
          const key = latin1(e[1]); // tuple is [value, key]
          if (key.startsWith(SERVER_PREFIX)) out.push(key.slice(SERVER_PREFIX.length));
        }
        return out;
      } finally {
        await iter.end();
      }
    }) || [];
  }

  return { readPlayer, findByUniqueId, listServerUuids };
}

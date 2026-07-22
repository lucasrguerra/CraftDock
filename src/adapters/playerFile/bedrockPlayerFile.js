import fs from 'node:fs';
import path from 'node:path';
import pkg from 'leveldb-zlib';
import nbt from 'prismarine-nbt';
import { normalizeBedrock } from './nbtPlayer.js';

const { LevelDB, Iterator } = pkg;

const SERVER_PREFIX = 'player_server_';

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
    const db = new LevelDB(dbPath, { createIfMissing: false });
    await db.open();
    try {
      return await fn(db);
    } finally {
      await db.close();
    }
  }

  async function readPlayer(uuid) {
    return withDb(async (db) => {
      const val = await db.get(Buffer.from(SERVER_PREFIX + uuid, 'latin1'));
      if (!val) return null;
      return parsePlayerBuffer(val);
    });
  }

  // Scan player_server_* entries for the one whose UniqueID matches. NOTE the
  // leveldb-zlib iterator yields tuples as [value, key].
  async function findByUniqueId(uniqueId) {
    return withDb(async (db) => {
      const iter = new Iterator(db, { keys: true, values: true });
      try {
        let e;
        while ((e = await iter.next()) != null) {
          const key = latin1(e[1]);
          if (!key.startsWith(SERVER_PREFIX)) continue;
          const data = await parsePlayerBuffer(e[0]);
          if (data.uniqueId === String(uniqueId)) {
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

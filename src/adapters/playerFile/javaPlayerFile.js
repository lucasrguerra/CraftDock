import fsp from 'node:fs/promises';
import path from 'node:path';
import nbt from 'prismarine-nbt';
import { normalizeJava } from './nbtPlayer.js';

// Reads Java per-player save data from <world>/playerdata/<uuid>.dat (gzip'd
// big-endian NBT). `id` is the player UUID (from usercache.json).
export function createJavaPlayerFile(config) {
  const playerdataDir = path.join(config.mcDataPath, config.mcWorldName || 'world', 'playerdata');

  async function readPlayer(uuid) {
    const file = path.join(playerdataDir, `${uuid}.dat`);
    let buf, stat;
    try {
      buf = await fsp.readFile(file);
      stat = await fsp.stat(file);
    } catch {
      return null; // no save yet for this player
    }
    const { parsed } = await nbt.parse(buf); // auto-detects gzip + endianness
    return { ...normalizeJava(nbt.simplify(parsed)), savedAt: stat.mtime.toISOString() };
  }

  return { readPlayer };
}

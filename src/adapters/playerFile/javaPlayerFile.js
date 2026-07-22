import fsp from 'node:fs/promises';
import path from 'node:path';
import nbt from 'prismarine-nbt';
import { normalizeJava } from './nbtPlayer.js';

// Reads Java per-player save data from <world>/playerdata/<uuid>.dat (gzip'd
// big-endian NBT). `id` is the player UUID (from usercache.json).
export function createJavaPlayerFile(config) {
  const playerdataDir = path.join(config.mcDataPath, config.mcWorldName || 'world', 'playerdata');

  async function readPlayer(uuid) {
    let buf;
    try {
      buf = await fsp.readFile(path.join(playerdataDir, `${uuid}.dat`));
    } catch {
      return null; // no save yet for this player
    }
    const { parsed } = await nbt.parse(buf); // auto-detects gzip + endianness
    return normalizeJava(nbt.simplify(parsed));
  }

  return { readPlayer };
}

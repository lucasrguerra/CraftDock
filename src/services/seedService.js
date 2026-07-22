import fsp from 'node:fs/promises';
import path from 'node:path';

// MC data paths are always container (POSIX) paths, regardless of the host OS.
const posixJoin = path.posix.join;

// Bedrock stores the world seed in worlds/<level-name>/level.dat as a
// little-endian NBT Long named "RandomSeed" (there is NO `seed` console command
// on Bedrock — that is Java-only). The value bytes follow the tag name directly.
export function parseBedrockSeed(buffer) {
  const marker = Buffer.from('RandomSeed', 'utf8');
  const idx = buffer.indexOf(marker);
  if (idx === -1) return null;
  const valueOffset = idx + marker.length;
  if (valueOffset + 8 > buffer.length) return null;
  return buffer.readBigInt64LE(valueOffset).toString();
}

export function createSeedService({ config, propertiesService, fs = fsp, logger } = {}) {
  let cachedSeed = null;

  async function fromProperties() {
    try {
      const props = await propertiesService.read();
      const raw = props['level-seed'];
      if (raw != null && String(raw).trim() !== '') return String(raw).trim();
    } catch (err) {
      logger?.debug('seed: could not read server.properties', err);
    }
    return null;
  }

  async function bedrockLevelName() {
    try {
      const props = await propertiesService.read();
      if (props['level-name']) return props['level-name'];
    } catch { /* fall through to default */ }
    return 'Bedrock level';
  }

  async function fromBedrockLevelDat() {
    const levelName = await bedrockLevelName();
    const datPath = posixJoin(config.mcDataPath, 'worlds', levelName, 'level.dat');
    try {
      const seed = parseBedrockSeed(await fs.readFile(datPath));
      if (!seed) logger?.warn('seed: RandomSeed not found in level.dat', { datPath });
      return seed;
    } catch (err) {
      logger?.warn('seed: could not read bedrock level.dat', { datPath, error: err.message });
      return null;
    }
  }

  async function fromJavaCommand(adapter) {
    try {
      const seed = adapter?.getSeed ? await adapter.getSeed() : null;
      if (!seed) logger?.warn('seed: java command returned nothing');
      return seed;
    } catch (err) {
      logger?.warn('seed: java seed command failed', err);
      return null;
    }
  }

  // Resolves the world seed for the given edition. `level-seed` (a fixed seed set
  // by the operator) always wins; otherwise Bedrock reads level.dat and Java asks
  // the server over RCON.
  async function resolve(adapter, edition) {
    if (cachedSeed !== null) {
      return cachedSeed;
    }
    const fromProps = await fromProperties();
    if (fromProps) {
      logger?.debug('seed resolved from server.properties', { seed: fromProps });
      cachedSeed = fromProps;
      return fromProps;
    }
    const seed = edition === 'bedrock'
      ? await fromBedrockLevelDat()
      : await fromJavaCommand(adapter);
    logger?.info('seed resolved', { edition, seed });
    if (seed !== null) {
      cachedSeed = seed;
    }
    return seed;
  }

  function clearCache() {
    cachedSeed = null;
  }

  return { resolve, fromProperties, fromBedrockLevelDat, fromJavaCommand, clearCache };
}

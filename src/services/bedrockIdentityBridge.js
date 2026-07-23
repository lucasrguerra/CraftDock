import fsp from 'node:fs/promises';
import path from 'node:path';

// Persistent bridge between a Bedrock player's identity (numeric XUID + gamertag,
// known only from the log directory) and their LevelDB record (keyed by a
// self-signed UUID that never references the XUID). Learned while a player is
// online by matching the live entity `uniqueId` (from querytarget) to a LevelDB
// player's `UniqueID`; persisted so offline reads work forever afterwards.
//
// File: <dataRoot>/craftdock_bedrock_ids.json
//   { "<xuid>": { name, leveldbUuid, uniqueId, boundAt } }

const FILE = 'craftdock_bedrock_ids.json';

export function createBedrockIdentityBridge({ dataRoot, fileAdapter }) {
  const filePath = path.join(dataRoot, FILE);

  async function readMap() {
    try {
      const data = JSON.parse(await fsp.readFile(filePath, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
      return {};
    }
  }

  async function writeMap(map) {
    try {
      await fsp.writeFile(filePath, JSON.stringify(map, null, 2), 'utf8');
    } catch { /* best-effort */ }
  }

  // Bind xuid → LevelDB uuid using the live uniqueId or fallbackUuid.
  async function learn({ xuid, name, uniqueId, fallbackUuid }) {
    if (!xuid) return null;
    let targetUuid = fallbackUuid;
    if (!targetUuid && uniqueId != null) {
      const hit = await fileAdapter.findByUniqueId(String(uniqueId));
      if (hit) targetUuid = hit.uuid;
    }
    if (!targetUuid) return null;

    const map = await readMap();
    const binding = {
      name: name ?? map[xuid]?.name ?? null,
      leveldbUuid: targetUuid,
      uniqueId: uniqueId ? String(uniqueId) : (map[xuid]?.uniqueId || null),
      boundAt: new Date().toISOString(),
    };
    map[xuid] = binding;
    await writeMap(map);
    return binding;
  }


  async function resolveLeveldbUuid(xuid) {
    const map = await readMap();
    return map[xuid]?.leveldbUuid || null;
  }

  return { learn, resolveLeveldbUuid };
}

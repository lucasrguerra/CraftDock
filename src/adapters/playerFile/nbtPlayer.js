// Normalizes decoded player NBT (post `nbt.simplify`) into a stable, edition-
// agnostic PlayerData shape consumed by the detail service and the UI.
//
// PlayerData = {
//   position: { x, y, z } | null,
//   dimension: 'overworld' | 'nether' | 'end',
//   health: { current, max } | null,
//   food: number | null,
//   inventory: [ { slot, name, count } ],
//   gamemode: string | null,
//   xp: { level } | null,
//   uniqueId: string | null,   // Bedrock only — used by the identity bridge
// }

// prismarine-nbt represents a `long` as a [high32, low32] signed-int pair.
// Combine to a decimal string (matches Bedrock's querytarget uniqueId format).
export function int64ToString(v) {
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v) && v.length === 2) {
    const [hi, lo] = v;
    return (BigInt(hi) * (1n << 32n) + BigInt(lo >>> 0)).toString();
  }
  return v == null ? null : String(v);
}

function bedrockDimension(code) {
  return code === 1 ? 'nether' : code === 2 ? 'end' : 'overworld';
}

function javaDimension(dim) {
  const s = String(dim);
  if (s.includes('nether') || dim === -1) return 'nether';
  if (s.includes('end') || dim === 1) return 'end';
  return 'overworld';
}

const BEDROCK_GAMEMODE = { 0: 'survival', 1: 'creative', 2: 'adventure', 5: 'default', 6: 'spectator' };
const JAVA_GAMEMODE = { 0: 'survival', 1: 'creative', 2: 'adventure', 3: 'spectator' };

function pos(arr) {
  return Array.isArray(arr) && arr.length === 3
    ? { x: arr[0], y: arr[1], z: arr[2] }
    : null;
}

export function normalizeBedrock(s = {}) {
  const attr = (name) => (s.Attributes || []).find((a) => a.Name === name);
  const hp = attr('minecraft:health');
  const hunger = attr('minecraft:player.hunger');
  return {
    position: pos(s.Pos),
    dimension: bedrockDimension(s.DimensionId),
    health: hp ? { current: hp.Current, max: hp.Max } : null,
    food: hunger ? hunger.Current : null,
    inventory: (s.Inventory || [])
      .filter((i) => i && i.Name)
      .map((i) => ({ slot: i.Slot, name: i.Name, count: i.Count })),
    gamemode: BEDROCK_GAMEMODE[s.PlayerGameMode] ?? null,
    xp: typeof s.PlayerLevel === 'number' ? { level: s.PlayerLevel } : null,
    uniqueId: 'UniqueID' in s ? int64ToString(s.UniqueID) : null,
  };
}

export function normalizeJava(s = {}) {
  return {
    position: pos(s.Pos),
    dimension: javaDimension(s.Dimension),
    health: typeof s.Health === 'number' ? { current: s.Health, max: 20 } : null,
    food: typeof s.foodLevel === 'number' ? s.foodLevel : null,
    inventory: (s.Inventory || [])
      .filter((i) => i && i.id)
      .map((i) => ({ slot: i.Slot, name: i.id, count: i.Count })),
    gamemode: JAVA_GAMEMODE[s.playerGameType] ?? null,
    xp: typeof s.XpLevel === 'number' ? { level: s.XpLevel } : null,
    uniqueId: null,
  };
}

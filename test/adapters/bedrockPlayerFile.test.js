import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'leveldb-zlib';
import nbt from 'prismarine-nbt';
import { createBedrockPlayerFile, parsePlayerBuffer } from '../../src/adapters/playerFile/bedrockPlayerFile.js';

const { LevelDB } = pkg;
const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, '../fixtures/bedrock-player.nbt');
const UUID = '1f633c09-f1f1-481c-b811-1cfa15b21973';
// Real-world shape: querytarget's uniqueId is the player's MsaId, and the DB
// holds a mapping record player_<MsaId> → { MsaId, SelfSignedId, ServerId }.
const MSA_ID = '657cb1d4-99dd-3123-b27f-d0c27df79710';
const SELF_SIGNED_ID = 'a257319c-50e9-3aad-aef3-8fc3e0d4e4c2';

function mappingRecord() {
  const str = (v) => ({ type: 'string', value: v });
  return nbt.writeUncompressed({
    type: 'compound',
    name: '',
    value: {
      MsaId: str(MSA_ID),
      SelfSignedId: str(SELF_SIGNED_ID),
      ServerId: str('player_server_' + UUID),
    },
  }, 'little');
}

let tmp, config;

beforeAll(async () => {
  const buf = fs.readFileSync(FIXTURE);
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'cd-bpf-'));
  const dbPath = path.join(tmp, 'worlds', 'Bedrock level', 'db');
  await fsp.mkdir(dbPath, { recursive: true });
  // Build a real (Mojang-format) LevelDB holding the captured player NBT.
  const db = new LevelDB(dbPath, { createIfMissing: true });
  await db.open();
  await db.put(Buffer.from('player_server_' + UUID, 'latin1'), buf);
  await db.put(Buffer.from('player_' + MSA_ID, 'latin1'), mappingRecord());
  await db.put(Buffer.from('player_' + SELF_SIGNED_ID, 'latin1'), mappingRecord());
  await db.close();
  config = { mcDataPath: tmp, mcWorldName: 'worlds' };
});

afterAll(async () => { await fsp.rm(tmp, { recursive: true, force: true }); });

describe('bedrockPlayerFile', () => {
  it('parsePlayerBuffer decodes the captured real-world fixture', async () => {
    const d = await parsePlayerBuffer(fs.readFileSync(FIXTURE));
    expect(d.position).not.toBeNull();
    expect(d.health.max).toBe(20);
    expect(typeof d.food).toBe('number');
    expect(Array.isArray(d.inventory)).toBe(true);
    expect(d.uniqueId).toBe('-8589934591');
  });

  it('readPlayer returns normalized data for an existing uuid', async () => {
    const adapter = createBedrockPlayerFile(config);
    const d = await adapter.readPlayer(UUID);
    expect(d.uniqueId).toBe('-8589934591');
    expect(d.position).not.toBeNull();
  });

  it('readPlayer returns null for a missing uuid', async () => {
    const adapter = createBedrockPlayerFile(config);
    expect(await adapter.readPlayer('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('findByUniqueId locates the player by UniqueID (int64 or UUID string format)', async () => {
    const adapter = createBedrockPlayerFile(config);
    const hit = await adapter.findByUniqueId('-8589934591');
    expect(hit).not.toBeNull();
    expect(hit.uuid).toBe(UUID);

    // Modern Bedrock servers output uniqueId in UUID hex string format via querytarget:
    // e.g. "657cb1d4-99dd-3123-b27f-d0c27df79710" or corresponding int64 (-8589934591)
    const hit2 = await adapter.findByUniqueId('00000000-0000-0000-ffff-fffe00000001');
    expect(hit2).not.toBeNull();
    expect(hit2.uuid).toBe(UUID);
  });

  it('findByUniqueId resolves via the player_<uuid> ServerId mapping record', async () => {
    const adapter = createBedrockPlayerFile(config);
    // querytarget uniqueId (= MsaId) — the case seen against a live server
    const hit = await adapter.findByUniqueId(MSA_ID);
    expect(hit).not.toBeNull();
    expect(hit.uuid).toBe(UUID);
    // SelfSignedId mapping record also resolves
    const hit2 = await adapter.findByUniqueId(SELF_SIGNED_ID);
    expect(hit2.uuid).toBe(UUID);
  });

  it('listServerUuids enumerates player_server_ keys', async () => {
    const adapter = createBedrockPlayerFile(config);
    expect(await adapter.listServerUuids()).toContain(UUID);
  });
});

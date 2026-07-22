import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'leveldb-zlib';
import { createBedrockPlayerFile, parsePlayerBuffer } from '../../src/adapters/playerFile/bedrockPlayerFile.js';

const { LevelDB } = pkg;
const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, '../fixtures/bedrock-player.nbt');
const UUID = '1f633c09-f1f1-481c-b811-1cfa15b21973';

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

  it('findByUniqueId locates the player by UniqueID', async () => {
    const adapter = createBedrockPlayerFile(config);
    const hit = await adapter.findByUniqueId('-8589934591');
    expect(hit).not.toBeNull();
    expect(hit.uuid).toBe(UUID);
  });

  it('listServerUuids enumerates player_server_ keys', async () => {
    const adapter = createBedrockPlayerFile(config);
    expect(await adapter.listServerUuids()).toContain(UUID);
  });
});

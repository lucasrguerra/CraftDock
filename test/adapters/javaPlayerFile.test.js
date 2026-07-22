import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import nbt from 'prismarine-nbt';
import { createJavaPlayerFile } from '../../src/adapters/playerFile/javaPlayerFile.js';

const UUID = '11111111-2222-3333-4444-555555555555';
let tmp, config;

beforeAll(async () => {
  const doc = {
    type: 'compound', name: '', value: {
      Pos: { type: 'list', value: { type: 'double', value: [10.5, 64, -20.3] } },
      Dimension: { type: 'string', value: 'minecraft:the_end' },
      Health: { type: 'float', value: 18 },
      foodLevel: { type: 'int', value: 15 },
      Inventory: {
        type: 'list', value: {
          type: 'compound', value: [{
            Slot: { type: 'byte', value: 0 },
            id: { type: 'string', value: 'minecraft:dirt' },
            Count: { type: 'byte', value: 64 },
          }],
        },
      },
      playerGameType: { type: 'int', value: 0 },
      XpLevel: { type: 'int', value: 3 },
    },
  };
  const dat = zlib.gzipSync(nbt.writeUncompressed(doc, 'big'));
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'cd-jpf-'));
  const pdir = path.join(tmp, 'world', 'playerdata');
  await fsp.mkdir(pdir, { recursive: true });
  await fsp.writeFile(path.join(pdir, `${UUID}.dat`), dat);
  config = { mcDataPath: tmp, mcWorldName: 'world' };
});

afterAll(async () => { if (tmp) await fsp.rm(tmp, { recursive: true, force: true }); });

describe('javaPlayerFile', () => {
  it('reads and normalizes a playerdata .dat', async () => {
    const d = await createJavaPlayerFile(config).readPlayer(UUID);
    expect(d.position).toEqual({ x: 10.5, y: 64, z: -20.3 });
    expect(d.dimension).toBe('end');
    expect(d.health).toEqual({ current: 18, max: 20 });
    expect(d.food).toBe(15);
    expect(d.inventory).toEqual([{ slot: 0, name: 'minecraft:dirt', count: 64 }]);
    expect(d.gamemode).toBe('survival');
  });

  it('returns null when the player has no .dat', async () => {
    const d = await createJavaPlayerFile(config).readPlayer('00000000-0000-0000-0000-000000000000');
    expect(d).toBeNull();
  });
});

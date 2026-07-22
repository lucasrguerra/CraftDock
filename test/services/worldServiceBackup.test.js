import { describe, it, expect } from 'vitest';
import fsp from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { createWorldService } from '../../src/services/worldService.js';

const extractZip = (zip, dest) =>
  new Promise((res, rej) =>
    createReadStream(zip).pipe(unzipper.Extract({ path: dest })).on('close', res).on('error', rej));

function makeService(mcDataPath) {
  return createWorldService({
    config: { mcDataPath, mcWorldName: 'worlds' },
    dockerService: { getState: async () => 'exited', stop: async () => {}, start: async () => {} },
    propertiesService: { read: async () => ({ 'level-name': 'Bedrock level' }) },
    archiver,
    extractZip,
  });
}

async function mkWorld(dataPath, levelDatContent) {
  const world = path.join(dataPath, 'worlds', 'Bedrock level');
  await fsp.mkdir(path.join(world, 'db'), { recursive: true });
  await fsp.writeFile(path.join(world, 'level.dat'), levelDatContent);
  await fsp.writeFile(path.join(world, 'db', '000001.ldb'), 'blocks');
}

describe('world export/import bundles player data (full backup)', () => {
  it('carries allowlist + history from one instance to another', async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'craftdock-bk-'));
    const src = path.join(tmp, 'src');
    const dst = path.join(tmp, 'dst');

    // Source: a world + player-data files at the data root.
    await mkWorld(src, 'SOURCE-WORLD');
    await fsp.writeFile(path.join(src, 'allowlist.json'),
      JSON.stringify([{ name: 'Lucasrguerra', ignoresPlayerLimit: false }]));
    await fsp.writeFile(path.join(src, 'permissions.json'), JSON.stringify([]));
    await fsp.writeFile(path.join(src, 'craftdock_players_history.json'), JSON.stringify(['Lucasrguerra']));

    // Export.
    const zipPath = path.join(tmp, 'world.zip');
    const archive = await makeService(src).createDownloadStream();
    const out = createWriteStream(zipPath);
    archive.pipe(out);
    await new Promise((res, rej) => { out.on('close', res); archive.on('error', rej); });

    // Destination: a different, older world and an empty allowlist.
    await mkWorld(dst, 'OLD-WORLD');
    await fsp.writeFile(path.join(dst, 'allowlist.json'), JSON.stringify([]));

    // Import.
    await makeService(dst).importWorld(zipPath);

    // World replaced.
    expect(await fsp.readFile(path.join(dst, 'worlds', 'Bedrock level', 'level.dat'), 'utf8'))
      .toBe('SOURCE-WORLD');
    // Allowlist migrated (Lucasrguerra now known on the destination).
    const allow = JSON.parse(await fsp.readFile(path.join(dst, 'allowlist.json'), 'utf8'));
    expect(allow.map((e) => e.name)).toContain('Lucasrguerra');
    // History migrated.
    const hist = JSON.parse(await fsp.readFile(path.join(dst, 'craftdock_players_history.json'), 'utf8'));
    expect(hist).toContain('Lucasrguerra');
    // permissions.json migrated too.
    await expect(fsp.access(path.join(dst, 'permissions.json'))).resolves.toBeUndefined();
  });
});

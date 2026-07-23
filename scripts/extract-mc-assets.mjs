// Extracts flat item icons from the minecraft-assets devDependency into
// src/public/assets/mc/items/<item>.png so the panel serves them locally
// (offline-friendly, no runtime dependency, tiny footprint vs the full pkg).
//
// Usage: node scripts/extract-mc-assets.mjs [version]   (default: newest available)
// Re-run + commit when bumping the asset version; the PNGs are checked in.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(here, '..', 'node_modules', 'minecraft-assets', 'minecraft-assets', 'data');
const outDir = path.join(here, '..', 'src', 'public', 'assets', 'mc', 'items');

const versions = fs.readdirSync(dataRoot)
  .filter((v) => /^\d+\.\d+(\.\d+)?$/.test(v))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const version = process.argv[2] || versions.at(-1);
const src = path.join(dataRoot, version);
if (!fs.existsSync(src)) {
  console.error(`version ${version} not found; available: ${versions.join(', ')}`);
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(path.join(src, 'items_textures.json'), 'utf8'));
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

let copied = 0, skipped = 0;
for (const { name, texture } of entries) {
  if (!name || !texture || texture.includes('missingno')) { skipped++; continue; }
  // texture is like "minecraft:item/iron_sword" or "minecraft:block/dirt"
  const rel = texture.replace(/^minecraft:/, '').replace(/^item\//, 'items/').replace(/^block\//, 'blocks/');
  const file = path.join(src, `${rel}.png`);
  if (!fs.existsSync(file)) { skipped++; continue; }
  fs.copyFileSync(file, path.join(outDir, `${name}.png`));
  copied++;
}

console.log(`minecraft ${version}: ${copied} item icons → ${path.relative(process.cwd(), outDir)} (${skipped} without usable texture)`);

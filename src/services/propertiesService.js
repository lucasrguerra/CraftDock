import fsp from 'node:fs/promises';
import path from 'node:path';

export function createPropertiesService(config, fs = fsp) {
  const file = path.join(config.mcDataPath, 'server.properties');

  function parse(text) {
    const obj = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      obj[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
    return obj;
  }

  function serialize(obj, originalText = '') {
    const seen = new Set();
    const lines = originalText.split(/\r?\n/).map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return line;
      const key = trimmed.slice(0, idx);
      if (!(key in obj)) return line;
      seen.add(key);
      return `${key}=${obj[key]}`;
    });
    for (const [key, value] of Object.entries(obj)) {
      if (!seen.has(key)) lines.push(`${key}=${value}`);
    }
    return lines.join('\n');
  }

  async function read() {
    return parse(await fs.readFile(file, 'utf8'));
  }

  async function update(patch) {
    let original = '';
    try { original = await fs.readFile(file, 'utf8'); } catch { original = ''; }
    const merged = { ...parse(original), ...patch };
    await fs.writeFile(file, serialize(merged, original), 'utf8');
    if (typeof fs.chmod === 'function') {
      await fs.chmod(file, 0o666).catch(() => {});
    }
    return merged;
  }

  return { parse, serialize, read, update };
}

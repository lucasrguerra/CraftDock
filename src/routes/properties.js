import { Router } from 'express';

// Managed keys: type drives validation; `default` (vanilla server default) is
// filled into GET responses when the key is missing from server.properties, so
// the Options tab always starts fully populated. motd intentionally has none.
export const PROPERTY_SCHEMA = {
  difficulty: { type: 'enum', values: ['peaceful', 'easy', 'normal', 'hard'], default: 'normal' },
  gamemode: { type: 'enum', values: ['survival', 'creative', 'adventure', 'spectator'], default: 'survival' },
  pvp: { type: 'boolean', default: 'true' },
  'allow-flight': { type: 'boolean', default: 'false' },
  hardcore: { type: 'boolean', default: 'false' },
  'keep-inventory': { type: 'boolean', default: 'false' },
  'allow-nether': { type: 'boolean', default: 'true' },
  'enable-command-block': { type: 'boolean', default: 'false' },
  'force-gamemode': { type: 'boolean', default: 'false' },
  'spawn-monsters': { type: 'boolean', default: 'true' },
  'spawn-animals': { type: 'boolean', default: 'true' },
  'spawn-npcs': { type: 'boolean', default: 'true' },
  'max-players': { type: 'int', default: '20' },
  'view-distance': { type: 'int', default: '10' },
  'simulation-distance': { type: 'int', default: '10' },
  'spawn-protection': { type: 'int', default: '16' },
  motd: { type: 'string' },
  'level-name': { type: 'string' },
  'level-seed': { type: 'string' },
};

// Merge schema defaults under the actual file contents (file always wins).
export function withDefaults(properties) {
  const out = { ...properties };
  for (const [key, schema] of Object.entries(PROPERTY_SCHEMA)) {
    if (schema.default !== undefined && out[key] === undefined) out[key] = schema.default;
  }
  return out;
}

function validate(properties) {
  for (const [key, value] of Object.entries(properties)) {
    const schema = PROPERTY_SCHEMA[key];
    if (!schema) continue; // unmanaged keys pass through
    const str = String(value);
    if (schema.type === 'enum' && !schema.values.includes(str)) return key;
    if (schema.type === 'boolean' && str !== 'true' && str !== 'false') return key;
    if (schema.type === 'int' && !/^-?\d+$/.test(str)) return key;
  }
  return null;
}

export function createPropertiesRouter({ propertiesService }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      let current = {};
      try {
        current = await propertiesService.read();
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err; // no file yet → serve defaults
      }
      res.json({ properties: withDefaults(current) });
    } catch (err) { next(err); }
  });

  router.put('/', async (req, res, next) => {
    const properties = req.body?.properties || {};
    const bad = validate(properties);
    if (bad) return res.status(400).json({ error: 'invalid_value', field: bad });
    try {
      const merged = await propertiesService.update(properties);
      res.json({ ok: true, properties: merged });
    } catch (err) { next(err); }
  });

  return router;
}

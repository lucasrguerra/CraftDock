import { Router } from 'express';

export const PROPERTY_SCHEMA = {
  difficulty: { type: 'enum', values: ['peaceful', 'easy', 'normal', 'hard'] },
  gamemode: { type: 'enum', values: ['survival', 'creative', 'adventure', 'spectator'] },
  pvp: { type: 'boolean' },
  'allow-flight': { type: 'boolean' },
  hardcore: { type: 'boolean' },
  'max-players': { type: 'int' },
  'view-distance': { type: 'int' },
  motd: { type: 'string' },
};

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
      res.json({ properties: await propertiesService.read() });
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

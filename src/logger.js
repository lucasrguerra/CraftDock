// Lightweight structured logger. No dependencies — writes one JSON record per
// line to a stream (stdout by default). Level is controlled by LOG_LEVEL
// (error < warn < info < debug); anything above the threshold is dropped.

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function serializeMeta(meta) {
  if (meta == null) return undefined;
  if (meta instanceof Error) {
    return { error: meta.message, stack: meta.stack };
  }
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = value instanceof Error ? { error: value.message, stack: value.stack } : value;
  }
  return out;
}

export function createLogger(component, {
  level = process.env.LOG_LEVEL || 'info',
  stream = process.stdout,
} = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function log(lvl, msg, meta) {
    if (LEVELS[lvl] > threshold) return;
    const record = {
      ts: new Date().toISOString(),
      level: lvl,
      component,
      msg,
    };
    const m = serializeMeta(meta);
    if (m !== undefined) record.meta = m;
    stream.write(JSON.stringify(record) + '\n');
  }

  return {
    error: (msg, meta) => log('error', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    debug: (msg, meta) => log('debug', msg, meta),
    child: (sub) => createLogger(`${component}:${sub}`, { level, stream }),
  };
}

// Default application logger.
export const logger = createLogger('craftdock');

// Lightweight structured logger. No dependencies — writes one record per line
// to a stream (stdout by default). Level is controlled by LOG_LEVEL
// (error < warn < info < debug); anything above the threshold is dropped.
// Format is controlled by LOG_FORMAT (json | text, default: text).

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function serializeMeta(meta) {
  if (meta == null) return undefined;
  if (meta instanceof Error) {
    return { error: meta.message, stack: meta.stack, cause: meta.cause };
  }
  if (typeof meta !== 'object') {
    return { value: meta };
  }
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      out[key] = { error: value.message, stack: value.stack, cause: value.cause };
    } else {
      out[key] = value;
    }
  }
  return out;
}

function formatTextRecord(record) {
  const lvlStr = record.level.toUpperCase().padEnd(5);
  const metaStr = record.meta ? ` ${JSON.stringify(record.meta)}` : '';
  return `[${record.ts}] [${lvlStr}] [${record.component}] ${record.msg}${metaStr}\n`;
}

export function createLogger(component, {
  level = process.env.LOG_LEVEL || 'info',
  format = process.env.LOG_FORMAT || 'text',
  stream = process.stdout,
} = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const isJson = format === 'json';

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

    if (isJson) {
      stream.write(JSON.stringify(record) + '\n');
    } else {
      stream.write(formatTextRecord(record));
    }
  }

  return {
    error: (msg, meta) => log('error', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    debug: (msg, meta) => log('debug', msg, meta),
    time: (label, lvl = 'info') => {
      const start = Date.now();
      return (meta = {}) => {
        const durationMs = Date.now() - start;
        log(lvl, `${label} took ${durationMs}ms`, { ...meta, durationMs });
      };
    },
    child: (sub) => createLogger(`${component}:${sub}`, { level, format, stream }),
  };
}

// Default application logger.
export const logger = createLogger('craftdock');


// SESSION_SECRET is always required. RCON_PASSWORD is Java-only (optional). The
// admin hash may come from ADMIN_PASSWORD_HASH (raw) or ADMIN_PASSWORD_HASH_B64
// (base64 of the same hash — avoids `$` interpolation issues under docker/Coolify).
const REQUIRED = ['SESSION_SECRET'];

// bcrypt hashes contain `$`, which docker compose / Coolify interpret as variable
// interpolation. Providing the hash base64-encoded sidesteps that entirely.
function resolveAdminHash(env) {
  const raw = (env.ADMIN_PASSWORD_HASH || '').trim();
  if (raw) return raw;
  const b64 = (env.ADMIN_PASSWORD_HASH_B64 || '').trim();
  if (b64) return Buffer.from(b64, 'base64').toString('utf8').trim();
  return '';
}

export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k]);
  const adminPasswordHash = resolveAdminHash(env);
  if (!adminPasswordHash) missing.push('ADMIN_PASSWORD_HASH (or ADMIN_PASSWORD_HASH_B64)');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  const num = (v, d) => {
    if (v == null || v === '') return d;
    const n = Number(v);
    return Number.isNaN(n) ? d : n;
  };
  return {
    adminPasswordHash,
    sessionSecret: env.SESSION_SECRET,
    mcContainerName: env.MC_CONTAINER_NAME || 'craftdock-mc-server',
    // Compose service name of the MC container, used as a fallback when the
    // container name is auto-generated (e.g. Coolify ignores container_name).
    mcServiceName: env.MC_SERVICE_NAME || 'minecraft-server',
    mcDataPath: env.MC_DATA_PATH || '/minecraft/data',
    mcEdition: env.MC_EDITION || 'auto',
    mcWorldName: env.MC_WORLD_NAME || 'world',
    rconHost: env.RCON_HOST || 'craftdock-mc-server',
    rconPort: num(env.RCON_PORT, 25575),
    rconPassword: env.RCON_PASSWORD || '',
    mapVersion: env.MAP_VERSION || '',
    port: num(env.PORT, 8081),
    nodeEnv: env.NODE_ENV || 'development',
    maxUploadBytes: num(env.MAX_UPLOAD_MB, 1024) * 1024 * 1024,
  };
}

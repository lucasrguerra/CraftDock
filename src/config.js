const REQUIRED = ['ADMIN_PASSWORD_HASH', 'SESSION_SECRET', 'RCON_PASSWORD'];

export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  const num = (v, d) => {
    if (v == null || v === '') return d;
    const n = Number(v);
    return Number.isNaN(n) ? d : n;
  };
  return {
    adminPasswordHash: env.ADMIN_PASSWORD_HASH,
    sessionSecret: env.SESSION_SECRET,
    mcContainerName: env.MC_CONTAINER_NAME || 'craftdock-mc-server',
    mcDataPath: env.MC_DATA_PATH || '/minecraft/data',
    mcEdition: env.MC_EDITION || 'auto',
    mcWorldName: env.MC_WORLD_NAME || 'world',
    rconHost: env.RCON_HOST || 'craftdock-mc-server',
    rconPort: num(env.RCON_PORT, 25575),
    rconPassword: env.RCON_PASSWORD,
    mapUrl: env.MAP_URL || '',
    port: num(env.PORT, 3000),
    nodeEnv: env.NODE_ENV || 'development',
    maxUploadBytes: num(env.MAX_UPLOAD_MB, 1024) * 1024 * 1024,
  };
}

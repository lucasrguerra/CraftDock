import { Rcon } from 'rcon-client';

export class RconUnavailableError extends Error {
  constructor(cause) {
    super(`RCON unavailable: ${cause?.message || cause}`);
    this.name = 'RconUnavailableError';
  }
}

export function createRconService(config, RconClass = Rcon, logger) {
  let conn = null;

  async function ensure() {
    if (conn) return conn;
    try {
      conn = await RconClass.connect({
        host: config.rconHost,
        port: config.rconPort,
        password: config.rconPassword,
      });
      logger?.info('rcon connected', { host: config.rconHost, port: config.rconPort });
      conn.on?.('error', () => { conn = null; });
      conn.on?.('end', () => { conn = null; });
      return conn;
    } catch (err) {
      conn = null;
      logger?.warn('rcon connect failed', { error: err.message });
      throw new RconUnavailableError(err);
    }
  }

  return {
    async send(cmd) {
      const c = await ensure();
      logger?.debug('rcon >', { cmd });
      try {
        const out = await c.send(cmd);
        logger?.debug('rcon <', { cmd, out });
        return out;
      } catch (err) {
        conn = null;
        logger?.warn('rcon send failed', { cmd, error: err.message });
        throw new RconUnavailableError(err);
      }
    },
    async close() {
      if (conn) { await conn.end?.(); conn = null; }
    },
  };
}

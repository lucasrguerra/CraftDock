import { Rcon } from 'rcon-client';

export class RconUnavailableError extends Error {
  constructor(cause) {
    super(`RCON unavailable: ${cause?.message || cause}`);
    this.name = 'RconUnavailableError';
  }
}

export function createRconService(config, RconClass = Rcon) {
  let conn = null;

  async function ensure() {
    if (conn) return conn;
    try {
      conn = await RconClass.connect({
        host: config.rconHost,
        port: config.rconPort,
        password: config.rconPassword,
      });
      conn.on?.('error', () => { conn = null; });
      conn.on?.('end', () => { conn = null; });
      return conn;
    } catch (err) {
      conn = null;
      throw new RconUnavailableError(err);
    }
  }

  return {
    async send(cmd) {
      const c = await ensure();
      try {
        return await c.send(cmd);
      } catch (err) {
        conn = null;
        throw new RconUnavailableError(err);
      }
    },
    async close() {
      if (conn) { await conn.end?.(); conn = null; }
    },
  };
}

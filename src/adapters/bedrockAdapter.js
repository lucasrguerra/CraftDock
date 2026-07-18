import { parsePlayerList, parseWhitelistList, CAPABILITIES, NotSupportedError } from './serverAdapter.js';

export function createBedrockAdapter(stdinService) {
  const send = (cmd) => stdinService.send(cmd);
  return {
    get capabilities() { return CAPABILITIES.BEDROCK; },
    sendCommand: (raw) => send(raw),
    async listPlayers() { return parsePlayerList(await send('list')); },
    whitelistAdd: (n) => send(`allowlist add ${n}`),
    whitelistRemove: (n) => send(`allowlist remove ${n}`),
    whitelistOn: () => send('allowlist on'),
    whitelistOff: () => send('allowlist off'),
    async whitelistList() { return parseWhitelistList(await send('allowlist list')); },
    async ban() { throw new NotSupportedError('ban'); },
    async pardon() { throw new NotSupportedError('pardon'); },
    op: (n) => send(`op ${n}`),
    deop: (n) => send(`deop ${n}`),
    kick: (n, reason = '') => send(`kick ${n} ${reason}`.trim()),
    give: (n, item, count = 1) => send(`give ${n} ${item} ${count}`),
    gamemode: (n, mode) => send(`gamemode ${mode} ${n}`),
    teleport: (n, target) => send(`tp ${n} ${target}`),
    // NOTE: Bedrock has no `seed` console command (Java-only). The seed is read
    // from worlds/<level-name>/level.dat by seedService — do NOT add getSeed here.
    async getPlayerPosition(n) {
      try {
        try {
          const resQuery = await send(`querytarget @a[name="${n}"]`);
          if (resQuery && resQuery.trim().startsWith('[')) {
            const data = JSON.parse(resQuery.trim());
            if (data && data[0]) {
              const p = data[0].position;
              const dimCode = data[0].dimension;
              let dimension = 'overworld';
              if (dimCode === 1) dimension = 'nether';
              if (dimCode === 2) dimension = 'end';
              return { x: p.x, y: p.y, z: p.z, dimension };
            }
          }
        } catch { /* fallback to tp */ }

        const res = await send(`tp ${n} ~ ~ ~`);
        const clean = res.replace(/§[0-9a-fk-or]/ig, '');
        const m = clean.match(/to\s+(-?\d+(?:\.\d+)?)(?:,\s*|\s+)(-?\d+(?:\.\d+)?)(?:,\s*|\s+)(-?\d+(?:\.\d+)?)/i);
        if (!m) return null;
        return {
          x: parseFloat(m[1]),
          y: parseFloat(m[2]),
          z: parseFloat(m[3]),
          dimension: 'overworld'
        };
      } catch {
        return null;
      }
    }
  };
}


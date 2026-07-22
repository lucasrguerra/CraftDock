import { parsePlayerList, parseWhitelistList, CAPABILITIES } from './serverAdapter.js';

export function createJavaAdapter(rconService) {
  const send = (cmd) => rconService.send(cmd);
  return {
    get capabilities() { return CAPABILITIES.JAVA; },
    sendCommand: (raw) => send(raw.startsWith('/') ? raw.slice(1) : raw),
    async listPlayers() { return parsePlayerList(await send('list')); },
    whitelistAdd: (n) => send(`whitelist add ${n}`),
    whitelistRemove: (n) => send(`whitelist remove ${n}`),
    whitelistOn: () => send('whitelist on'),
    whitelistOff: () => send('whitelist off'),
    async whitelistList() { return parseWhitelistList(await send('whitelist list')); },
    ban: (n, reason = '') => send(`ban ${n} ${reason}`.trim()),
    pardon: (n) => send(`pardon ${n}`),
    op: (n) => send(`op ${n}`),
    deop: (n) => send(`deop ${n}`),
    kick: (n, reason = '') => send(`kick ${n} ${reason}`.trim()),
    give: (n, item, count = 1) => send(`give ${n} ${item} ${count}`),
    gamemode: (n, mode) => send(`gamemode ${mode} ${n}`),
    teleport: (n, target) => send(`tp ${n} ${target}`),
    // Flush all worlds to disk so a subsequent playerdata read is fresh. Java's
    // save is atomic per file, so no hold/resume dance is needed.
    forceSave: () => send('save-all flush'),
    async getSeed() {
      const res = await send('seed');
      const clean = res.replace(/§[0-9a-fk-or]/ig, '');
      const m = clean.match(/Seed:\s*\[?(-?\d+)\]?/i);
      return m ? m[1] : null;
    },
    async getPlayerPosition(n) {
      try {
        const res = await send(`tp ${n} ~ ~ ~`);
        const clean = res.replace(/§[0-9a-fk-or]/ig, '');
        const m = clean.match(/to\s+(-?\d+(?:\.\d+)?)(?:,\s*|\s+)(-?\d+(?:\.\d+)?)(?:,\s*|\s+)(-?\d+(?:\.\d+)?)/i);
        if (!m) return null;
        
        let dimension = 'overworld';
        try {
          const resDim = await send(`data get entity ${n} Dimension`);
          const cleanDim = resDim.replace(/§[0-9a-fk-or]/ig, '');
          if (cleanDim.includes('the_nether')) dimension = 'nether';
          else if (cleanDim.includes('the_end')) dimension = 'end';
        } catch { /* ignore dimension if command fails */ }

        return {
          x: parseFloat(m[1]),
          y: parseFloat(m[2]),
          z: parseFloat(m[3]),
          dimension
        };
      } catch {
        return null;
      }
    }
  };
}


import { parsePlayerList, parseWhitelistList, CAPABILITIES, NotSupportedError } from './serverAdapter.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Parse the console output of `querytarget` into its first target object, or
// null. Strips color codes, log-line prefixes and the "Target data:" label.
export function parseQueryTarget(res) {
  if (!res) return null;
  try {
    let clean = res.replace(/§[0-9a-fk-or]/ig, '').trim();
    clean = clean.replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}:\d{3}\s+\w+\]\s*/gm, '');
    if (clean.includes('Target data:')) {
      clean = clean.substring(clean.indexOf('Target data:') + 'Target data:'.length);
    }
    const s = clean.indexOf('['), e = clean.lastIndexOf(']');
    if (s === -1 || e === -1 || e <= s) return null;
    const data = JSON.parse(clean.substring(s, e + 1));
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

export function createBedrockAdapter(stdinService) {
  const send = (cmd) => stdinService.send(cmd);
  return {
    get capabilities() { return CAPABILITIES.BEDROCK; },
    sendCommand: (raw) => send(raw.startsWith('/') ? raw.slice(1) : raw),
    async listPlayers() { return parsePlayerList(await send('list')); },
    whitelistAdd: (n) => send(`allowlist add "${n}"`),
    whitelistRemove: (n) => send(`allowlist remove "${n}"`),
    whitelistOn: () => send('allowlist on'),
    whitelistOff: () => send('allowlist off'),
    async whitelistList() { return parseWhitelistList(await send('allowlist list')); },
    async ban() { throw new NotSupportedError('ban'); },
    async pardon() { throw new NotSupportedError('pardon'); },
    op: (n) => send(`op "${n}"`),
    deop: (n) => send(`deop "${n}"`),
    kick: (n, reason = '') => send(`kick "${n}" ${reason}`.trim()),
    give: (n, item, count = 1) => send(`give "${n}" ${item} ${count}`),
    gamemode: (n, mode) => send(`gamemode ${mode} "${n}"`),
    teleport: (n, target) => send(`tp "${n}" ${target}`),
    // Snapshot protocol for safely reading the LevelDB while the server runs:
    // `save hold` → poll `save query` until the files are flushed and ready →
    // (caller reads the files) → `saveResume`. Returns true when ready.
    async saveHold() {
      try {
        await send('save hold');
        for (let i = 0; i < 12; i++) {
          const out = await send('save query');
          if (/ready to be copied|Data saved/i.test(out)) return true;
          await delay(250);
        }
      } catch {
        // Command stream issue or timeout — snapshot hold failed
      }
      return false;
    },
    saveResume: () => send('save resume').catch(() => {}),

    // Returns the live entity's uniqueId (the player's MsaId/SelfSignedId UUID,
    // which keys the LevelDB player_<uuid> mapping record), used to bridge a
    // gamertag to its LevelDB record. Online players only.
    async queryUniqueId(n) {
      try {
        const res = await send(`querytarget @a[name="${n}"]`);
        const target = parseQueryTarget(res);
        if (target?.uniqueId != null) return String(target.uniqueId);
        // Fallback: regex over raw output when the JSON block is mangled
        const match = res?.match(/"uniqueId"\s*:\s*(-?\d+|"[^"]+")/i);
        return match ? match[1].replace(/"/g, '') : null;
      } catch {
        return null;
      }
    },

    // NOTE: Bedrock has no `seed` console command (Java-only). The seed is read
    // from worlds/<level-name>/level.dat by seedService — do NOT add getSeed here.
    async getPlayerPosition(n) {
      try {
        const target = parseQueryTarget(await send(`querytarget @a[name="${n}"]`));
        if (!target?.position) return null;
        const { x, y, z } = target.position;
        const dimension = target.dimension === 1 ? 'nether' : target.dimension === 2 ? 'end' : 'overworld';
        return { x, y, z, dimension };
      } catch {
        return null;
      }
    }
  };
}


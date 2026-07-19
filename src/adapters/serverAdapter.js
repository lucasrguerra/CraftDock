export class NotSupportedError extends Error {
  constructor(action) {
    super(`Action not supported on this edition: ${action}`);
    this.name = 'NotSupportedError';
  }
}

const COMMON = ['listPlayers', 'whitelistAdd', 'whitelistRemove', 'whitelistOn', 'whitelistOff', 'whitelistList', 'op', 'deop', 'kick', 'give', 'gamemode', 'teleport', 'sendCommand'];

export const CAPABILITIES = {
  JAVA: new Set([...COMMON, 'ban', 'pardon']),
  BEDROCK: new Set([...COMMON]),
};

export const PLAYER_NAME_REGEX = /^[a-zA-Z0-9_ ]{3,16}$/;

/**
 * Parses the output of `whitelist list` / `allowlist list`.
 * Typical formats:
 *   Java:    "There are 2 whitelisted players: steve, alex"
 *   Bedrock: "There are 2 allowlisted players: steve, alex"
 */
export function parseWhitelistList(text) {
  // Bedrock returns a structured JSON block, e.g.
  //   ###* {"command":"allowlist","result":[{"name":"steve"}]} *###
  // When a `result` field is present it is AUTHORITATIVE: a null/empty result
  // means the list is empty. We must never fall through to text parsing here —
  // doing so scrapes ghost "names" out of console log lines (the bug that
  // produced `allowlist remove 53:21:185 INFO] ###* {`).
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]);
      if (data && 'result' in data) {
        return Array.isArray(data.result) ? data.result.map((p) => p.name).filter((s) => s && PLAYER_NAME_REGEX.test(s)) : [];
      }
    } catch { /* not the JSON we expected — fall through to Java text form */ }
  }

  // Java text form only: "There are N whitelisted players: a, b". Matched
  // strictly so unrelated log lines (timestamps, errors) never yield names.
  const m = text.replace(/\s+/g, ' ').match(/There are \d+ \w+ players:\s*(.+)$/i);
  if (m && m[1].trim()) return m[1].split(',').map((s) => s.trim()).filter((s) => PLAYER_NAME_REGEX.test(s));
  return [];
}

export function parsePlayerList(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  // Java: "There are 2 of a max of 20 players online: a, b"
  let m = clean.match(/There are (\d+) of a max of (\d+) players online:?\s*(.*)$/i);
  // Bedrock: "There are 2/20 players online: a, b"
  if (!m) m = clean.match(/There are (\d+)\/(\d+) players online:?\s*(.*)$/i);
  if (!m) return { online: 0, max: 0, players: [] };
  const online = Number(m[1]);
  const max = Number(m[2]);
  if (online === 0) return { online: 0, max, players: [] };
  const players = (m[3] || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => PLAYER_NAME_REGEX.test(s));
  return { online, max, players };
}

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

/**
 * Parses the output of `whitelist list` / `allowlist list`.
 * Typical formats:
 *   Java:    "There are 2 whitelisted players: steve, alex"
 *   Bedrock: "There are 2 allowlisted players: steve, alex"
 */
export function parseWhitelistList(text) {
  // If the text contains JSON (Bedrock allowlist query format)
  const jsonMatch = text.match(/\{.*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]);
      if (data && Array.isArray(data.result)) {
        return data.result.map((p) => p.name).filter(Boolean);
      }
    } catch { /* fallback to text parsing */ }
  }

  const clean = text.replace(/\s+/g, ' ').trim();
  const m = clean.match(/:\s*(.*)$/);
  if (!m || !m[1].trim()) return [];
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
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
  const players = (m[3] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { online, max, players };
}

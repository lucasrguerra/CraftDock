export class NotSupportedError extends Error {
  constructor(action) {
    super(`Action not supported on this edition: ${action}`);
    this.name = 'NotSupportedError';
  }
}

const COMMON = ['listPlayers', 'whitelistAdd', 'whitelistRemove', 'op', 'deop', 'kick', 'give', 'gamemode', 'teleport', 'sendCommand'];

export const CAPABILITIES = {
  JAVA: new Set([...COMMON, 'ban', 'pardon']),
  BEDROCK: new Set([...COMMON]),
};

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

import { parsePlayerList, CAPABILITIES, NotSupportedError } from './serverAdapter.js';

export function createBedrockAdapter(stdinService) {
  const send = (cmd) => stdinService.send(cmd);
  return {
    get capabilities() { return CAPABILITIES.BEDROCK; },
    sendCommand: (raw) => send(raw),
    async listPlayers() { return parsePlayerList(await send('list')); },
    whitelistAdd: (n) => send(`allowlist add ${n}`),
    whitelistRemove: (n) => send(`allowlist remove ${n}`),
    async ban() { throw new NotSupportedError('ban'); },
    async pardon() { throw new NotSupportedError('pardon'); },
    op: (n) => send(`op ${n}`),
    deop: (n) => send(`deop ${n}`),
    kick: (n, reason = '') => send(`kick ${n} ${reason}`.trim()),
    give: (n, item, count = 1) => send(`give ${n} ${item} ${count}`),
    gamemode: (n, mode) => send(`gamemode ${mode} ${n}`),
    teleport: (n, target) => send(`tp ${n} ${target}`),
  };
}

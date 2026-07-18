import { parsePlayerList, CAPABILITIES } from './serverAdapter.js';

export function createJavaAdapter(rconService) {
  const send = (cmd) => rconService.send(cmd);
  return {
    get capabilities() { return CAPABILITIES.JAVA; },
    sendCommand: (raw) => send(raw),
    async listPlayers() { return parsePlayerList(await send('list')); },
    whitelistAdd: (n) => send(`whitelist add ${n}`),
    whitelistRemove: (n) => send(`whitelist remove ${n}`),
    ban: (n, reason = '') => send(`ban ${n} ${reason}`.trim()),
    pardon: (n) => send(`pardon ${n}`),
    op: (n) => send(`op ${n}`),
    deop: (n) => send(`deop ${n}`),
    kick: (n, reason = '') => send(`kick ${n} ${reason}`.trim()),
    give: (n, item, count = 1) => send(`give ${n} ${item} ${count}`),
    gamemode: (n, mode) => send(`gamemode ${mode} ${n}`),
    teleport: (n, target) => send(`tp ${n} ${target}`),
  };
}

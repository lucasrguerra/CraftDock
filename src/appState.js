import { createAdapter, isBedrock } from './adapters/index.js';

export function createAppState({ config, dockerService, rconService, stdinService }) {
  let cached = null;

  // Returns { type, definitive }. `definitive` is false when we could not read a
  // real TYPE (e.g. container stopped) and had to fall back — such results must
  // not be cached, or the edition can get stuck wrong until restart.
  async function resolveType() {
    if (config.mcEdition === 'bedrock') return { type: 'BEDROCK', definitive: true };
    if (config.mcEdition === 'java') return { type: 'PAPER', definitive: true };
    const info = await dockerService.inspect();
    return info.type
      ? { type: info.type, definitive: true }
      : { type: 'PAPER', definitive: false };
  }

  function build(type) {
    const adapter = createAdapter(type, { rconService, stdinService });
    adapter._edition = isBedrock(type) ? 'bedrock' : 'java';

    let listPlayersCache = null;
    let listPlayersTime = 0;
    let whitelistCache = null;
    let whitelistTime = 0;

    const originalListPlayers = adapter.listPlayers;
    adapter.listPlayers = async function() {
      const now = Date.now();
      if (listPlayersCache && (now - listPlayersTime < 10000)) {
        return listPlayersCache;
      }
      listPlayersCache = await originalListPlayers.call(adapter);
      listPlayersTime = now;
      return listPlayersCache;
    };

    const originalWhitelistList = adapter.whitelistList;
    adapter.whitelistList = async function() {
      const now = Date.now();
      if (whitelistCache && (now - whitelistTime < 30000)) {
        return whitelistCache;
      }
      whitelistCache = await originalWhitelistList.call(adapter);
      whitelistTime = now;
      return whitelistCache;
    };

    adapter.clearCaches = () => {
      listPlayersCache = null;
      listPlayersTime = 0;
      whitelistCache = null;
      whitelistTime = 0;
    };

    const wrapClear = (methodName) => {
      if (typeof adapter[methodName] === 'function') {
        const original = adapter[methodName];
        adapter[methodName] = async function(...args) {
          const res = await original.apply(adapter, args);
          adapter.clearCaches();
          return res;
        };
      }
    };

    wrapClear('whitelistAdd');
    wrapClear('whitelistRemove');
    wrapClear('whitelistOn');
    wrapClear('whitelistOff');

    return adapter;
  }

  return {
    async getAdapter() {
      if (cached) return cached;
      const { type, definitive } = await resolveType();
      const adapter = build(type);
      if (definitive) cached = adapter;
      return adapter;
    },
    async getEdition() {
      return (await this.getAdapter())._edition;
    },
  };
}

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

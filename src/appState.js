import { createAdapter, isBedrock } from './adapters/index.js';

export function createAppState({ config, dockerService, rconService, stdinService }) {
  let cached = null;

  async function resolveType() {
    if (config.mcEdition === 'bedrock') return 'BEDROCK';
    if (config.mcEdition === 'java') return 'PAPER';
    const info = await dockerService.inspect();
    return info.type || 'PAPER';
  }

  return {
    async getAdapter() {
      if (cached) return cached;
      const type = await resolveType();
      cached = createAdapter(type, { rconService, stdinService });
      cached._edition = isBedrock(type) ? 'bedrock' : 'java';
      return cached;
    },
    async getEdition() {
      return (await this.getAdapter())._edition;
    },
  };
}

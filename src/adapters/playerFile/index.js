import { createJavaPlayerFile } from './javaPlayerFile.js';
import { createBedrockPlayerFile } from './bedrockPlayerFile.js';

// Returns the read-only player-file adapter for the given edition. Both expose
// `readPlayer(id)`; the Bedrock adapter adds `findByUniqueId`/`listServerUuids`
// used by the identity bridge.
export function createPlayerFileAdapter(edition, config) {
  return edition === 'bedrock'
    ? createBedrockPlayerFile(config)
    : createJavaPlayerFile(config);
}

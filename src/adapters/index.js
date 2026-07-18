import { createJavaAdapter } from './javaAdapter.js';
import { createBedrockAdapter } from './bedrockAdapter.js';

export function isBedrock(type) {
  return typeof type === 'string' && type.toUpperCase() === 'BEDROCK';
}

export function createAdapter(type, { rconService, stdinService }) {
  return isBedrock(type)
    ? createBedrockAdapter(stdinService)
    : createJavaAdapter(rconService);
}

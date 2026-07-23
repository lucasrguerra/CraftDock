import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureFirstBootDefaults, MARKER_FILE } from '../../src/services/firstBootService.js';

let tmp, propertiesService, logger;

beforeEach(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'cd-fb-'));
  propertiesService = { update: vi.fn().mockResolvedValue({}) };
  logger = { info: vi.fn(), warn: vi.fn() };
});
afterEach(async () => { await fsp.rm(tmp, { recursive: true, force: true }); });

const run = (edition = 'bedrock') =>
  ensureFirstBootDefaults({ config: { mcDataPath: tmp, mcEdition: edition }, propertiesService, logger });

describe('ensureFirstBootDefaults', () => {
  it('first boot: forces the whitelist property to false and writes the marker', async () => {
    await run('bedrock');
    expect(propertiesService.update).toHaveBeenCalledWith({ 'allow-list': 'false' });
    const marker = JSON.parse(await fsp.readFile(path.join(tmp, MARKER_FILE), 'utf8'));
    expect(marker.initializedAt).toBeTruthy();
  });

  it('java edition writes white-list', async () => {
    await run('java');
    expect(propertiesService.update).toHaveBeenCalledWith({ 'white-list': 'false' });
  });

  it('auto edition writes both keys (each server only reads its own)', async () => {
    await run('auto');
    expect(propertiesService.update).toHaveBeenCalledWith({ 'allow-list': 'false', 'white-list': 'false' });
  });

  it('restart (marker present): does not touch properties', async () => {
    await fsp.writeFile(path.join(tmp, MARKER_FILE), JSON.stringify({ initializedAt: 'x' }));
    await run('bedrock');
    expect(propertiesService.update).not.toHaveBeenCalled();
  });

  it('never throws: a failing properties write is logged, and no marker is left so it retries next boot', async () => {
    propertiesService.update.mockRejectedValue(new Error('disk full'));
    await expect(run('bedrock')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
    await expect(fsp.access(path.join(tmp, MARKER_FILE))).rejects.toThrow();
  });
});

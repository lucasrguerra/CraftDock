import { describe, it, expect, vi } from 'vitest';
import { parseBedrockSeed, createSeedService } from '../../src/services/seedService.js';

function levelDatWithSeed(seed) {
  const name = Buffer.from('RandomSeed', 'utf8');
  const value = Buffer.alloc(8);
  value.writeBigInt64LE(BigInt(seed));
  return Buffer.concat([Buffer.from([0x04, 0x0a, 0x00]), name, value, Buffer.from('tail')]);
}

describe('parseBedrockSeed', () => {
  it('reads the RandomSeed int64 (little-endian) from a level.dat buffer', () => {
    expect(parseBedrockSeed(levelDatWithSeed('682981659723566343'))).toBe('682981659723566343');
  });

  it('handles negative seeds', () => {
    expect(parseBedrockSeed(levelDatWithSeed('-4707462683490150816'))).toBe('-4707462683490150816');
  });

  it('returns null when RandomSeed is absent', () => {
    expect(parseBedrockSeed(Buffer.from('no seed here'))).toBeNull();
  });
});

describe('seedService.resolve', () => {
  const config = { mcDataPath: '/data' };

  it('prefers a non-empty level-seed from server.properties', async () => {
    const propertiesService = { read: vi.fn().mockResolvedValue({ 'level-seed': '12345', 'level-name': 'Bedrock level' }) };
    const svc = createSeedService({ config, propertiesService });
    expect(await svc.resolve({}, 'bedrock')).toBe('12345');
  });

  it('reads bedrock seed from level.dat when level-seed is empty', async () => {
    const propertiesService = { read: vi.fn().mockResolvedValue({ 'level-seed': '', 'level-name': 'Bedrock level' }) };
    const fs = { readFile: vi.fn().mockResolvedValue(levelDatWithSeed('682981659723566343')) };
    const svc = createSeedService({ config, propertiesService, fs });
    expect(await svc.resolve({}, 'bedrock')).toBe('682981659723566343');
    expect(fs.readFile).toHaveBeenCalledWith('/data/worlds/Bedrock level/level.dat');
  });

  it('uses the java adapter command when edition is java', async () => {
    const propertiesService = { read: vi.fn().mockResolvedValue({ 'level-seed': '' }) };
    const adapter = { getSeed: vi.fn().mockResolvedValue('99') };
    const svc = createSeedService({ config, propertiesService });
    expect(await svc.resolve(adapter, 'java')).toBe('99');
    expect(adapter.getSeed).toHaveBeenCalled();
  });

  it('returns null (not throw) when bedrock level.dat is unreadable', async () => {
    const propertiesService = { read: vi.fn().mockResolvedValue({ 'level-seed': '', 'level-name': 'Bedrock level' }) };
    const fs = { readFile: vi.fn().mockRejectedValue(new Error('ENOENT')) };
    const svc = createSeedService({ config, propertiesService, fs });
    expect(await svc.resolve({}, 'bedrock')).toBeNull();
  });
});

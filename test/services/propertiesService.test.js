import { describe, it, expect, vi } from 'vitest';
import { createPropertiesService } from '../../src/services/propertiesService.js';

const SAMPLE = `#Minecraft server properties
#Mon Jul 18
difficulty=easy
pvp=true
max-players=20`;

function makeFs(content) {
  const store = { value: content };
  return {
    store,
    readFile: vi.fn().mockImplementation(async () => store.value),
    writeFile: vi.fn().mockImplementation(async (_p, data) => { store.value = data; }),
  };
}

describe('propertiesService', () => {
  it('parses key=value ignoring comments', () => {
    const svc = createPropertiesService({ mcDataPath: '/d' }, makeFs(SAMPLE));
    const obj = svc.parse(SAMPLE);
    expect(obj).toEqual({ difficulty: 'easy', pvp: 'true', 'max-players': '20' });
  });

  it('serialize preserves comments and updates values', () => {
    const svc = createPropertiesService({ mcDataPath: '/d' }, makeFs(SAMPLE));
    const out = svc.serialize({ difficulty: 'hard', pvp: 'true', 'max-players': '20' }, SAMPLE);
    expect(out).toContain('#Minecraft server properties');
    expect(out).toContain('difficulty=hard');
  });

  it('update merges patch and writes file', async () => {
    const fs = makeFs(SAMPLE);
    const svc = createPropertiesService({ mcDataPath: '/d' }, fs);
    const merged = await svc.update({ difficulty: 'hard' });
    expect(merged.difficulty).toBe('hard');
    expect(fs.writeFile).toHaveBeenCalled();
    expect(fs.store.value).toContain('difficulty=hard');
  });

  it('update appends new keys not present originally', async () => {
    const fs = makeFs(SAMPLE);
    const svc = createPropertiesService({ mcDataPath: '/d' }, fs);
    await svc.update({ motd: 'Hello' });
    expect(fs.store.value).toContain('motd=Hello');
  });
});

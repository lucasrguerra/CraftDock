import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { createStdinService } from '../../src/services/stdinService.js';

describe('stdinService', () => {
  it('writes command with newline and captures output window', async () => {
    const stream = new PassThrough();
    const dockerService = { attach: vi.fn().mockResolvedValue(stream) };
    const svc = createStdinService(dockerService, { windowMs: 20 });

    const p = svc.send('list');
    // simulate server echoing output
    setTimeout(() => stream.write('There are 2 players online\n'), 5);
    const out = await p;

    expect(out).toContain('2 players online');
  });

  it('appends a newline to the written command', async () => {
    const stream = new PassThrough();
    const written = [];
    stream.write = (chunk) => { written.push(chunk.toString()); return true; };
    const dockerService = { attach: vi.fn().mockResolvedValue(stream) };
    const svc = createStdinService(dockerService, { windowMs: 5 });
    await svc.send('op steve');
    expect(written[0]).toBe('op steve\n');
  });
});

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

  it('serializes concurrent sends (no interleaving)', async () => {
    const stream = new PassThrough();
    const order = [];
    // Track write order to prove serialization
    const originalWrite = stream.write.bind(stream);
    stream.write = (chunk) => {
      order.push(chunk.toString().trim());
      return originalWrite(chunk);
    };

    const dockerService = { attach: vi.fn().mockResolvedValue(stream) };
    const svc = createStdinService(dockerService, { windowMs: 15 });

    // Fire 3 commands concurrently — they must NOT overlap
    const p1 = svc.send('cmd1');
    const p2 = svc.send('cmd2');
    const p3 = svc.send('cmd3');

    // Simulate server responses with slight delays
    setTimeout(() => stream.push('reply1\n'), 5);
    setTimeout(() => stream.push('reply2\n'), 25);
    setTimeout(() => stream.push('reply3\n'), 45);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    // Commands must have been written in order (serialized)
    expect(order).toEqual(['cmd1', 'cmd2', 'cmd3']);
    // Each response captured in its own window
    expect(r1).toContain('reply1');
    expect(r2).toContain('reply2');
    expect(r3).toContain('reply3');
  });

  it('queue continues even if a command rejects (stream error)', async () => {
    let callCount = 0;
    const dockerService = {
      attach: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call: return a stream that immediately errors on write
          const bad = new PassThrough();
          bad.write = () => { throw new Error('broken pipe'); };
          return bad;
        }
        // Second call: return a healthy stream
        const good = new PassThrough();
        setTimeout(() => good.push('ok\n'), 3);
        return good;
      }),
    };
    const svc = createStdinService(dockerService, { windowMs: 10 });

    // First send should reject
    await expect(svc.send('bad')).rejects.toThrow('broken pipe');

    // The service must recover (re-attach) and the queue must not be stuck
    const result = await svc.send('good');
    expect(result).toContain('ok');
  });
});

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
    stream.write = (...args) => {
      order.push(args[0].toString().trim());
      return originalWrite(...args);
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

  it('re-attaches after the stream ends (e.g. container stop/start on world import)', async () => {
    const stream1 = new PassThrough();
    const stream2 = new PassThrough();
    let n = 0;
    const dockerService = {
      attach: vi.fn().mockImplementation(async () => (++n === 1 ? stream1 : stream2)),
    };
    const svc = createStdinService(dockerService, { windowMs: 5 });

    await svc.send('a');
    expect(dockerService.attach).toHaveBeenCalledTimes(1);

    // Container stopped: the attach stream ends. A stale, non-destroyed stream
    // must NOT be reused — the next command has to re-attach.
    stream1.emit('end');
    await new Promise((r) => setTimeout(r, 1));

    setTimeout(() => stream2.push('ok\n'), 2);
    const out = await svc.send('b');
    expect(dockerService.attach).toHaveBeenCalledTimes(2);
    expect(out).toContain('ok');
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

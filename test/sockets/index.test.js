import { describe, it, expect, vi } from 'vitest';
import { registerSockets } from '../../src/sockets/index.js';

describe('registerSockets', () => {
  it('creates /logs and /status namespaces with auth middleware', () => {
    const namespaces = {};
    const io = {
      of: vi.fn((name) => {
        const ns = { use: vi.fn(), on: vi.fn() };
        namespaces[name] = ns;
        return ns;
      }),
    };
    registerSockets(io, {
      dockerService: {}, appState: {}, sessionMiddleware: (req, res, next) => next(),
    });
    expect(io.of).toHaveBeenCalledWith('/logs');
    expect(io.of).toHaveBeenCalledWith('/status');
    expect(namespaces['/logs'].use).toHaveBeenCalled();
    expect(namespaces['/status'].use).toHaveBeenCalled();
  });
});

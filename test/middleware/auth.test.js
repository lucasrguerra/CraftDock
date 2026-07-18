import { describe, it, expect, vi } from 'vitest';
import { requireAuth, socketAuth } from '../../src/middleware/auth.js';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('requireAuth', () => {
  it('calls next when session is authed', () => {
    const next = vi.fn();
    requireAuth({ session: { authed: true } }, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 when not authed', () => {
    const next = vi.fn();
    const res = mockRes();
    requireAuth({ session: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });
});

describe('socketAuth', () => {
  it('calls next with no error when session is authed', () => {
    const next = vi.fn();
    const socket = { request: {} };
    const fakeSessionMiddleware = (req, res, callback) => {
      req.session = { authed: true };
      callback();
    };

    const middleware = socketAuth(fakeSessionMiddleware);
    middleware(socket, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with unauthorized error when not authed', () => {
    const next = vi.fn();
    const socket = { request: {} };
    const fakeSessionMiddleware = (req, res, callback) => {
      req.session = {};
      callback();
    };

    const middleware = socketAuth(fakeSessionMiddleware);
    middleware(socket, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('unauthorized');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { registerLogsSocket } from '../../src/sockets/logsSocket.js';

function fakeNamespace() {
  const ns = new EventEmitter();
  ns.on = ns.on.bind(ns);
  return ns;
}
function fakeSocket() {
  const s = new EventEmitter();
  s.emit = s.emit.bind(s);
  s.emitted = [];
  const origEmit = s.emit;
  s.emit = (ev, payload) => { s.emitted.push([ev, payload]); return origEmit(ev, payload); };
  return s;
}

describe('logsSocket', () => {
  it('streams log chunks to the client', async () => {
    const logStream = new PassThrough();
    const dockerService = { logStream: vi.fn().mockResolvedValue(logStream) };
    const appState = { getAdapter: vi.fn().mockResolvedValue({ sendCommand: vi.fn() }) };
    const ns = fakeNamespace();
    registerLogsSocket(ns, { dockerService, appState });

    const socket = fakeSocket();
    ns.emit('connection', socket);
    await new Promise((r) => setTimeout(r, 10)); // allow async logStream()

    logStream.write('hello world');
    await new Promise((r) => setTimeout(r, 5));

    const logs = socket.emitted.filter(([ev]) => ev === 'log').map(([, p]) => p);
    expect(logs.join('')).toContain('hello world');
  });

  it('routes command events to adapter.sendCommand', async () => {
    const logStream = new PassThrough();
    const sendCommand = vi.fn().mockResolvedValue('command result');
    const dockerService = { logStream: vi.fn().mockResolvedValue(logStream) };
    const appState = { getAdapter: vi.fn().mockResolvedValue({ sendCommand }) };
    const ns = fakeNamespace();
    registerLogsSocket(ns, { dockerService, appState });

    const socket = fakeSocket();
    ns.emit('connection', socket);
    await new Promise((r) => setTimeout(r, 10));

    socket.emit('command', 'list');
    await new Promise((r) => setTimeout(r, 5));

    expect(sendCommand).toHaveBeenCalledWith('list');
  });
});

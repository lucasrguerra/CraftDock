export function registerLogsSocket(namespace, { dockerService, appState }) {
  namespace.on('connection', async (socket) => {
    let stream = null;
    try {
      stream = await dockerService.logStream();
      const onData = (chunk) => socket.emit('log', chunk.toString());
      stream.on('data', onData);
      socket.on('disconnect', () => {
        stream?.off?.('data', onData);
        stream?.destroy?.();
      });
    } catch (err) {
      socket.emit('log', `[craftdock] log stream unavailable: ${err.message}\n`);
    }

    socket.on('command', async (cmd) => {
      try {
        const adapter = await appState.getAdapter();
        const output = await adapter.sendCommand(cmd);
        if (output) socket.emit('log', `> ${cmd}\n${output}\n`);
      } catch (err) {
        socket.emit('log', `[craftdock] command failed: ${err.message}\n`);
      }
    });
  });
}

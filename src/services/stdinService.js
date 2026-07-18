export function createStdinService(dockerService, { windowMs = 300 } = {}) {
  let stream = null;

  async function ensure() {
    if (stream && !stream.destroyed) return stream;
    stream = await dockerService.attach();
    return stream;
  }

  return {
    async send(cmd) {
      const s = await ensure();
      return new Promise((resolve) => {
        let buf = '';
        const onData = (chunk) => { buf += chunk.toString(); };
        s.on('data', onData);
        s.write(cmd + '\n');
        setTimeout(() => {
          s.off('data', onData);
          resolve(buf.trim());
        }, windowMs);
      });
    },
  };
}

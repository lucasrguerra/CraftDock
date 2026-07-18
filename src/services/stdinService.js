export function createStdinService(dockerService, { windowMs = 300, logger } = {}) {
  let stream = null;
  // Mutex: each send() chains on the previous one so only one command is in
  // flight at a time. This prevents response interleaving on the shared
  // Docker attach stream (the root cause of Bedrock command corruption).
  let tail = Promise.resolve();

  async function ensure() {
    if (stream && !stream.destroyed) return stream;
    stream = await dockerService.attach();
    return stream;
  }

  function exec(cmd) {
    return new Promise(async (resolve, reject) => {
      let s;
      try {
        s = await ensure();
      } catch (err) {
        return reject(err);
      }
      logger?.debug('stdin >', { cmd });
      try {
        let buf = '';
        const onData = (chunk) => { buf += chunk.toString(); };
        s.on('data', onData);
        s.write(cmd + '\n');
        setTimeout(() => {
          s.off('data', onData);
          const out = buf.trim();
          logger?.debug('stdin <', { cmd, out });
          resolve(out);
        }, windowMs);
      } catch (err) {
        // Stream broke — force re-attach on next call
        stream = null;
        reject(err);
      }
    });
  }

  return {
    send(cmd) {
      const p = tail.then(() => exec(cmd));
      // Always advance the tail, even on failure, so the queue never stalls
      tail = p.catch(() => {});
      return p;
    },
  };
}

export function createStdinService(dockerService, { windowMs = 300, timeoutMs = 3000, logger } = {}) {
  let stream = null;
  // Mutex: each send() chains on the previous one so only one command is in
  // flight at a time. This prevents response interleaving on the shared
  // Docker attach stream (the root cause of Bedrock command corruption).
  let tail = Promise.resolve();

  async function ensure() {
    if (stream && !stream.destroyed) return stream;

    // Timeout for attach call in case Docker API stalls
    let attachTimer;
    const attachPromise = dockerService.attach();
    const timeoutPromise = new Promise((_, reject) => {
      attachTimer = setTimeout(() => reject(new Error('docker attach timeout')), timeoutMs);
    });

    try {
      const s = await Promise.race([attachPromise, timeoutPromise]);
      clearTimeout(attachTimer);
      stream = s;
      // When the container stops/restarts (e.g. during a world import) the attach
      // stream ends but is not always flagged `.destroyed`. Invalidate the cache on
      // end/close/error so the next command re-attaches to the fresh process
      // instead of writing into a dead stream (which left `list` returning nothing).
      const invalidate = () => { if (stream === s) stream = null; };
      s.once('end', invalidate);
      s.once('close', invalidate);
      s.once('error', invalidate);
      return s;
    } catch (err) {
      clearTimeout(attachTimer);
      stream = null;
      throw err;
    }
  }

  function exec(cmd) {
    return new Promise((resolve, reject) => {
      let s = null;
      let safetyTimer = null;
      let windowTimer = null;
      let onData = null;
      let isDone = false;

      const cleanup = () => {
        if (safetyTimer) clearTimeout(safetyTimer);
        if (windowTimer) clearTimeout(windowTimer);
        if (s && onData) {
          try { s.off('data', onData); } catch {}
        }
      };

      // Safety timeout for the entire command execution
      safetyTimer = setTimeout(() => {
        if (isDone) return;
        isDone = true;
        logger?.warn('stdin command timed out', { cmd, timeoutMs });
        cleanup();
        if (stream === s) stream = null;
        if (s && !s.destroyed) {
          try { s.destroy(); } catch {}
        }
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${cmd}`));
      }, timeoutMs);

      ensure()
        .then((attachedStream) => {
          if (isDone) return;
          s = attachedStream;
          logger?.debug('stdin >', { cmd });
          let buf = '';
          onData = (chunk) => { buf += chunk.toString(); };
          s.on('data', onData);
          s.write(cmd + '\n', (err) => {
            if (err) {
              if (isDone) return;
              isDone = true;
              logger?.warn('stdin write error', { cmd, error: err.message });
              cleanup();
              if (stream === s) stream = null;
              return reject(err);
            }
          });

          windowTimer = setTimeout(() => {
            if (isDone) return;
            isDone = true;
            cleanup();
            const out = buf.trim();
            logger?.debug('stdin <', { cmd, out });
            resolve(out);
          }, windowMs);
        })
        .catch((err) => {
          if (isDone) return;
          isDone = true;
          logger?.warn('stdin ensure failed', { cmd, error: err.message });
          cleanup();
          if (stream === s) stream = null;
          reject(err);
        });
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


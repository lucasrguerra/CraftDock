import fs from 'node:fs';

const failFile = '/tmp/health_failures';

async function check() {
  try {
    // Abort before Docker's own `timeout` (5s) SIGKILLs this process. If the app
    // hangs (event loop blocked), an untimed fetch stays pending until Docker kills
    // us — the catch below never runs, the failure counter never advances, and the
    // self-restart (kill PID 1) never fires. A 4s AbortSignal guarantees the catch
    // runs first so the counter advances and the container can heal itself.
    const res = await fetch('http://127.0.0.1:3000/api/health', {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      try { fs.unlinkSync(failFile); } catch {}
      process.exit(0);
    } else {
      throw new Error('Not OK');
    }
  } catch (err) {
    let fails = 0;
    try {
      fails = parseInt(fs.readFileSync(failFile, 'utf8')) || 0;
    } catch {}
    fails++;
    
    if (fails >= 3) {
      try { fs.unlinkSync(failFile); } catch {}
      // Kill PID 1 to force compose restart
      process.kill(1, 'SIGKILL');
      process.exit(1);
    }
    
    fs.writeFileSync(failFile, String(fails));
    process.exit(1);
  }
}

check();

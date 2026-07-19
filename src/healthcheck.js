import fs from 'node:fs';

const failFile = '/tmp/health_failures';

async function check() {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/health');
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

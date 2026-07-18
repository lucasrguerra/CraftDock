// scripts/hash-password.js
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash -- <password>');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
const b64 = Buffer.from(hash, 'utf8').toString('base64');

process.stdout.write(
  `# Pick ONE. Set it as an environment variable.\n` +
  `\n` +
  `# Raw hash — use with 'npm run dev' (plain .env, no interpolation):\n` +
  `ADMIN_PASSWORD_HASH=${hash}\n` +
  `\n` +
  `# Base64 hash — use with docker compose / Coolify (no '$' escaping needed):\n` +
  `ADMIN_PASSWORD_HASH_B64=${b64}\n`,
);

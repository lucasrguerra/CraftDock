// scripts/hash-password.js
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash -- <password>');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
process.stdout.write(hash + '\n');

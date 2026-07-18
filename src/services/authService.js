import bcrypt from 'bcryptjs';

export function createAuthService(config) {
  return {
    async verifyPassword(plain) {
      if (!plain) return false;
      return bcrypt.compare(plain, config.adminPasswordHash);
    },
  };
}

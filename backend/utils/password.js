const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

function isBcryptHash(password) {
  return typeof password === 'string' && /^\$2[aby]?\$/.test(password);
}

async function hashPassword(password) {
  const value = String(password || '');
  if (!value) return value;
  if (isBcryptHash(value)) return value;
  return bcrypt.hash(value, SALT_ROUNDS);
}

async function verifyPassword(password, storedPassword) {
  const candidate = String(password || '');
  const stored = String(storedPassword || '');

  if (!candidate || !stored) return false;
  if (isBcryptHash(stored)) return bcrypt.compare(candidate, stored);
  return candidate === stored;
}

module.exports = { hashPassword, verifyPassword, isBcryptHash };
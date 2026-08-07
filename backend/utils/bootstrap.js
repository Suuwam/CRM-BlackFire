const User = require('../models/User');
const { verifyPassword } = require('./password');

async function ensureBootstrapAdmin() {
  const username = 'admin';
  const email = 'admin@blackfire.local';
  const password = 'blackfire';

  const existing = await User.findOne({ username });
  if (existing) {
    return existing;
  }

  return User.create({
    name: 'Blackfire Admin',
    username,
    email,
    password,
    role: 'admin',
    active: true,
  });
}

module.exports = { ensureBootstrapAdmin };
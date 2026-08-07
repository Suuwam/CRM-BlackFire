const User = require('../models/User');
const { verifyPassword } = require('./password');

async function ensureBootstrapAdmin() {
  try {
    const username = 'admin';
    const email = 'admin@blackfire.local';
    const password = 'blackfire';

    const existing = await User.findOne({ username });
    if (existing) {
      const passwordMatches = await verifyPassword(password, existing.password);
      if (existing.role !== 'admin' || !existing.active || existing.email !== email || !passwordMatches) {
        existing.name = existing.name || 'Blackfire Admin';
        existing.email = email;
        existing.password = password;
        existing.role = 'admin';
        existing.active = true;
        await existing.save();
      }
      return existing;
    }

    return await User.create({
      name: 'Blackfire Admin',
      username,
      email,
      password,
      role: 'admin',
      active: true,
    });
  } catch (err) {
    console.error('ensureBootstrapAdmin error:', err.message);
  }
}

module.exports = { ensureBootstrapAdmin };
const User = require('../models/User');

// First-run only: make a default admin when the CRM has no admin at all, so a fresh
// database can be signed into. It never touches an existing account; it used to reset
// admin's password on every login, which undid password changes and left the
// default (published in this repo) working forever.
let checked = false;

async function ensureBootstrapAdmin() {
  if (checked) return;
  try {
    if (!(await User.exists({ role: 'admin' }))) {
      await User.create({
        name: 'Blackfire Admin',
        username: 'admin',
        email: 'admin@blackfire.local',
        password: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'blackfire', // change it right after first sign-in
        role: 'admin',
        active: true,
      });
    }
    checked = true;
  } catch (err) {
    console.error('ensureBootstrapAdmin error:', err.message);
  }
}

module.exports = { ensureBootstrapAdmin };

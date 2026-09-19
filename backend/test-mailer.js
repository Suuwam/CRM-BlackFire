// Self-check for the mail guard. Run: node backend/test-mailer.js
// Misconfigured SMTP used to return { skipped: true }, which /email/bulk counted as
// "sent" — the UI reported success while nothing left the building. It must throw.
const assert = require('assert');

for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) delete process.env[k];

const { sendMail } = require('./utils/mailer');
const mail = { to: 'a@b.test', subject: 'hi', text: 'hi' };

(async () => {
  await assert.rejects(sendMail(mail), /not configured/, 'missing SMTP config must throw, not resolve');

  // A partial config is still no config — one missing credential is enough.
  process.env.SMTP_HOST = 'smtp.example.test';
  process.env.SMTP_USER = 'user@example.test';
  await assert.rejects(sendMail(mail), /not configured/, 'missing SMTP_PASS must throw');

  console.log('✓ mailer: unconfigured SMTP fails loudly instead of reporting success');
})().catch(e => { console.error('✗', e.message); process.exit(1); });

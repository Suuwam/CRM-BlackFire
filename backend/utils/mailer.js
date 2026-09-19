const nodemailer = require('nodemailer');

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user, pass },
  });
}

async function sendMail({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport) {
    throw new Error('Mail is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)');
  }

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  return transport.sendMail({ from, to, subject, text, html });
}

module.exports = { sendMail };
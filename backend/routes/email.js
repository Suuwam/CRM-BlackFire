const router = require('express').Router();
const Client = require('../models/Client');
const { requireSessionUser } = require('../utils/session');
const { sendMail } = require('../utils/mailer');
const { rateLimit } = require('../utils/rateLimit');
const { recordActivity } = require('../utils/activity');

const sendLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, prefix: 'email-send', message: 'Too many emails sent. Please slow down.' });

function substitute(text, client) {
  if (!client || !text) return text || '';
  return text
    .replace(/\{\{name\}\}/g,    client.name    || '')
    .replace(/\{\{company\}\}/g, client.company || '')
    .replace(/\{\{email\}\}/g,   client.email   || '')
    .replace(/\{\{phone\}\}/g,   client.phone   || '')
    .replace(/\{\{project\}\}/g, client.project || '');
}

// POST /email/send — send one template to one client
router.post('/send', requireSessionUser, sendLimiter, async (req, res) => {
  try {
    const { clientId, subject, body } = req.body || {};
    if (!clientId || !subject || !body) {
      return res.status(400).json({ error: 'clientId, subject, and body are required' });
    }

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.email) return res.status(400).json({ error: 'Client has no email address' });

    const personalSubject = substitute(subject, client);
    const personalBody    = substitute(body,    client);

    const html = `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111;max-width:600px;white-space:pre-wrap">${personalBody.replace(/\n/g,'<br/>')}</div>`;

    await sendMail({ to: client.email, subject: personalSubject, text: personalBody, html });

    await recordActivity({
      action: 'send_email',
      targetType: 'email',
      targetId: client._id,
      targetName: client.name,
      project: client.project || '',
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      summary: `Sent email to ${client.name} (${client.email}): "${personalSubject}"`,
    });

    res.json({ ok: true, to: client.email });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /email/bulk — send one template to multiple clients
router.post('/bulk', requireSessionUser, sendLimiter, async (req, res) => {
  try {
    const { clientIds, subject, body } = req.body || {};
    if (!Array.isArray(clientIds) || !clientIds.length || !subject || !body) {
      return res.status(400).json({ error: 'clientIds (array), subject, and body are required' });
    }

    const clients = await Client.find({ _id: { $in: clientIds } });
    const results = [];

    for (const client of clients) {
      if (!client.email) {
        results.push({ name: client.name, status: 'skipped', reason: 'no email' });
        continue;
      }
      try {
        const personalSubject = substitute(subject, client);
        const personalBody    = substitute(body,    client);
        const html = `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111;max-width:600px;white-space:pre-wrap">${personalBody.replace(/\n/g,'<br/>')}</div>`;
        await sendMail({ to: client.email, subject: personalSubject, text: personalBody, html });
        results.push({ name: client.name, email: client.email, status: 'sent' });
      } catch (e) {
        results.push({ name: client.name, email: client.email, status: 'failed', reason: e.message });
      }
    }

    const sent   = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    await recordActivity({
      action: 'bulk_email',
      targetType: 'email',
      targetName: `${sent} clients`,
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      summary: `Sent bulk email campaign to ${sent} client(s): "${subject}"`,
    });

    res.json({ ok: true, sent, failed, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

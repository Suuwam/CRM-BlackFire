const router = require('express').Router();
const User = require('../models/User');
const { requireSessionUser } = require('../utils/session');
const { sendMail } = require('../utils/mailer');
const { rateLimit } = require('../utils/rateLimit');
const { recordActivity } = require('../utils/activity');

const sendLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, prefix: 'email-send', message: 'Too many emails sent. Please slow down.' });

function substitute(text, employee) {
  if (!employee || !text) return text || '';
  return text
    .replace(/\{\{name\}\}/g,     employee.name     || '')
    .replace(/\{\{email\}\}/g,    employee.email    || '')
    .replace(/\{\{username\}\}/g, employee.username || '')
    .replace(/\{\{role\}\}/g,     employee.role     || '');
}

function wrap(body) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111;max-width:600px;white-space:pre-wrap">${body.replace(/\n/g, '<br/>')}</div>`;
}

// POST /email/bulk — one template to many employees
router.post('/bulk', requireSessionUser, sendLimiter, async (req, res) => {
  try {
    const { employeeIds, subject, body } = req.body || {};
    if (!Array.isArray(employeeIds) || !employeeIds.length || !subject || !body) {
      return res.status(400).json({ error: 'employeeIds (array), subject, and body are required' });
    }

    const employees = await User.find({ _id: { $in: employeeIds } });
    const results = [];

    for (const employee of employees) {
      if (!employee.email) {
        results.push({ name: employee.name, status: 'skipped', reason: 'no email' });
        continue;
      }
      try {
        const personalSubject = substitute(subject, employee);
        const personalBody    = substitute(body,    employee);
        await sendMail({ to: employee.email, subject: personalSubject, text: personalBody, html: wrap(personalBody) });
        results.push({ name: employee.name, email: employee.email, status: 'sent' });
      } catch (e) {
        results.push({ name: employee.name, email: employee.email, status: 'failed', reason: e.message });
      }
    }

    const sent   = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    await recordActivity({
      action: 'bulk_email',
      targetType: 'email',
      targetName: `${sent} employees`,
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      summary: `Sent bulk email to ${sent} employee(s): "${subject}"`,
    });

    res.json({ ok: true, sent, failed, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

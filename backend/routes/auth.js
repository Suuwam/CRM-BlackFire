const router = require('express').Router();
const User = require('../models/User');
const Activity = require('../models/Activity');
const AccountApplication = require('../models/AccountApplication');
const { sanitizeUser, getSessionUser, requireSessionUser } = require('../utils/session');
const { ensureBootstrapAdmin } = require('../utils/bootstrap');
const { sendMail } = require('../utils/mailer');
const { rateLimit } = require('../utils/rateLimit');
const { verifyPassword, isBcryptHash } = require('../utils/password');

const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, prefix: 'auth-login', message: 'Too many login attempts. Please try again later.' });
const applyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, prefix: 'auth-apply', message: 'Too many account requests. Please try again later.' });

router.post('/login', loginLimiter, async (req, res) => {
  try {
    await ensureBootstrapAdmin();
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username: String(username).trim().toLowerCase() });
    const passwordMatch = user ? await verifyPassword(String(password), user.password) : false;
    if (!user || !user.active || !passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!isBcryptHash(user.password)) {
      user.password = String(password);
      user.markModified('password');
      await user.save();
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/apply', applyLimiter, async (req, res) => {
  try {
    await ensureBootstrapAdmin();
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const desiredUsername = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();
    const note = String(req.body?.note || '').trim();

    if (!name || !email || !desiredUsername || !password) {
      return res.status(400).json({ error: 'Name, email, username, and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ error: 'Password must contain at least one letter and one number.' });
    }

    const userExists = await User.findOne({
      $or: [
        { username: desiredUsername.toLowerCase() },
        { email: email.toLowerCase() }
      ]
    });
    if (userExists) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const appExists = await AccountApplication.findOne({
      $or: [
        { username: desiredUsername.toLowerCase() },
        { email: email.toLowerCase() }
      ],
      status: 'pending',
      isEmailVerified: true
    });
    if (appExists) {
      return res.status(400).json({ error: 'An application is already pending for this username or email' });
    }

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    await AccountApplication.deleteMany({
      $or: [
        { username: desiredUsername.toLowerCase() },
        { email: email.toLowerCase() }
      ],
      isEmailVerified: false
    });

    const verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);
    const application = await AccountApplication.create({
      name,
      email,
      username: desiredUsername,
      password,
      note,
      verificationCode,
      verificationCodeExpiry,
      isEmailVerified: false
    });

    console.log(`\n🔥 [VERIFICATION CODE] Email: ${email} -> Code: ${verificationCode}\n`);

    const verifySubject = `Verify your email for Blackfire CRM`;
    const verifyText = `Your 6-digit email verification code is: ${verificationCode}`;
    const verifyHtml = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:480px">
        <h2 style="margin:0 0 12px;color:#111">Email Verification</h2>
        <p>Please use the following 6-digit code to complete your Blackfire CRM account application:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0;padding:16px 24px;background:#f4f4f5;border-radius:8px;display:inline-block;color:#111">${verificationCode}</div>
        <p style="color:#555;font-size:13px">This code expires in <strong>5 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
      </div>
    `;

    try {
      await sendMail({ to: email, subject: verifySubject, text: verifyText, html: verifyHtml });
    } catch (mailErr) {
      console.error('Verification mail failed:', mailErr);
    }

    const adminRecipient = process.env.ACCOUNT_REQUEST_TO || process.env.ADMIN_EMAIL || 'admin@blackfire.local';
    const adminSubject = `[Blackfire CRM] New account request from ${name}`;
    const adminText = [
      'A new account application was submitted and is awaiting email verification.',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Username: @${desiredUsername}`,
      `Note: ${note || 'None'}`,
      '',
      'The applicant must verify their email before their request appears in the admin panel.',
    ].join('\n');
    const adminHtml = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:480px">
        <h2 style="margin:0 0 4px;color:#111">New Account Application</h2>
        <p style="margin:0 0 16px;color:#555;font-size:13px">Awaiting email verification from applicant.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#555;width:90px">Name</td><td style="padding:6px 0;font-weight:600">${name}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Email</td><td style="padding:6px 0;font-weight:600">${email}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Username</td><td style="padding:6px 0;font-weight:600">@${desiredUsername}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Note</td><td style="padding:6px 0;font-weight:600">${note || '—'}</td></tr>
        </table>
        <p style="margin-top:20px;font-size:12px;color:#888">Once verified, this request will appear in your Accounts panel for approval or rejection.</p>
      </div>
    `;

    try {
      await sendMail({ to: adminRecipient, subject: adminSubject, text: adminText, html: adminHtml });
    } catch (mailErr) {
      console.error('Admin notification mail failed:', mailErr);
    }

    await Activity.create({
      action: 'applied',
      targetType: 'application',
      targetName: desiredUsername,
      actorName: name,
      summary: `${name} requested an account as ${desiredUsername} (verification pending)`,
    });

    res.json({ ok: true, id: application._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/apply/verify', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const app = await AccountApplication.findOne({ email, status: 'pending', isEmailVerified: false });
    if (!app) {
      return res.status(400).json({ error: 'No unverified application found for this email address.' });
    }

    if (app.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    if (app.verificationCodeExpiry && new Date() > app.verificationCodeExpiry) {
      await AccountApplication.deleteOne({ _id: app._id });
      return res.status(400).json({ error: 'Verification code has expired. Please submit a new application.' });
    }

    app.isEmailVerified = true;
    app.verificationCode = undefined;
    await app.save();

    const recipient = process.env.ACCOUNT_REQUEST_TO || process.env.ADMIN_EMAIL || 'admin@blackfire.local';
    const subject = `Verified Account Request from ${app.name}`;
    const text = [
      'A new verified account request was submitted and is pending approval.',
      '',
      `Name: ${app.name}`,
      `Email: ${app.email}`,
      `Username: @${app.username}`,
      `Note: ${app.note || 'None'}`,
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">Verified Account Request</h2>
        <ul style="padding-left:18px;margin:0">
          <li><strong>Name:</strong> ${app.name}</li>
          <li><strong>Email:</strong> ${app.email}</li>
          <li><strong>Username:</strong> @${app.username}</li>
          <li><strong>Note:</strong> ${app.note || 'None'}</li>
        </ul>
      </div>
    `;

    try {
      await sendMail({ to: recipient, subject, text, html });
    } catch (mailErr) {
      console.error('Mail notification to admin failed:', mailErr);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const profileLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, prefix: 'auth-me', message: 'Too many profile updates. Please slow down.' });

router.put('/me', requireSessionUser, profileLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.sessionUser._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const name = req.body.name != null ? String(req.body.name).trim() : user.name;
    const email = req.body.email != null ? String(req.body.email).trim().toLowerCase() : user.email;

    if (!name) return res.status(400).json({ error: 'Name is required' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    if (email !== user.email) {
      const taken = await User.findOne({ email, _id: { $ne: user._id } });
      if (taken) return res.status(400).json({ error: 'Email is already in use' });
    }

    user.name = name;
    user.email = email;

    if (req.body.newPassword) {
      const currentPassword = String(req.body.currentPassword || '');
      const newPassword = String(req.body.newPassword);
      if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
      const match = await verifyPassword(currentPassword, user.password);
      if (!match) return res.status(400).json({ error: 'Current password is incorrect' });
      if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({ error: 'Password must contain at least one letter and one number.' });
      }
      user.password = newPassword;
      user.markModified('password');
    }

    await user.save();
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

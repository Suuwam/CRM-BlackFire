const router = require('express').Router();
const User = require('../models/User');
const AccountApplication = require('../models/AccountApplication');
const { sanitizeUser, requireSessionUser, requireAdmin } = require('../utils/session');
const { rateLimit } = require('../utils/rateLimit');
const { recordActivity } = require('../utils/activity');

router.use(requireSessionUser);
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, prefix: 'users-write', message: 'Too many account changes. Please slow down.' });

router.get('/', async (_, res) => {
  try {
    const users = await User.find().sort({ name: 1 });
    res.json(users.map(sanitizeUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      username: String(req.body.username || '').trim().toLowerCase(),
      email: String(req.body.email || '').trim().toLowerCase(),
      password: req.body.password,
      role: req.body.role === 'admin' ? 'admin' : 'member',
      active: req.body.active !== false,
    };

    const user = await User.create(payload);
    await recordActivity({
      action: 'created',
      targetType: 'account',
      targetId: user._id,
      targetName: user.name,
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      summary: `${req.sessionUser.name} created account ${user.name}`,
    });
    res.status(201).json(sanitizeUser(user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      username: String(req.body.username || '').trim().toLowerCase(),
      email: String(req.body.email || '').trim().toLowerCase(),
      role: req.body.role === 'admin' ? 'admin' : 'member',
      active: req.body.active !== false,
    };

    if (req.body.password) payload.password = req.body.password;

    const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (user) {
      await recordActivity({
        action: 'updated',
        targetType: 'account',
        targetId: user._id,
        targetName: user.name,
        actorId: req.sessionUser._id,
        actorName: req.sessionUser.name,
        summary: `${req.sessionUser.name} updated account ${user.name}`,
      });
    }
    res.json(sanitizeUser(user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', requireAdmin, writeLimiter, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.sessionUser._id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (user) {
      await recordActivity({
        action: 'deleted',
        targetType: 'account',
        targetId: user._id,
        targetName: user.name,
        actorId: req.sessionUser._id,
        actorName: req.sessionUser.name,
        summary: `${req.sessionUser.name} deleted account ${user.name}`,
      });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/applications', requireAdmin, async (req, res) => {
  try {
    const apps = await AccountApplication.find({ isEmailVerified: true }).sort({ createdAt: -1 });
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/applications/approve-all', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const apps = await AccountApplication.find({
      status: { $in: ['pending', 'rejected'] }
    });

    let count = 0;
    for (const app of apps) {
      let userExists = await User.findOne({
        $or: [
          { username: app.username },
          { email: app.email }
        ]
      });

      if (!userExists) {
        let username = app.username;
        const takenUsername = await User.findOne({ username });
        if (takenUsername) {
          username = app.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        }

        await User.create({
          name: app.name,
          username,
          email: app.email,
          password: app.password,
          role: 'member',
          active: true
        });
      }

      app.status = 'approved';
      app.isEmailVerified = true;
      app.reviewedBy = req.sessionUser._id;
      app.reviewedAt = new Date();
      await app.save();

      await recordActivity({
        action: 'approved',
        targetType: 'application',
        targetId: app._id,
        targetName: app.username,
        actorId: req.sessionUser._id,
        actorName: req.sessionUser.name,
        summary: `${req.sessionUser.name} approved account application for ${app.username}`,
      });

      count++;
    }

    res.json({ ok: true, count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/applications/:id/approve', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const app = await AccountApplication.findById(req.params.id);
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (app.status === 'approved') {
      return res.status(400).json({ error: 'Application is already approved' });
    }

    // Check if user already exists
    let userExists = await User.findOne({ email: app.email });
    if (!userExists) {
      let username = app.username;
      const takenUsername = await User.findOne({ username });
      if (takenUsername) {
        username = app.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      }

      userExists = await User.create({
        name: app.name,
        username,
        email: app.email,
        password: app.password, // already hashed
        role: 'member',
        active: true
      });
    }

    app.status = 'approved';
    app.reviewedBy = req.sessionUser._id;
    app.reviewedAt = new Date();
    await app.save();

    await recordActivity({
      action: 'approved',
      targetType: 'application',
      targetId: app._id,
      targetName: app.username,
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      summary: `${req.sessionUser.name} approved account application for ${app.username}`,
    });

    res.json({ ok: true, user: sanitizeUser(userExists) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/applications/:id/reject', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const app = await AccountApplication.findById(req.params.id);
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    app.status = 'rejected';
    app.reviewedBy = req.sessionUser._id;
    app.reviewedAt = new Date();
    await app.save();

    await recordActivity({
      action: 'rejected',
      targetType: 'application',
      targetId: app._id,
      targetName: app.username,
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      summary: `${req.sessionUser.name} rejected account application for ${app.username}`,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
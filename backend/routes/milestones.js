const router = require('express').Router();
const mongoose = require('mongoose');
const Milestone = require('../models/Milestone');
const { requireSessionUser } = require('../utils/session');
const { rateLimit } = require('../utils/rateLimit');
const { recordActivity } = require('../utils/activity');

router.use(requireSessionUser);
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, prefix: 'milestones-write', message: 'Too many milestone changes. Please slow down.' });
const PER_PAGE = 10;

function validateId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID format' });
  next();
}

function requireMilestoneAccess(req, res, next) {
  const u = req.sessionUser;
  if (u.role === 'admin' || u.milestoneAccess) return next();
  res.status(403).json({ error: 'You do not have permission to change milestones' });
}

// Every write lands in the activity feed, which is what the notification bell shows everyone.
function notify(req, action, m) {
  return recordActivity({
    action,
    targetType: 'milestone',
    targetId: m._id,
    targetName: m.title,
    actorId: req.sessionUser._id,
    actorName: req.sessionUser.name,
    summary: `${req.sessionUser.name} ${action} milestone "${m.title}"`,
  });
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(0, Number(req.query.page) || 0);
    // The page asks for as many as fit on screen; capped so one request stays small.
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || PER_PAGE));
    const [total, items] = await Promise.all([
      Milestone.countDocuments(),
      Milestone.find().sort({ createdAt: -1 }).skip(page * limit).limit(limit).lean(),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireMilestoneAccess, writeLimiter, async (req, res) => {
  try {
    const m = await Milestone.create({
      title: req.body.title,
      description: req.body.description || '',
      createdByName: req.sessionUser.name,
    });
    await notify(req, 'created', m);
    res.status(201).json(m);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', validateId, requireMilestoneAccess, writeLimiter, async (req, res) => {
  try {
    const m = await Milestone.findByIdAndUpdate(
      req.params.id,
      { title: req.body.title, description: req.body.description || '' },
      { new: true, runValidators: true },
    );
    if (!m) return res.status(404).json({ error: 'Milestone not found' });
    await notify(req, 'updated', m);
    res.json(m);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Anyone signed in can mark a milestone done (or reopen it).
router.patch('/:id/done', validateId, writeLimiter, async (req, res) => {
  try {
    const done = req.body.done !== false;
    const m = await Milestone.findByIdAndUpdate(
      req.params.id,
      { done, doneAt: done ? new Date() : null, doneByName: done ? req.sessionUser.name : '' },
      { new: true },
    );
    if (!m) return res.status(404).json({ error: 'Milestone not found' });
    await notify(req, done ? 'completed' : 'reopened', m);
    res.json(m);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', validateId, requireMilestoneAccess, writeLimiter, async (req, res) => {
  try {
    const m = await Milestone.findByIdAndDelete(req.params.id);
    if (m) await notify(req, 'deleted', m);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

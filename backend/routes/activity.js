const router = require('express').Router();
const Activity = require('../models/Activity');
const { requireSessionUser } = require('../utils/session');

// GET /api/activity
// Query params:
//   days    - how many days back (default 50, max 180)
//   since   - ISO timestamp: return only activities created after this time (overrides days)
//   userId  - filter to activities where actorId OR assigneeId matches (optional)
router.get('/', requireSessionUser, async (req, res) => {
  try {
    const filter = {};

    if (req.query.since) {
      const sinceDate = new Date(req.query.since);
      if (!isNaN(sinceDate)) {
        filter.createdAt = { $gt: sinceDate };
      }
    } else {
      const days = Math.max(1, Math.min(180, Number(req.query.days || 50)));
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: cutoff };
    }

    // Optional: filter by user involvement (actor or assignee)
    if (req.query.userId) {
      const uid = req.query.userId;
      filter.$or = [{ actorId: uid }, { assigneeId: uid }];
    }

    const limit = req.query.since ? 100 : 250;
    const activities = await Activity.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
const router = require('express').Router();
const Activity = require('../models/Activity');
const { requireSessionUser } = require('../utils/session');

router.get('/', requireSessionUser, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(180, Number(req.query.days || 50)));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const activities = await Activity.find({ createdAt: { $gte: cutoff } }).sort({ createdAt: -1 }).limit(250);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
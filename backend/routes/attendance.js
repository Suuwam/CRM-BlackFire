const router = require('express').Router();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const { requireSessionUser } = require('../utils/session');
const { dayKey, isOnline, clockIn, clockOut, heartbeat } = require('../utils/attendance');

router.use(requireSessionUser);

function shape(row) {
  return { ...row.toObject(), online: isOnline(row) };
}

// GET /api/attendance?date=YYYY-MM-DD — one day for the whole team
router.get('/', async (req, res) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : dayKey();
    const rows = await Attendance.find({ date }).sort({ clockIn: 1 });
    res.json({ date, rows: rows.map(shape) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/attendance/history?userId=&days= — own history, or anyone's for admins
router.get('/history', async (req, res) => {
  try {
    const isAdmin = req.sessionUser.role === 'admin';
    const requested = req.query.userId;
    const userId = isAdmin && requested && mongoose.isValidObjectId(requested) ? requested : req.sessionUser._id;
    const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
    const from = new Date(Date.now() - days * 86400000);

    const filter = { date: { $gte: dayKey(from) } };
    if (!(isAdmin && requested === 'all')) filter.userId = userId;

    const rows = await Attendance.find(filter).sort({ date: -1 });
    res.json(rows.map(shape));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/clock-in',  async (req, res) => { try { res.json(shape(await clockIn(req.sessionUser)));  } catch (e) { res.status(400).json({ error: e.message }); } });
router.post('/clock-out', async (req, res) => {
  try {
    const row = await clockOut(req.sessionUser);
    if (!row) return res.status(400).json({ error: 'You are not clocked in today' });
    res.json(shape(row));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Heartbeat — keeps the "who is online" list honest
router.post('/ping', async (req, res) => {
  try {
    const row = await heartbeat(req.sessionUser);
    res.json(row ? shape(row) : null);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Note on your own day
router.post('/note', async (req, res) => {
  try {
    const row = await Attendance.findOneAndUpdate(
      { userId: req.sessionUser._id, date: dayKey() },
      { $set: { note: String(req.body?.note || '').slice(0, 300) } },
      { new: true }
    );
    if (!row) return res.status(400).json({ error: 'Nothing recorded for today yet' });
    res.json(shape(row));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

const router = require('express').Router();
const multer = require('multer');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const { requireSessionUser } = require('../utils/session');
const { rateLimit } = require('../utils/rateLimit');

// All event routes require a logged-in session
router.use(requireSessionUser);

const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, prefix: 'events-write', message: 'Too many event updates. Please slow down.' });

// Memory storage with MIME type filter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

function validateId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
}

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.date) filter.date = req.query.date;
    if (req.query.month) {
      filter.date = { $regex: `^${req.query.month}` };
    }
    res.json(await Event.find(filter).populate('clientId','name company').sort({ date: 1, time: 1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', writeLimiter, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.clientId) payload.clientId = null;
    res.status(201).json(await Event.create(payload));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', validateId, writeLimiter, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.clientId) payload.clientId = null;
    res.json(await Event.findByIdAndUpdate(req.params.id, payload, { new: true }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Upload image for event (memory storage -> base64 data URI)
router.patch('/:id/image', validateId, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { image: b64 },
      { new: true }
    );
    res.json(event);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', validateId, writeLimiter, async (req, res) => {
  try { await Event.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

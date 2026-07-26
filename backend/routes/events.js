const router = require('express').Router();
const multer = require('multer');
const Event = require('../models/Event');

// Memory storage for serverless & Vercel compatibility
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

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

router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.clientId) payload.clientId = null;
    res.status(201).json(await Event.create(payload));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.clientId) payload.clientId = null;
    res.json(await Event.findByIdAndUpdate(req.params.id, payload, { new: true }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Upload image for event (memory storage -> base64 data URI)
router.patch('/:id/image', upload.single('image'), async (req, res) => {
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

router.delete('/:id', async (req, res) => {
  try { await Event.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

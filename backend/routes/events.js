const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Event = require('../models/Event');

// Multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_, file, cb) => cb(null, 'evt-' + Date.now() + '-' + file.originalname.replace(/\s+/g, '_')),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

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
  try { res.status(201).json(await Event.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try { res.json(await Event.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Upload image for event
router.patch('/:id/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { image: req.file.filename },
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

const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Task = require('../models/Task');

// Multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_, file, cb) => cb(null, 'task-' + Date.now() + '-' + file.originalname.replace(/\s+/g, '_')),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET by project
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    res.json(await Task.find(filter).sort({ column: 1, order: 1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try { res.status(201).json(await Task.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try { res.json(await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Upload image for task/card
router.patch('/:id/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { image: req.file.filename },
      { new: true }
    );
    res.json(task);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH move column
router.patch('/:id/move', async (req, res) => {
  try {
    const { column } = req.body;
    res.json(await Task.findByIdAndUpdate(req.params.id, { column }, { new: true }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await Task.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

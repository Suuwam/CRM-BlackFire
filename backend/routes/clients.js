const router = require('express').Router();
const multer = require('multer');
const Client = require('../models/Client');

// Memory storage for Vercel serverless compatibility
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// GET all
router.get('/', async (_, res) => {
  try { res.json(await Client.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET one
router.get('/:id', async (req, res) => {
  try { res.json(await Client.findById(req.params.id)); }
  catch (e) { res.status(404).json({ error: 'Not found' }); }
});

// POST create
router.post('/', async (req, res) => {
  try { res.status(201).json(await Client.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT update
router.put('/:id', async (req, res) => {
  try { res.json(await Client.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH upload photo
router.patch('/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { photo: b64 },
      { new: true }
    );
    res.json(client);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try { await Client.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

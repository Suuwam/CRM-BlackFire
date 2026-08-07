const router = require('express').Router();
const multer = require('multer');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const Client = require('../models/Client');
const { requireSessionUser } = require('../utils/session');
const { rateLimit } = require('../utils/rateLimit');

// All client routes require a logged-in session
router.use(requireSessionUser);

const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, prefix: 'clients-write', message: 'Too many client updates. Please slow down.' });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Memory storage — image/MIME type filter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
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

// GET all
router.get('/', async (_, res) => {
  try { res.json(await Client.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET one
router.get('/:id', validateId, async (req, res) => {
  try { res.json(await Client.findById(req.params.id)); }
  catch (e) { res.status(404).json({ error: 'Not found' }); }
});

// POST create
router.post('/', writeLimiter, async (req, res) => {
  try { res.status(201).json(await Client.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT update
router.put('/:id', validateId, writeLimiter, async (req, res) => {
  try { res.json(await Client.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH upload photo
router.patch('/:id/photo', validateId, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const uploadFromBuffer = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'crm_clients' },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
      });
    };

    const result = await uploadFromBuffer(req.file.buffer);
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { photo: result.secure_url },
      { new: true }
    );
    res.json(client);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE
router.delete('/:id', validateId, writeLimiter, async (req, res) => {
  try { await Client.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

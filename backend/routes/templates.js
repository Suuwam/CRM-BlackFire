const router = require('express').Router();
const mongoose = require('mongoose');
const Template = require('../models/Template');
const { requireSessionUser } = require('../utils/session');
const { rateLimit } = require('../utils/rateLimit');

router.use(requireSessionUser);
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, prefix: 'templates-write', message: 'Too many template changes. Please slow down.' });

function validateId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
}

router.get('/', async (_, res) => {
  try { res.json(await Template.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', writeLimiter, async (req, res) => {
  try { res.status(201).json(await Template.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', validateId, writeLimiter, async (req, res) => {
  try { res.json(await Template.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', validateId, writeLimiter, async (req, res) => {
  try { await Template.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

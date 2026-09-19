const router = require('express').Router();
const Board = require('../models/Board');
const { requireSessionUser } = require('../utils/session');
const { rateLimit } = require('../utils/rateLimit');

router.use(requireSessionUser);
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, prefix: 'boards-write', message: 'Too many board changes. Please slow down.' });

const BASE_COLUMNS = [
  { id: 'backlog',    label: 'Backlog' },
  { id: 'todo',       label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'qa',         label: 'QA / Review' },
  { id: 'done',       label: 'Done' },
  { id: 'cancelled',  label: 'Cancelled' },
];

// Seeded on first read so the previously hardcoded boards become editable rows with their
// original ids — existing tasks keep pointing at them.
const SEED = [
  { _id: 'blackfire', label: 'Blackfire AI',   color: '#18181b', order: 0, columns: BASE_COLUMNS },
  { _id: 'aawazz',    label: 'Aawazz Product', color: '#2563eb', order: 1, columns: BASE_COLUMNS },
];

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function cleanColumns(input) {
  const seen = new Set();
  const out = [];
  for (const c of Array.isArray(input) ? input : []) {
    const id = String(c?.id || '').trim();
    const label = String(c?.label || '').trim();
    if (!ID_RE.test(id) || !label || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label });
  }
  return out;
}

router.get('/', async (_, res) => {
  try {
    if (await Board.countDocuments() === 0) await Board.insertMany(SEED);
    res.json(await Board.find().sort({ order: 1, createdAt: 1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', writeLimiter, async (req, res) => {
  try {
    const id = ID_RE.test(String(req.body._id || '')) ? req.body._id : `board_${Date.now()}`;
    const columns = cleanColumns(req.body.columns);
    if (!String(req.body.label || '').trim()) return res.status(400).json({ error: 'Board name required' });
    if (!columns.length) return res.status(400).json({ error: 'At least one stage is required' });
    if (await Board.exists({ _id: id })) return res.status(409).json({ error: 'Board already exists' });
    const order = await Board.countDocuments();
    res.status(201).json(await Board.create({ _id: id, label: req.body.label.trim(), color: req.body.color, columns, order }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', writeLimiter, async (req, res) => {
  try {
    const columns = cleanColumns(req.body.columns);
    if (!String(req.body.label || '').trim()) return res.status(400).json({ error: 'Board name required' });
    if (!columns.length) return res.status(400).json({ error: 'At least one stage is required' });
    const updated = await Board.findByIdAndUpdate(
      req.params.id,
      { label: req.body.label.trim(), color: req.body.color, columns },
      { new: true },
    );
    if (!updated) return res.status(404).json({ error: 'Board not found' });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Left/right tab moves: client sends the full id list in its new order.
router.patch('/reorder', writeLimiter, async (req, res) => {
  try {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).filter(i => ID_RE.test(i));
    if (!ids.length) return res.status(400).json({ error: 'ids required' });
    await Board.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { order } } })));
    res.json(await Board.find().sort({ order: 1, createdAt: 1 }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', writeLimiter, async (req, res) => {
  try {
    if (await Board.countDocuments() <= 1) return res.status(400).json({ error: 'Cannot delete the last board' });
    const deleted = await Board.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Board not found' });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

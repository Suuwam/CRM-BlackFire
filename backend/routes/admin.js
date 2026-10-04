const router = require('express').Router();
const mongoose = require('mongoose');
const { requireSessionUser, requireAdmin } = require('../utils/session');
const { rateLimit } = require('../utils/rateLimit');
const { recordActivity } = require('../utils/activity');
const { zip } = require('../utils/zip');
// Every collection an archive may touch, loaded here so none is skipped as "not registered".
['Activity', 'Attendance', 'Event', 'Feedback', 'Task', 'Milestone', 'AccountApplication'].forEach(m => require(`../models/${m}`));

router.use(requireSessionUser, requireAdmin);

// MongoDB Atlas free tier (M0) holds 512 MB. Set STORAGE_LIMIT_MB for a bigger cluster.
const LIMIT_MB = Number(process.env.STORAGE_LIMIT_MB || 512);
const MIN_AGE_DAYS = 180; // never archive anything younger than ~6 months

// What "old data" means. History only: accounts, boards, open tasks, templates, links and
// feedback sources are never touched. Each entry is a collection + the filter for "before".
function oldData(before) {
  const day = before.toISOString().slice(0, 10); // attendance & events store YYYY-MM-DD
  return [
    { file: 'activity-log', model: 'Activity', filter: { createdAt: { $lt: before } } },
    { file: 'attendance', model: 'Attendance', filter: { date: { $lt: day } } },
    { file: 'calendar-events', model: 'Event', filter: { date: { $lt: day } } },
    { file: 'feedback-reviews', model: 'Feedback', filter: { sentAt: { $lt: before } } },
    { file: 'tasks-closed', model: 'Task', filter: { column: { $in: ['done', 'cancelled'] }, updatedAt: { $lt: before } } },
    { file: 'milestones-done', model: 'Milestone', filter: { done: true, doneAt: { $lt: before } } },
    { file: 'account-requests-reviewed', model: 'AccountApplication', filter: { status: { $ne: 'pending' }, updatedAt: { $lt: before } }, omit: '-password -verificationCode' },
  ];
}

// `before` must be a real date at least MIN_AGE_DAYS ago, so a typo can't wipe recent data.
function parseBefore(value) {
  const d = new Date(value);
  if (isNaN(d)) return null;
  if (d > new Date(Date.now() - MIN_AGE_DAYS * 864e5)) return null;
  return d;
}

const sixMonthsAgo = () => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d; };

router.get('/storage', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name).filter(n => !n.startsWith('system.'));
    const collections = (await Promise.all(names.map(async name => {
      const [s] = await db.collection(name).aggregate([{ $collStats: { storageStats: {} } }]).toArray().catch(() => []);
      return { name, count: s?.storageStats?.count || 0, bytes: (s?.storageStats?.size || 0) + (s?.storageStats?.totalIndexSize || 0) };
    }))).sort((a, b) => b.bytes - a.bytes);
    const before = sixMonthsAgo();
    const old = await Promise.all(oldData(before).map(async d => ({ file: d.file, count: await mongoose.model(d.model).countDocuments(d.filter) })));
    res.json({
      usedBytes: (stats.dataSize || 0) + (stats.indexSize || 0),
      limitBytes: LIMIT_MB * 1024 * 1024,
      collections,
      old: { before, items: old, total: old.reduce((a, o) => a + o.count, 0) },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Step 1: the ZIP. Nothing is deleted here.
router.get('/archive', async (req, res) => {
  try {
    const before = parseBefore(req.query.before);
    if (!before) return res.status(400).json({ error: `Pick a date at least ${MIN_AGE_DAYS} days ago` });
    const parts = await Promise.all(oldData(before).map(async d => {
      const rows = await mongoose.model(d.model).find(d.filter).select(d.omit || '').lean();
      return { name: `${d.file}.json`, count: rows.length, data: JSON.stringify(rows, null, 2) };
    }));
    const total = parts.reduce((a, p) => a + p.count, 0);
    const readme = [
      'Blackfire CRM archive',
      `Everything dated before ${before.toISOString()} (exported ${new Date().toISOString()}).`,
      '',
      ...parts.map(p => `${p.name}: ${p.count} records`),
      '',
      'Each file is a JSON array of the original database documents.',
    ].join('\n');
    // ponytail: built in memory. Vercel caps a response at 4.5 MB, roughly 30-50 MB of JSON
    // once deflated; stream to Blob storage instead if archives ever get that big.
    const buf = zip([{ name: 'README.txt', data: readme }, ...parts.filter(p => p.count)]);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="blackfire-crm-before-${before.toISOString().slice(0, 10)}.zip"`,
      'X-Archive-Count': String(total),
      'Access-Control-Expose-Headers': 'X-Archive-Count, Content-Disposition',
    });
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const deleteLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, prefix: 'admin-archive-delete', message: 'Too many deletes. Try again later.' });

// Step 2: delete exactly what the ZIP held (same `before`), only after it was downloaded.
router.post('/archive/delete', deleteLimiter, async (req, res) => {
  try {
    const before = parseBefore(req.body?.before);
    if (!before) return res.status(400).json({ error: `Pick a date at least ${MIN_AGE_DAYS} days ago` });
    const results = await Promise.all(oldData(before).map(async d => ({ file: d.file, deleted: (await mongoose.model(d.model).deleteMany(d.filter)).deletedCount })));
    const total = results.reduce((a, r) => a + r.deleted, 0);
    await recordActivity({
      action: 'archived',
      targetType: 'account',
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      summary: `${req.sessionUser.name} downloaded and deleted ${total} records older than ${before.toISOString().slice(0, 10)}`,
    });
    res.json({ total, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

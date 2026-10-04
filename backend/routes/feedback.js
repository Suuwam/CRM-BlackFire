const router = require('express').Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const FeedbackSource = require('../models/FeedbackSource');
const { requireSessionUser, requireAdmin } = require('../utils/session');
const { rateLimit } = require('../utils/rateLimit');
const { sentimentOf, verifySignature, groupSimilar } = require('../utils/feedback');
const { recordActivity } = require('../utils/activity');

const CATEGORIES = ['bug', 'idea', 'praise', 'other'];
const PER_PAGE = 20;
const hookLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, prefix: 'feedback-hook', message: 'Too many requests' });

// ─── Webhook: a website POSTs one review here (no session; the signature is the auth) ───
router.post('/hook/:slug', hookLimiter, async (req, res) => {
  try {
    const source = await FeedbackSource.findOne({ slug: String(req.params.slug).toLowerCase() });
    if (!source) return res.status(404).json({ error: 'Unknown feedback source' });

    // ponytail: falls back to re-serialising when the host parsed the body before Express
    // did. Byte-identical for JSON.stringify senders (LipiSub); other senders need rawBody.
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    const ts = req.get('x-lipisub-timestamp') || req.get('x-webhook-timestamp');
    const sig = req.get('x-lipisub-signature') || req.get('x-webhook-signature');
    if (!verifySignature(raw, ts, sig, source.secret)) return res.status(401).json({ error: 'Bad signature' });

    const { id, createdAt, feedback: f = {}, user = {} } = req.body || {};
    const rating = Math.round(Number(f.rating));
    if (!id || typeof id !== 'string' || id.length > 100) return res.status(400).json({ error: 'id is required' });
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'rating must be 1–5' });
    const sentAt = new Date(createdAt);

    // Upsert on (source, id): a resend of the same review is accepted and ignored.
    const r = await Feedback.updateOne(
      { source: source._id, externalId: id },
      { $setOnInsert: {
        rating,
        sentiment: sentimentOf(rating),
        category: CATEGORIES.includes(f.category) ? f.category : 'other',
        message: String(f.message || '').slice(0, 5000),
        page: String(f.page || '').slice(0, 500),
        urgent: f.category === 'bug' || rating <= 2,
        user: {
          id: String(user.id || ''), email: String(user.email || ''),
          name: String(user.name || ''), plan: String(user.plan || ''),
        },
        sentAt: isNaN(sentAt) ? new Date() : sentAt,
      } },
      { upsert: true },
    );
    await FeedbackSource.updateOne({ _id: source._id }, { lastReceivedAt: new Date() });
    // Only a first delivery reaches the activity feed, which the Alerts bell and phone notifications read.
    if (r.upsertedCount) {
      const msg = String(f.message || '').trim();
      await recordActivity({
        action: 'received feedback',
        targetType: 'feedback',
        targetName: source.slug,
        actorName: source.name,
        summary: `${'★'.repeat(rating)} ${f.category || 'feedback'} on ${source.name}${msg ? `: "${msg.length > 80 ? msg.slice(0, 80) + '…' : msg}"` : ''}`,
      });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[feedback hook]', e);
    res.status(500).json({ error: 'Could not store feedback' });
  }
});

router.use(requireSessionUser);

function slugify(name) {
  return String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function findSource(req, res) {
  const source = await FeedbackSource.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
  if (!source) res.status(404).json({ error: 'Feedback source not found' });
  return source;
}

// Everyone sees the sites and their counts; only admins see the secret.
router.get('/sources', async (req, res) => {
  try {
    const [sources, counts] = await Promise.all([
      FeedbackSource.find().sort({ createdAt: 1 }).lean(),
      Feedback.aggregate([{ $group: { _id: { s: '$source', m: '$sentiment' }, n: { $sum: 1 } } }]),
    ]);
    const isAdmin = req.sessionUser.role === 'admin';
    res.json(sources.map(s => {
      const c = { positive: 0, neutral: 0, negative: 0 };
      for (const r of counts) if (String(r._id.s) === String(s._id)) c[r._id.m] = r.n;
      return { ...s, secret: isAdmin ? s.secret : undefined, counts: c, total: c.positive + c.neutral + c.negative };
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sources', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const slug = slugify(req.body.slug || name);
    if (!name || !slug) return res.status(400).json({ error: 'Name is required' });
    if (await FeedbackSource.exists({ slug })) return res.status(400).json({ error: `A source called "${slug}" already exists` });
    const s = await FeedbackSource.create({ name, slug, secret: crypto.randomBytes(32).toString('hex') });
    res.status(201).json(s);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// New secret, e.g. if the old one leaked. The site stops delivering until its env is updated.
router.post('/sources/:id/rotate', requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID format' });
  try {
    const s = await FeedbackSource.findByIdAndUpdate(req.params.id, { secret: crypto.randomBytes(32).toString('hex') }, { new: true });
    if (!s) return res.status(404).json({ error: 'Feedback source not found' });
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/sources/:id', requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID format' });
  try {
    await Promise.all([FeedbackSource.deleteOne({ _id: req.params.id }), Feedback.deleteMany({ source: req.params.id })]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Dashboard numbers for one site: sentiment split, stars, categories, last 30 days, similar groups.
router.get('/sources/:slug/stats', async (req, res) => {
  try {
    const source = await findSource(req, res);
    if (!source) return;
    const since = new Date(Date.now() - 30 * 864e5);
    const [bySentiment, byRating, byCategory, byDay, recent] = await Promise.all([
      Feedback.aggregate([{ $match: { source: source._id } }, { $group: { _id: '$sentiment', n: { $sum: 1 } } }]),
      Feedback.aggregate([{ $match: { source: source._id } }, { $group: { _id: '$rating', n: { $sum: 1 } } }]),
      Feedback.aggregate([{ $match: { source: source._id } }, { $group: { _id: '$category', n: { $sum: 1 } } }]),
      Feedback.aggregate([
        { $match: { source: source._id, sentAt: { $gte: since } } },
        { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } }, m: '$sentiment' }, n: { $sum: 1 } } },
      ]),
      Feedback.find({ source: source._id, message: { $ne: '' } }).sort({ sentAt: -1 }).limit(500)
        .select('message rating sentiment').lean(),
    ]);
    const toObj = (rows) => Object.fromEntries(rows.map(r => [r._id, r.n]));
    const days = {};
    for (const r of byDay) (days[r._id.d] ||= { positive: 0, neutral: 0, negative: 0 })[r._id.m] = r.n;
    const ratings = toObj(byRating);
    const total = Object.values(ratings).reduce((a, b) => a + b, 0);
    res.json({
      source: { _id: source._id, name: source.name, slug: source.slug, lastReceivedAt: source.lastReceivedAt },
      total,
      avgRating: total ? Math.round(Object.entries(ratings).reduce((s, [r, n]) => s + r * n, 0) / total * 10) / 10 : 0,
      sentiment: { positive: 0, neutral: 0, negative: 0, ...toObj(bySentiment) },
      ratings,
      categories: toObj(byCategory),
      days,
      similar: groupSimilar(recent).slice(0, 10),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sources/:slug/items', async (req, res) => {
  try {
    const source = await findSource(req, res);
    if (!source) return;
    const q = { source: source._id };
    if (['positive', 'neutral', 'negative'].includes(req.query.sentiment)) q.sentiment = req.query.sentiment;
    if (CATEGORIES.includes(req.query.category)) q.category = req.query.category;
    const page = Math.max(0, Number(req.query.page) || 0);
    const [total, items] = await Promise.all([
      Feedback.countDocuments(q),
      Feedback.find(q).sort({ sentAt: -1 }).skip(page * PER_PAGE).limit(PER_PAGE).lean(),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / PER_PAGE)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

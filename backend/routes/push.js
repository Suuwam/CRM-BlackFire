const router = require('express').Router();
const { requireSessionUser } = require('../utils/session');
const { PushSubscription, getVapid } = require('../utils/push');

router.use(requireSessionUser);

router.get('/key', async (req, res) => {
  try { res.json({ publicKey: (await getVapid()).publicKey }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// The browser's PushSubscription.toJSON(): { endpoint, keys: { p256dh, auth } }.
router.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  try {
    await PushSubscription.updateOne(
      { endpoint },
      { userId: req.sessionUser._id, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) } },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    await PushSubscription.deleteOne({ endpoint: String(req.body?.endpoint || ''), userId: req.sessionUser._id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

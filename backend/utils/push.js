// Web Push to the CRM installed on a phone's home screen (iPhone: iOS 16.4+, Add to Home Screen).
const mongoose = require('mongoose');
const webpush = require('web-push');

const PushSubscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys:     { p256dh: String, auth: String },
}, { timestamps: true }));

// VAPID keys: from env if set, else made once and kept in Mongo, so push works with no setup.
// Upsert with $setOnInsert means two cold starts racing still agree on one pair.
let vapid = null;
async function getVapid() {
  if (vapid) return vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const settings = mongoose.connection.collection('settings');
    const fresh = webpush.generateVAPIDKeys();
    await settings.updateOne({ _id: 'vapid' }, { $setOnInsert: fresh }, { upsert: true });
    const doc = await settings.findOne({ _id: 'vapid' });
    vapid = { publicKey: doc.publicKey, privateKey: doc.privateKey };
  }
  return vapid;
}

const NOTIFIABLE = ['milestone', 'feedback', 'email'];
const titleFor = (a) => (a.targetType === 'feedback' ? `New feedback · ${a.actorName}`
  : a.targetType === 'milestone' ? 'Milestone update' : 'Blackfire CRM');
const urlFor = (a) => (a.targetType === 'feedback' ? `/feedback/${a.targetName}`
  : a.targetType === 'milestone' ? '/milestones' : '/dashboard');

// Push one activity to everyone subscribed except whoever did it. Never throws.
async function pushActivity(a) {
  if (!NOTIFIABLE.includes(a.targetType)) return;
  try {
    const { publicKey, privateKey } = await getVapid();
    const q = a.actorId ? { userId: { $ne: a.actorId } } : {};
    const subs = await PushSubscription.find(q).lean();
    const body = JSON.stringify({ title: titleFor(a), body: a.summary || `${a.actorName} ${a.action}`, url: urlFor(a) });
    await Promise.all(subs.map(s => webpush.sendNotification(s, body, {
      vapidDetails: { subject: process.env.VAPID_SUBJECT || 'mailto:admin@blackfire.ai', publicKey, privateKey },
      TTL: 24 * 3600,
      timeout: 5000,
    }).catch(err => {
      // 404/410: the phone dropped this subscription (app removed, permission revoked).
      if (err.statusCode === 404 || err.statusCode === 410) return PushSubscription.deleteOne({ _id: s._id });
      console.warn('[push]', err.statusCode || err.message);
    })));
  } catch (e) { console.error('[push]', e.message); }
}

module.exports = { PushSubscription, getVapid, pushActivity };

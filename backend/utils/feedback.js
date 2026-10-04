const crypto = require('crypto');

const sentimentOf = (rating) => (rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative');

// Same scheme the sites sign with (lipsub-backend/src/services/crmWebhook.js):
// "sha256=" + HMAC-SHA256(secret, "<timestamp>.<raw body>"), timestamp within 5 minutes.
function verifySignature(rawBody, timestamp, signature, secret, now = Date.now()) {
  if (!timestamp || !signature) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const want = 'sha256=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const got = String(signature);
  return got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

const STOP = new Set(('the and for are but not you all any can had her was one our out has have this that with from they will would there their what when your about just very really also into been more than then them some only like get got its it\'s too app please could should thing things much make made does did dont don\'t cant can\'t im i\'m').split(' '));

// `shown` collects stem → a real word it came from, for display.
function words(text, shown = new Map()) {
  const out = new Set();
  for (const word of String(text).toLowerCase().match(/[\p{L}\p{N}']+/gu) || []) {
    if (word.length < 3 || STOP.has(word)) continue;
    const w = word.replace(/(ing|ed|es|s)$/, ''); // crude stem: "freezes"/"freezing" → "freez"
    if (w.length < 3) continue;
    out.add(w);
    if (!shown.has(w) || word.length < shown.get(w).length) shown.set(w, word);
  }
  return out;
}

function overlap(a, b) {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size); // share of the shorter review's words
}

// ponytail: greedy word-overlap grouping, O(reviews × groups). Fine for the last few
// hundred reviews; swap in embeddings if wording varies too much to match on words.
function groupSimilar(items, threshold = 0.5) {
  const groups = [];
  const shown = new Map();
  for (const it of items) {
    const w = words(it.message, shown);
    if (w.size < 2) continue;
    const g = groups.find(g => overlap(g.words, w) >= threshold);
    if (g) { g.items.push(it); for (const x of w) g.counts.set(x, (g.counts.get(x) || 0) + 1); }
    else groups.push({ words: w, items: [it], counts: new Map([...w].map(x => [x, 1])) });
  }
  return groups
    .filter(g => g.items.length >= 2)
    .sort((a, b) => b.items.length - a.items.length)
    .map(g => ({
      count: g.items.length,
      keywords: [...g.counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => shown.get(w) || w),
      avgRating: Math.round(g.items.reduce((s, i) => s + i.rating, 0) / g.items.length * 10) / 10,
      sentiment: { positive: 0, neutral: 0, negative: 0, ...countBy(g.items, 'sentiment') },
      examples: g.items.slice(0, 3).map(i => ({ _id: i._id, message: i.message, rating: i.rating })),
    }));
}

function countBy(items, key) {
  const out = {};
  for (const i of items) out[i[key]] = (out[i[key]] || 0) + 1;
  return out;
}

module.exports = { sentimentOf, verifySignature, groupSimilar };

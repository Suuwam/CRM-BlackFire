// node test-feedback.js — checks webhook signatures against LipiSub's signer, and similar-grouping.
const assert = require('assert');
const crypto = require('crypto');
const { verifySignature, groupSimilar, sentimentOf } = require('./utils/feedback');

const secret = 'x'.repeat(64), body = '{"id":"1"}', ts = Math.floor(Date.now() / 1000);
const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
assert.ok(verifySignature(body, ts, sig, secret));
assert.ok(!verifySignature(body + ' ', ts, sig, secret), 'tampered body');
assert.ok(!verifySignature(body, ts - 400, sig, secret), 'stale timestamp');
assert.ok(!verifySignature(body, ts, 'sha256=nope', secret), 'wrong signature');

assert.deepStrictEqual([1, 2, 3, 4, 5].map(sentimentOf), ['negative', 'negative', 'neutral', 'positive', 'positive']);

const g = groupSimilar([
  { message: 'Export froze at 80%', rating: 1, sentiment: 'negative' },
  { message: 'The export freezes every time', rating: 2, sentiment: 'negative' },
  { message: 'Love the subtitles, great accuracy', rating: 5, sentiment: 'positive' },
  { message: 'export froze again', rating: 1, sentiment: 'negative' },
]);
assert.strictEqual(g.length, 1);
assert.strictEqual(g[0].count, 3);
assert.ok(g[0].keywords.includes('export'));
console.log('feedback ok');

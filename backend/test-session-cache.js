// Self-check for the session-user cache. Run: node backend/test-session-cache.js
// The cache sits on the auth path, so the property that matters is not just "fewer
// queries" but "a deactivated user stops being accepted immediately".
const assert = require('assert');

process.env.SESSION_CACHE_MS = '80';

const User = require('./models/User');

let queries = 0;
let stored = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Ada', active: true };
User.findById = async id => { queries++; return stored ? { ...stored } : null; };

const { getSessionUser, invalidateSessionUser } = require('./utils/session');
const req = { get: () => 'aaaaaaaaaaaaaaaaaaaaaaaa' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // A burst of requests costs one round-trip, not one each.
  assert.equal((await getSessionUser(req)).name, 'Ada');
  await getSessionUser(req); await getSessionUser(req); await getSessionUser(req);
  assert.equal(queries, 1, `burst should hit the DB once, hit it ${queries}x`);

  // Deactivation takes effect on the next request, not after the TTL.
  stored.active = false;
  invalidateSessionUser('aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(await getSessionUser(req), null, 'deactivated user must be rejected at once');
  assert.equal(queries, 2);

  // A rejected lookup is cached too, so a hammering client cannot re-query per request.
  await getSessionUser(req);
  assert.equal(queries, 2, 'negative result should also be cached');

  // ...but only until the TTL lapses.
  await sleep(120);
  stored.active = true;
  assert.equal((await getSessionUser(req)).name, 'Ada', 'reactivation must be picked up after TTL');
  assert.equal(queries, 3);

  // A malformed or absent header never reaches the database.
  const before = queries;
  assert.equal(await getSessionUser({ get: () => 'not-an-objectid' }), null);
  assert.equal(await getSessionUser({ get: () => undefined }), null);
  assert.equal(queries, before, 'invalid ids must not query');

  console.log('✓ session cache: burst coalescing, immediate invalidation, TTL expiry, id validation');
})().catch(e => { console.error('✗', e.message); process.exit(1); });

// node frontend/sw.test.mjs — the outage this guards: a cached index.html naming
// hashed bundles that no longer exist, served as 200 HTML, booting nothing.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const store = new Map();
const cache = {
  addAll: async () => {},
  put: async (k, v) => store.set(k.url || k, v),
  match: async (k) => store.get(k.url || k),
};
const handlers = {};
globalThis.self = {
  location: { origin: 'https://crm.test' },
  addEventListener: (type, fn) => (handlers[type] = fn),
  skipWaiting: async () => {},
  clients: { claim: async () => {} },
};
globalThis.caches = { open: async () => cache, match: async (k) => cache.match(k), keys: async () => [] };

const run = (request, network) => {
  let responded;
  globalThis.fetch = network;
  handlers.fetch({ request, respondWith: (p) => (responded = p) });
  return responded;
};
const req = (path, extra = {}) => ({ url: `https://crm.test${path}`, method: 'GET', ...extra });
const res = (body) => ({ body, ok: true, type: 'basic', clone: () => res(body) });

eval(readFileSync(new URL('./public/sw.js', import.meta.url), 'utf8'));

// A navigation takes the network even with a stale copy cached.
store.set('/index.html', res('OLD HTML'));
assert.equal((await run(req('/', { mode: 'navigate' }), async () => res('NEW HTML'))).body, 'NEW HTML');

// Offline falls back to the cached shell.
assert.equal((await run(req('/', { mode: 'navigate' }), async () => { throw new Error('offline'); })).body, 'NEW HTML');

// Hashed assets stay cache-first — the hash makes a hit safe.
store.set('https://crm.test/assets/index-abc.js', res('CACHED JS'));
assert.equal((await run(req('/assets/index-abc.js'), async () => res('NET JS'))).body, 'CACHED JS');

// API and cross-origin requests are never intercepted.
assert.equal(run(req('/api/tasks'), null), undefined);
assert.equal(run(req('', { url: 'https://fonts.googleapis.com/css2' }), null), undefined);

console.log('sw ok');

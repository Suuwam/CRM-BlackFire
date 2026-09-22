const CACHE_NAME = 'blackfire-crm-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(['/index.html', '/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML must be network-first: it names the hashed bundles, so a cached copy
  // outlives the assets it points at and boots nothing.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Everything else is content-hashed, so a cache hit can never be stale.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
      }
      return res;
    }))
  );
});

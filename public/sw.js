// Service worker. __BUILD_ID__ is replaced at build time, so every deploy gets its own cache and the
// browser sees a changed file and knows a new version exists.
const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = 'bmf-log-' + BUILD_ID;
const APP_SHELL = ['./', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  // Deliberately no skipWaiting() here: the page asks for it when the person taps "Refresh" on the
  // "new version available" banner, so nobody is switched to new code half-way through filling in a form.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;                // Firebase, fonts: straight to the network
  if (url.pathname.endsWith('/version.json')) return;             // always fresh, never cached

  // The page itself: network first, so a deploy shows up on the next load. Cache is only the offline fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // Hashed build files never change under the same name: cache first.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }))
    );
    return;
  }

  // Icons, manifest: serve from cache, refresh quietly.
  event.respondWith(
    caches.match(event.request).then((hit) => {
      const fresh = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});

/* E Don Do service worker.

   Strategy is split, deliberately:

   - The shell (HTML and app.js) is NETWORK-FIRST, falling back to cache.
     The old version was cache-first for everything, with a fixed cache name.
     That meant a released change never reached anyone who had already opened
     the app: the cache only clears when its NAME changes, and the name was a
     constant. Users were permanently stranded on whatever build they first
     loaded. Network-first means online users always get the current app, and
     offline users still get the last one that worked.

   - Everything else (fonts, icons, the CDN scripts) is CACHE-FIRST. Those are
     versioned by URL and rarely change, and they are the expensive bytes on a
     metered Nigerian connection.

   Bump CACHE when the shell list changes, to evict the old one. */

const CACHE = 'edondo-v2';

const SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@0.454.0/dist/umd/lucide.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* The shell is what we must not serve stale: the page itself and our own script. */
function isShell(request, url) {
  if (request.mode === 'navigate') return true;
  if (url.origin !== self.location.origin) return false;
  return url.pathname.endsWith('.html')
      || url.pathname.endsWith('.js')
      || url.pathname === '/'
      || url.pathname.endsWith('/');
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  if (isShell(e.request, url)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

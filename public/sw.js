const CACHE_NAME = 'check-no-concurso-v16';
const ASSETS = [
  '/',
  '/index.html',
  '/css/tokens.css',
  '/css/styles.css',
  '/css/auth-cta.css',
  '/js/app.js',
  '/js/search.js',
  '/js/google-auth.js',
  '/js/data/concursos.js',
  '/js/data/estado-builder.js',
  '/js/data/estados-norte.js',
  '/js/data/estados-nordeste.js',
  '/js/data/estados-centro-oeste.js',
  '/js/data/estados-sudeste.js',
  '/js/data/estados-sul.js',
  '/js/data/estados-ativos-2026-11.js',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/css/brand.css',
  '/css/fonts.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first so UI/CSS updates appear immediately, falling back to cache offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ offline: true }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

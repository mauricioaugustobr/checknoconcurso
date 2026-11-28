const CACHE_NAME = 'check-no-concurso-v47';
const ASSETS = [
  '/',
  '/index.html',
  '/css/tokens.css',
  '/css/styles.css',
  '/css/auth-cta.css',
  '/js/app.js',
  '/js/search.js',
  '/js/google-auth.js',
  '/js/data/site-info.js',
  '/js/data/estado-builder.js',
  '/js/data/sem-prova.js',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/css/brand.css',
  '/css/fonts.css',
  '/css/treinar.css',
  '/css/detalhe-responsivo.css',
  '/css/theme-dark.css',
  '/js/theme.js',
  '/js/consent.js',
  '/css/header-nav.css',
  '/css/blog-links.css',
  '/css/pages-footer.css',
  '/js/blog-strip.js',
  '/js/plan-gate.js',
  '/js/progresso-sync.js',
  '/js/progresso-migracao.js',
  '/js/amostra-questao.js',
  '/js/data/amostras.js',
  '/css/amostra-questao.css',
  '/js/plano-origem.js',
  '/css/plano-origem.css',
  '/js/compartilhar.js',
  '/js/compartilhar-dados.js',
  '/css/compartilhar.css',
  '/js/ultimos-dias.js',
  '/css/ultimos-dias.css',
  '/js/cadeado-essencial.js',
  '/css/cadeado-essencial.css',
  '/js/acompanhados.js',
  '/css/acompanhados.css',
  '/js/agenda.js',
  '/css/agenda.css'
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
      // Sem internet: tenta a cópia exata e, se não houver, a mesma página/arquivo sem o ?v=
      .catch(() => caches.match(event.request).then((r) => r || caches.match(event.request, { ignoreSearch: true })))
  );
});

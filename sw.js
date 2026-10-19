// 离线缓存。每次发布改 VERSION 即可让旧缓存自动清理。
const VERSION = 'v1.0.0';
const CACHE = `love-days-${VERSION}`;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/app.css',
  './assets/app.js',
  './assets/dates.js',
  './assets/store.js',
  './assets/occurrence.js',
  './assets/lunar.js',
  './assets/sync.js',
  './assets/vendor/solarlunar.esm.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith('love-days-') && key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：优先网络，离线时回退到缓存的 index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put('./index.html', response.clone());
          }
          return response;
        } catch {
          return (await caches.match('./index.html')) || Response.error();
        }
      })(),
    );
    return;
  }

  // 静态资源：先返回缓存，同时在后台更新，保证下次打开是新版本
  const cachedPromise = caches.match(request);
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  event.waitUntil(networkPromise.then(() => {}).catch(() => {}));
  event.respondWith(
    (async () => {
      const cached = await cachedPromise;
      if (cached) return cached;
      return (await networkPromise) || Response.error();
    })(),
  );
});

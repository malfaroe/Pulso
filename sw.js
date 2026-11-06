// La app debe abrir sin señal en el local del show: responde desde caché y
// actualiza en segundo plano, de modo que los cambios llegan en la siguiente apertura.
const CACHE = 'pulso-v1';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'metronome.js',
  'lista.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const fresh = fetch(event.request).then((response) => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      });
      if (cached) {
        event.waitUntil(fresh.catch(() => {}));
        return cached;
      }
      return fresh;
    }),
  );
});

const CACHE = 'sensora-v14';

const CORE = [
  '/manifest.webmanifest',
  '/assets/logo.png',
  '/assets/background.png?v=2',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    try {
      const response = await fetch('/');
      const html = await response.clone().text();

      await cache.put('/', response);

      const bundles = [
        ...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
      ].map(match => match[1]);

      await cache.addAll([...CORE, ...bundles]);
    } catch {
      // Установка приложения не должна ломаться,
      // если какой-то ресурс временно недоступен.
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key => key !== CACHE)
        .map(key => caches.delete(key)),
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /*
   * Аудио намеренно НЕ пропускаем через Cache Storage.
   *
   * HTMLAudioElement может использовать Range-запросы,
   * поэтому отдаём /audio/* напрямую браузеру.
   * Обычный HTTP-кэш браузера при этом продолжает работать.
   */
  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith('/audio/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (
            response.ok &&
            url.origin === self.location.origin
          ) {
            const copy = response.clone();

            void caches.open(CACHE).then(cache =>
              cache.put(event.request, copy),
            );
          }

          return response;
        })
        .catch(() => caches.match('/'));
    }),
  );
});

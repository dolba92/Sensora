const CACHE = 'sensora-v15';

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
      await cache.addAll(CORE);
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

  /*
   * Для переходов между страницами используем network-first.
   *
   * Благодаря этому установленная PWA сначала получает
   * актуальную версию приложения с сервера.
   * Если интернета нет — используется сохранённая версия.
   */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
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
        .catch(async () => {
          const cached =
            (await caches.match(event.request)) ||
            (await caches.match('/'));

          if (cached) return cached;

          throw new Error('Страница недоступна офлайн.');
        }),
    );

    return;
  }

  /*
   * Остальные статические ресурсы:
   * сначала кэш, затем сеть.
   */
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
        });
    }),
  );
});

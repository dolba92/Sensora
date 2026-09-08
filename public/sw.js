const CACHE = 'auto-v2';
const AUDIO = [
  'rain.mp3', 'heavy-rain.mp3', 'thunder.mp3', 'ocean.mp3', 'waves.mp3',
  'river.mp3', 'waterfall.mp3', 'forest.mp3', 'wind.mp3', 'birds.mp3',
  'fan.mp3', 'air-conditioner.mp3', 'vacuum.mp3', 'train.mp3', 'airplane.mp3',
  'cafe.mp3', 'library.mp3', 'room.mp3', 'fireplace.mp3', 'chimes.mp3',
  'singing-bowl.mp3', 'soft-hum.mp3'
].map(name => `/audio/${name}`);
const CORE = ['/manifest.webmanifest', '/assets/logo.png', '/assets/background.png', '/assets/icon-192.png', '/assets/icon-512.png', ...AUDIO];

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  const response = await fetch('/');
  const html = await response.clone().text();
  await cache.put('/', response);
  const bundles = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
  await cache.addAll([...CORE, ...bundles]);
  await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok && new URL(event.request.url).origin === location.origin) void caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match('/'))));
});

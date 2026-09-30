const CACHE_NAME = 'han-thien-mon-3.7.72';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css?v=3.7.72',
  '/script.js?v=3.7.72',
  '/manifest.webmanifest?v=3.7.72',
  '/icons/icon-192-3-7-71.png?v=3.7.72',
  '/icons/icon-512-3-7-71.png?v=3.7.72',
  '/icons/icon-1024-3-7-71.png?v=3.7.72',
  '/icons/apple-touch-icon-3-7-71.png?v=3.7.72'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin || req.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/audio/') || /\.(mp3|m4a|ogg|webm)$/i.test(url.pathname)) return;
  event.respondWith(fetch(req).then(res => {
    if (res.ok && res.type !== 'opaque') {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
    }
    return res;
  }).catch(() => caches.match(req).then(cached => cached || caches.match('/index.html'))));
});

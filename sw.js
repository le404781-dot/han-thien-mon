const CACHE_NAME = 'han-thien-mon-v3.7.68';
const APP_SHELL = ['/', '/index.html', '/style.css?v=3.7.68', '/script.js?v=3.7.68', '/manifest.webmanifest?v=3.7.68', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin || req.method !== 'GET') return;
  if (/\.(mp3|m4a|ogg|webm|aac|wav)$/i.test(url.pathname) || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match(req).then(cached => cached || caches.match('/index.html'))));
});

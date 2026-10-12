// Replaced by the build with this release's static files. Never cache user data.
const BASE = /*__NOTEMAP_BASE__*/ '/';
const PRECACHE = /*__NOTEMAP_PRECACHE__*/ [];
const PREFIX = `notemap-shell-${BASE}-`;
const CACHE = /*__NOTEMAP_CACHE__*/ 'notemap-shell-unbuilt';
const ASSETS = new Set(PRECACHE);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    (key.startsWith(PREFIX) || (BASE === '/' && key.startsWith('notemap-offline-'))) && key !== CACHE
  ).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search) return;
  // Navigation returns the cached shell; fragments never become cache keys.
  const path = event.request.mode === 'navigate' && (url.pathname === BASE || url.pathname === `${BASE}index.html`)
    ? BASE : url.pathname;
  if (!ASSETS.has(path)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(path)).then(response => response || fetch(event.request)));
});

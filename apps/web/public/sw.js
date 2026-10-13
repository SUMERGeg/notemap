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
    key.startsWith(PREFIX) && key !== CACHE
  ).slice(0,-1).filter(key=>key!==CACHE)
  .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='NOTEMAP_ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if(event.request.mode==='navigate'&&(url.pathname===BASE||url.pathname===`${BASE}index.html`)){
    event.respondWith((async()=>{
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),4000);
      try{const response=await fetch(event.request,{signal:controller.signal});if(response.ok&&response.headers.get('Content-Type')?.includes('text/html'))return response;}catch{/* Offline shell remains available. */}finally{clearTimeout(timeout);}
      const cached=await (await caches.open(CACHE)).match(BASE);
      return cached||fetch(event.request);
    })());return;
  }
  if(url.search)return;
  const path = event.request.mode === 'navigate' && (url.pathname === BASE || url.pathname === `${BASE}index.html`)
    ? BASE : url.pathname;
  if (!ASSETS.has(path)&&!(path.startsWith(`${BASE}assets/`)&&/\.(js|css)$/.test(path))) return;
  event.respondWith((async()=>{
    const current=await (await caches.open(CACHE)).match(path);if(current)return current;
    // A tab still running the previous release may load a lazy chunk later.
    for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE){const previous=await (await caches.open(key)).match(path);if(previous)return previous;}
    return fetch(event.request);
  })());
});

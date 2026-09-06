const CACHE = 'idk-shell-v3';
const ASSETS = [
  '/', '/desktop.html', '/style.css', '/idk-pwa-manifest.json',
  '/idk-os-next.css', '/idk-platform-next.css', '/idk-platform-polish.css',
  '/idk-advanced-polish.css', '/idk-connectivity-suite.css', '/idk-accounts-devices.css', '/idk-perfect-os.css', '/idk-ecosystem-suite.css', '/idk-production-suite.css', '/idk-window-performance.css',
  '/idk-platform-next.js', '/idk-platform-polish.js', '/idk-quality-features.js', '/idk-connectivity-suite.js', '/idk-accounts-devices.js', '/idk-perfect-os.js', '/idk-ecosystem-suite.js', '/idk-production-suite.js', '/idk-window-performance.js',
  '/proxy.js', '/apps.js', '/os.js', '/system-apps.js', '/idk-account-client.js', '/idk-v2-features.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(ASSETS.map(asset => cache.add(asset)))));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('idk-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    try {
      const response = await fetch(event.request);
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    } catch {
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('/desktop.html');
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});

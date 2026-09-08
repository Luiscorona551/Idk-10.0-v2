const CACHE = 'idk-shell-v24';
const ASSETS = [
  '/', '/desktop.html', '/style.css', '/idk-pwa-manifest.json', '/idk-batch-fourteen.css', '/idk-batch-fifteen.css', '/idk-batch-sixteen.css', '/idk-batch-seventeen.css', '/idk-batch-eighteen.css', '/idk-batch-nineteen.css', '/idk-batch-twentyone.css', '/idk-roadmap-suite.css', '/idk-roadmap-suite.css',
  '/idk-os-next.css', '/idk-platform-next.css', '/idk-platform-polish.css', '/idk-batch-eight.css', '/idk-batch-nine.css', '/idk-batch-ten.css', '/idk-batch-eleven.css', '/idk-local-agent.css', '/idk-batch-thirteen.css',
  '/idk-advanced-polish.css', '/idk-connectivity-suite.css', '/idk-accounts-devices.css', '/idk-perfect-os.css', '/idk-ecosystem-suite.css', '/idk-production-suite.css', '/idk-window-performance.css', '/idk-next-suite.css',
  '/idk-platform-next.js', '/idk-platform-polish.js', '/idk-quality-features.js', '/idk-connectivity-suite.js', '/idk-accounts-devices.js', '/idk-perfect-os.js', '/idk-ecosystem-suite.js', '/idk-production-suite.js', '/idk-window-performance.js', '/idk-next-suite.js', '/idk-app-upgrades.js', '/idk-batch-two.js', '/idk-batch-three.js', '/idk-batch-four.js', '/idk-batch-five.js', '/idk-batch-six.js', '/idk-batch-eight.js', '/idk-batch-nine.js', '/idk-batch-ten.js',
  '/idk-final-upgrades.css',
  '/proxy.js', '/apps.js', '/os.js', '/system-apps.js', '/idk-account-client.js', '/idk-v2-features.js', '/idk-batch-eleven.js', '/idk-local-agent.js', '/idk-batch-thirteen.js', '/idk-batch-fourteen.js', '/idk-batch-fifteen.js', '/idk-batch-sixteen.js', '/idk-batch-seventeen.js', '/idk-batch-eighteen.js', '/idk-batch-nineteen.js', '/idk-batch-twentyone.js', '/idk-roadmap-suite.js', '/idk-roadmap-suite.js'
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

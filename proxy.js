// Client half of the Ultraviolet proxy. Everything here is a no-op unless the
// site is served by server.js, which supplies /uv/, /baremux/, /epoxy/ and /wisp/.
const PROXY = (() => {
  let ready = null;
  let connection = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(tag => tag.src && new URL(tag.src, location.href).pathname === src);
      if (existing) existing.remove();
      const tag = document.createElement('script'); tag.src = src;
      tag.onload = resolve;
      tag.onerror = () => { tag.remove(); reject(new Error(`Could not load ${src}. Check the browser server and try again.`)); };
      document.head.append(tag);
    });
  }
  async function status() { try { const res = await fetch('/api/status', { cache: 'no-store' }); const data = await res.json().catch(() => ({})); return res.ok ? data : {}; } catch { return {}; } }
  async function backendAvailable() { return (await status()).proxy === true; }
  async function chatAvailable() { return (await status()).chat === true; }
  async function serverScope() { try { const res = await fetch('/api/browser/scope', { cache: 'no-store' }); return res.ok ? await res.json() : {}; } catch { return {}; } }
  async function init() {
    if (!window.isSecureContext) throw new Error('The proxy needs HTTPS (or localhost) to register its service worker.');
    if (!('serviceWorker' in navigator)) throw new Error('This browser has no service worker support.');
    await loadScript('/uv/uv.bundle.js'); await loadScript('/uv/uv.config.js'); await loadScript('/baremux/index.js');
    if (!window.Ultraviolet || !window.__uv$config || !window.BareMux?.BareMuxConnection) throw new Error('The browser service loaded incompletely. Try again.');
    const registration = await navigator.serviceWorker.register(__uv$config.sw, { scope: __uv$config.prefix });
    registration.update().catch(() => {});
    const deadline = Date.now() + 10000;
    while (!registration.active && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    if (!registration.active) throw new Error('The proxy service worker did not activate.');
    if (!navigator.serviceWorker.controller && registration.active) await new Promise(resolve => { const timer = setTimeout(resolve, 1500); navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(); }, { once: true }); });
    connection = new BareMux.BareMuxConnection('/baremux/worker.js');
    const wisp = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/wisp/`;
    await connection.setTransport('/epoxy/index.mjs', [{ wisp }]);
  }
  function reset() { ready = null; connection = null; }
  function normalize(input) { const value = input.trim(); if (/^https?:\/\//i.test(value)) return value; if (/^[^\s.]+\.[^\s]{2,}$/.test(value)) return `https://${value}`; return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`; }
  async function encode(input) { if (!ready) ready = init().catch(error => { ready = null; throw error; }); await ready; return __uv$config.prefix + __uv$config.encodeUrl(normalize(input)); }
  return { encode, backendAvailable, chatAvailable, serverScope, status, reset };
})();
(async () => {
  const files = ['/idk-batch-fourteen.css', '/idk-game-fix.js', '/idk-batch-fourteen.js', '/idk-batch-sixteen.js', '/idk-release-batch.css', '/idk-release-batch.js'];
  for (const src of files) try {
    if (src.endsWith('.css')) { const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => new URL(link.href, location.href).pathname === src); if (!existing) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = src; document.head.append(link); } }
    else await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = src; script.onload = resolve; script.onerror = reject; document.head.append(script); });
  } catch (error) { console.warn(`IDK optional module failed to load: ${src}`, error); }
})();

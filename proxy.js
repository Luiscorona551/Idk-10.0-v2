// Client half of the Ultraviolet proxy. Everything here is a no-op unless the
// site is served by server.js, which supplies /uv/, /baremux/, /epoxy/ and /wisp/.
const PROXY = (() => {
  let ready = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) return resolve();
      const tag = document.createElement('script');
      tag.src = src;
      tag.onload = resolve;
      tag.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.append(tag);
    });
  }

  async function status() {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      return res.ok ? data : {};
    } catch (e) {
      return {};
    }
  }

  async function backendAvailable() {
    const data = await status();
    return data.proxy === true;
  }

  async function chatAvailable() {
    const data = await status();
    return data.chat === true;
  }

  async function serverScope() {
    try {
      const res = await fetch('/api/browser/scope', { cache: 'no-store' });
      return res.ok ? await res.json() : {};
    } catch (e) {
      return {};
    }
  }

  async function init() {
    if (!window.isSecureContext) {
      throw new Error('The proxy needs HTTPS (or localhost) to register its service worker.');
    }
    if (!('serviceWorker' in navigator)) {
      throw new Error('This browser has no service worker support.');
    }

    await loadScript('/uv/uv.bundle.js');
    await loadScript('/uv/uv.config.js');
    await loadScript('/baremux/index.js');

    const registration = await navigator.serviceWorker.register(__uv$config.sw, { scope: __uv$config.prefix });
    const deadline = Date.now() + 10000;
    while (!registration.active && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!registration.active) throw new Error('The proxy service worker did not activate.');
    // A newly registered worker may not control the current page yet. Waiting
    // briefly avoids the first proxy navigation racing service-worker takeover.
    if (!navigator.serviceWorker.controller && registration.active) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 1500);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }

    const connection = new BareMux.BareMuxConnection('/baremux/worker.js');
    const wisp = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/wisp/`;
    await connection.setTransport('/epoxy/index.mjs', [{ wisp }]);
  }

  function normalize(input) {
    const value = input.trim();
    if (/^https?:\/\//i.test(value)) return value;
    if (/^[^\s.]+\.[^\s]{2,}$/.test(value)) return `https://${value}`;
    return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
  }

  async function encode(input) {
    if (!ready) ready = init().catch(error => { ready = null; throw error; });
    await ready;
    return __uv$config.prefix + __uv$config.encodeUrl(normalize(input));
  }

  return { encode, backendAvailable, chatAvailable, serverScope, status };
})();

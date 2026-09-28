// Fresh Ultraviolet client for IDK 10.0.
// This module owns one proxy initialization path and never removes/reloads
// Ultraviolet globals that another app may already be using.
const PROXY = (() => {
  let initPromise = null;
  let connection = null;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const absolute = new URL(src, location.href).href;
      const existing = [...document.scripts].find(script => script.src === absolute);
      if (existing) {
        if (
          existing.dataset.idkLoaded === 'true' ||
          (src === '/uv/uv.bundle.js' && window.Ultraviolet) ||
          (src === '/uv/uv.config.js' && window.__uv$config) ||
          (src === '/baremux/index.js' && window.BareMux?.BareMuxConnection)
        ) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(`Could not load ${src}.`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.addEventListener('load', () => {
        script.dataset.idkLoaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => {
        script.remove();
        reject(new Error(`Could not load ${src}. Check the IDK server.`));
      }, { once: true });
      document.head.appendChild(script);
    });
  }

  async function status() {
    try {
      const response = await fetch('/api/status', { cache: 'no-store', credentials: 'same-origin' });
      return response.ok ? await response.json() : {};
    } catch {
      return {};
    }
  }

  async function backendAvailable() {
    return (await status()).proxy === true;
  }

  async function chatAvailable() {
    return (await status()).chat === true;
  }

  async function serverScope() {
    try {
      const response = await fetch('/api/browser/scope', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      return response.ok ? await response.json() : {};
    } catch {
      return {};
    }
  }

  async function init() {
    if (!window.isSecureContext) {
      throw new Error('The proxy requires HTTPS (or localhost).');
    }
    if (!('serviceWorker' in navigator)) {
      throw new Error('This browser does not support service workers.');
    }

    // Ultraviolet's bundle must exist before uv.config.js evaluates.
    await loadScript('/uv/uv.bundle.js');
    await loadScript('/uv/uv.config.js');
    await loadScript('/baremux/index.js');

    if (!window.Ultraviolet) throw new Error('Ultraviolet failed to load.');
    if (!window.__uv$config) throw new Error('Ultraviolet configuration failed to load.');
    if (!window.BareMux?.BareMuxConnection) throw new Error('BareMux failed to load.');

    const scope = __uv$config.prefix;
    const registration = await navigator.serviceWorker.register(__uv$config.sw, {
      scope,
      updateViaCache: 'none'
    });

    await registration.update().catch(() => {});

    // Wait for installation/activation, but never wait for the top-level
    // desktop page to become controlled because its URL is outside /uv/service/.
    const deadline = Date.now() + 10000;
    while (!registration.active && Date.now() < deadline) {
      await sleep(50);
    }
    if (!registration.active) {
      throw new Error('The Ultraviolet service worker did not activate.');
    }

    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 1500);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }

    connection = new BareMux.BareMuxConnection('/baremux/worker.js');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wisp = `${protocol}//${location.host}/wisp/`;
    await connection.setTransport('/epoxy/index.mjs', [{ wisp }]);

    return true;
  }

  async function ensureReady() {
    if (!initPromise) {
      initPromise = init().catch(error => {
        initPromise = null;
        connection = null;
        throw error;
      });
    }
    return initPromise;
  }

  function reset() {
    initPromise = null;
    connection = null;
  }

  function normalize(input) {
    const value = String(input ?? '').trim();
    if (/^https?:\/\//i.test(value)) return value;
    if (/^[^\s.]+\.[^\s]{2,}$/.test(value)) return `https://${value}`;
    return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
  }

  async function encode(input) {
    const target = normalize(input);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await ensureReady();
        return __uv$config.prefix + __uv$config.encodeUrl(target);
      } catch (error) {
        reset();
        if (attempt === 1) throw error;
        await sleep(150);
      }
    }
  }

  return { encode, backendAvailable, chatAvailable, serverScope, status, reset };
})();

(async () => {
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }

  const files = [
    '/idk-gaming-cloud.css', '/idk-batch-fourteen.css', '/idk-game-fix.js',
    '/idk-batch-fourteen.js', '/idk-batch-sixteen.js', '/idk-release-batch.css',
    '/idk-release-next.js', '/idk-redesign.css', '/idk-redesign.js',
    '/idk-all-six.css', '/idk-all-six.js', '/idk-rooms.css', '/idk-rooms.js',
    '/idk-calls-friendly.css', '/idk-calls-friendly.js', '/idk-nonchat-suite.css',
    '/idk-nonchat-suite.js', '/idk-os-expansion.css', '/idk-os-expansion.js'
  ];

  for (const src of files) {
    try {
      if (src.endsWith('.css')) {
        const existing = [...document.querySelectorAll('link[rel="stylesheet"]')]
          .find(link => new URL(link.href, location.href).pathname === src);
        if (!existing) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = src;
          document.head.appendChild(link);
        }
      } else {
        await loadOptionalScript(src);
      }
    } catch (error) {
      console.warn(`IDK optional module failed to load: ${src}`, error);
    }
  }
})();

function loadOptionalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts]
      .find(script => new URL(script.src, location.href).pathname === src);
    if (existing) return resolve();

    const script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });
}

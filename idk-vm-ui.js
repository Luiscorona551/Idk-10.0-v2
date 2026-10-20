// Serves the IDK Virtual Machine manager UI at the IDK origin (/vm/) by
// mirroring the GitHub Pages site, so the manager no longer needs the
// Ultraviolet proxy inside IDK. The UI's own app.js already defaults to the
// same-origin /api/vm backend when it is not running on github.io, and the
// setup gate keeps /vm/ signed-in-only like the rest of the desktop.
const UI_ORIGIN = 'https://luiscorona551.github.io/idk-Virtual-Machine/';
const FILES = new Map([
  ['/', { path: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/index.html', { path: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/app.js', { path: 'app.js', type: 'text/javascript; charset=utf-8' }],
  ['/styles.css', { path: 'styles.css', type: 'text/css; charset=utf-8' }]
]);
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

async function readUpstream(file) {
  const hit = cache.get(file);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.body;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(UI_ORIGIN + file.path, { signal: controller.signal, headers: { 'user-agent': 'idk-vm-ui/1.0' } });
    if (!res.ok) throw new Error(`GitHub Pages returned HTTP ${res.status} for ${file.path}`);
    const body = Buffer.from(await res.arrayBuffer());
    cache.set(file, { body, fetchedAt: Date.now() });
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export function mountVmUi(app) {
  app.get(['/vm', '/vm/', '/vm/index.html', '/vm/app.js', '/vm/styles.css'], async (req, res) => {
    const key = req.path.startsWith('/vm') ? (req.path.slice(3) || '/') : null;
    const file = key ? FILES.get(key) : null;
    if (!file) return res.sendStatus(404);
    try {
      const body = await readUpstream(file);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', file.type);
      res.send(body);
    } catch (error) {
      res.status(502).type('text/plain').send(`Could not load the Virtual Machine manager UI: ${error.message}`);
    }
  });
}

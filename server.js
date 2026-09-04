import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import { createRequire } from 'node:module';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { chat } from './chat.js';
import { aiRequest, aiStatus } from './ai.js';
import { hasSession, setupRoutes } from './setup-gate.js';
import { accountRoutes, initAccountDb, accountDbEnabled } from './idk-account-server.js';
import { friendRoutes, initFriendsDb } from './idk-friends-server.js';
import { databaseStatus } from './idk-db-health.js';
import { publicStoreRoutes } from './idk-public-store-server.js';

const require = createRequire(import.meta.url);
const epoxyPath = join(dirname(require.resolve('@mercuryworkshop/epoxy-transport')), '../dist');
const uvServiceWorker = ["self.__uv$cookies = ''; importScripts('/uv/uv.bundle.js', '/uv/uv.config.js');","const uv = new self.UVServiceWorker();","self.addEventListener('fetch', event => {","  if (uv.route(event)) event.respondWith(uv.fetch(event));","});"].join('\n');
const root = dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
const backend = { proxy: Boolean(wisp && typeof wisp.routeRequest === 'function'), chat: Boolean(chat && typeof chat.handleUpgrade === 'function') };
async function backendStatus() { return { ...backend, ai: aiStatus(), database: await databaseStatus() }; }
app.use(express.json({ limit: '20mb' }));
const healthHandler = async (req, res) => res.status(200).json({ ok: true, service: 'ugs-desktop', https: req.secure, ...(await backendStatus()) });
app.get('/healthz', healthHandler);
app.get('/api/health', healthHandler);
setupRoutes(app);
accountRoutes(app);
friendRoutes(app);
publicStoreRoutes(app);
app.get('/api/status', async (req, res) => res.json({ ok: true, ...(await backendStatus()) }));
app.get('/api/browser/scope', async (req, res) => res.json({
  ok: true,
  name: 'IDK Browser',
  origin: `${req.protocol}://${req.get('host')}`,
  proxy: backend.proxy,
  scope: '/uv/',
  transport: backend.proxy ? 'Ultraviolet + Wisp' : 'Unavailable'
}));
app.get('/api/update', async (req, res) => res.json({
  ok: true,
  version: '10.0.0',
  channel: 'stable',
  build: 'final product batch',
  changelog: [
    'Two-row scrollable app desktop with favorites and density controls.',
    'Welcome tour, App Store lifecycle tools, and recovery controls.',
    'Theme, widget, audio, search, and accessibility improvements.',
    'Public HTML app publishing with versions, ratings, installs, and reports.',
    'Files backup and restore plus the IDK System Self-Test.'
  ],
  health: await backendStatus()
}));
app.get('/api/ai/status', (req, res) => res.json(aiStatus()));
app.post('/api/ai', aiRequest);
app.get('/uv/uv.config.js', (req, res) => res.sendFile(join(root, 'uv.config.js')));
app.get('/uv/uv.sw.js', (req, res) => res.type('js').send(uvServiceWorker));
app.use('/uv/', express.static(uvPath));
app.use('/baremux/', express.static(baremuxPath));
app.use('/epoxy/', express.static(epoxyPath));
const PRIVATE = /^\/(node_modules|public|package(-lock)?\.json|server\.js|chat\.js|ai\.js|setup-gate\.js|idk-account-server\.js|idk-friends-server\.js|idk-db-health\.js|Dockerfile|render\.yaml|\.env)/;
app.use((req, res, next) => (PRIVATE.test(req.path) ? res.sendStatus(404) : next()));
app.use(express.static(root, { extensions: ['html'], dotfiles: 'ignore' }));
const httpsKey = process.env.HTTPS_KEY_FILE, httpsCert = process.env.HTTPS_CERT_FILE;
const server = httpsKey && httpsCert ? createHttpsServer({ key: readFileSync(httpsKey), cert: readFileSync(httpsCert) }, app) : createHttpServer(app);
server.on('upgrade', (req, socket, head) => {
  const u = req.url || '';
  if (!hasSession(req)) socket.destroy();
  else if (/^\/wisp(?:\/|\?|$)/.test(u)) wisp.routeRequest(req, socket, head);
  else if (/^\/chat(?:\?|$)/.test(u)) chat.handleUpgrade(req, socket, head, ws => chat.emit('connection', ws, req));
  else socket.destroy();
});
const port = Number(process.env.PORT) || 8080, host = process.env.HOST || '0.0.0.0', protocol = httpsKey && httpsCert ? 'https' : 'http';
initAccountDb().then(() => initFriendsDb()).then(() => server.listen(port, host, () => {
  console.log(`UGS listening on ${protocol}://${host}:${port}`);
  console.log(`Backends ready: Proxy | Chat | AI ${aiStatus().configured ? 'configured' : 'waiting for AI_API_KEY'} | DB ${accountDbEnabled() ? 'configured' : 'not configured'}`);
})).catch(error => { console.error('IDK database initialization failed:', error); process.exit(1); });

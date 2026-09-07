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
const uvServiceWorker = readFileSync(join(uvPath, 'uv.sw.js'), 'utf8');
const uvServiceWorkerLoader = ["importScripts('/uv/uv.bundle.js');", "importScripts('/uv/uv.config.js');", "importScripts('/uv/uv.sw.js');", "const uv = new self.UVServiceWorker();", "self.addEventListener('fetch', event => {", "  if (uv.route(event)) event.respondWith(uv.fetch(event));", "});", "self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));", "self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));"].join('\n');
const root = dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
const backend = { proxy: Boolean(wisp && typeof wisp.routeRequest === 'function'), chat: Boolean(chat && typeof chat.handleUpgrade === 'function') };
async function backendStatus() { return { ...backend, ai: aiStatus(), database: await databaseStatus() }; }
app.use(express.json({ limit: '20mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(self), bluetooth=(self), gamepad=(self), clipboard-read=(self), clipboard-write=(self)');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: ws: wss:; frame-src 'self' https: data: blob:; worker-src 'self' blob:");
  if (req.path === '/desktop.html' || req.path === '/') res.setHeader('Cache-Control', 'no-store');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
const healthHandler = async (req, res) => res.status(200).json({ ok: true, service: 'ugs-desktop', https: req.secure, ...(await backendStatus()) });
app.get('/healthz', healthHandler);
app.get('/api/health', healthHandler);
setupRoutes(app);
accountRoutes(app);
friendRoutes(app);
publicStoreRoutes(app);
app.get('/api/status', async (req, res) => res.json({ ok: true, ...(await backendStatus()) }));
app.get('/api/deploy/status', async (req, res) => res.json({
  ok: true,
  version: process.env.IDK_VERSION || '10.19.0',
  environment: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV || 'production',
  commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_SHA || process.env.SOURCE_VERSION || 'local build',
  node: process.version,
  uptime: Math.round(process.uptime()),
  checkedAt: new Date().toISOString()
}));
function iceServers() {
  const fallback = [{ urls: ['stun:stun.l.google.com:19302'] }];
  const raw = String(process.env.IDK_ICE_SERVERS || '').trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    const values = Array.isArray(parsed) ? parsed : [parsed];
    const safe = values.map(value => {
      if (typeof value === 'string') return { urls: value };
      if (!value || typeof value !== 'object') return null;
      const urls = Array.isArray(value.urls) ? value.urls.filter(url => typeof url === 'string').slice(0, 8) : String(value.urls || '').trim();
      if (!urls || (Array.isArray(urls) && !urls.length)) return null;
      return { urls, ...(value.username ? { username: String(value.username).slice(0, 160) } : {}), ...(value.credential ? { credential: String(value.credential).slice(0, 320) } : {}) };
    }).filter(Boolean).slice(0, 8);
    return safe.length ? safe : fallback;
  } catch { return fallback; }
}
app.get('/api/call/config', (req, res) => res.json({ ok: true, iceServers: iceServers(), activeTransport: 'peer-to-peer', recording: false }));
app.get('/api/browser/scope', async (req, res) => res.json({
  ok: true,
  name: 'IDK Browser',
  origin: `${req.protocol}://${req.get('host')}`,
  proxy: backend.proxy,
  scope: '/uv/service/',
  transport: backend.proxy ? 'Ultraviolet + Wisp' : 'Unavailable'
}));
app.get('/api/update', async (req, res) => res.json({
  ok: true,
  version: '10.19.0',
  channel: 'stable',
  build: 'final product batch',
  changelog: [
    'Batch nineteen: ciphertext-only Vault cloud backups, one-time Vault transfer codes, printable recovery codes, privacy history, and remote device lock/wipe commands.',
    'Batch eighteen: encrypted local Vault, secure notes, password generation, privacy audit, auto-lock, and encrypted backup import/export.',
    'Batch seventeen: Planner app with Board, Agenda, Calendar, recurring items, drag-and-drop planning, and ICS import/export.',
    'Batch sixteen: WebRTC ICE fallback, long-call expiry, reconnect diagnostics, browser notifications, and production health checks.',
    'Batch fifteen: call reliability, synced call history, optional video, Messenger inbox, notification preferences, and personalization-driven widgets.',
    'Batch fourteen: Widget Library, optional personalization setup, direct-chat call entry, and friend-only voice call signaling.',
    'Batch thirteen: AI mode and privacy controls, Sync Center, Backup & Recovery hub, command palette, and Chromebook/mobile polish.',
    'Batch twelve: Local Agent with Ollama and LM Studio support, permissioned IDK actions, and offline-first local chat.',
    'Batch eleven: full-content file transfers with Copy Files progress, conflict review, named Browser Workspaces, handoff links, and direct Today reminders.',
    'Batch ten: IDK Flow with Today, unified search and actions, and selective Transfer Center previews.',
    'Batch nine: unified Settings Hub, one-time cross-device handoff codes, connected-device management, and recovery shortcuts.',
    'Batch eight: Downloads Manager, bulk Files actions, Device Handoff startup checks, and reliability polish.',
    'Batch six: Files-backed Gallery, Contacts, Control Center, workspace controls, and Chat Room 2.0 attachments, mentions, replies, and reactions.',
    'Batch five: live open-window taskbar, desktop window actions, System Monitor, workspace save access, and responsive shell polish.',
    'Batch four: functional Files locations, canonical text-file writes, richer Browser persistence, Notes-to-Files export, local Calendar dates, app change events, and safer snapshot restore.',
    'Batch three: visible sync health, safe workspace sharing, pre-restore conflict snapshots, IndexedDB-aware storage reporting, and offline cache updates.',
    'Batch two: one-at-a-time onboarding, local guest access, safer local state handling, keyboard focus improvements, and idle-time startup work.',
    'IDK Hub control center with focus modes, routines, privacy controls, health checks, recovery snapshots, and appearance tools.',
    'Two-row scrollable app desktop with favorites and density controls.',
    'Welcome tour, App Store lifecycle tools, and recovery controls.',
    'Theme, widget, audio, search, and accessibility improvements.',
    'Public HTML app publishing with versions, ratings, installs, and reports.',
    'App manifests, content fingerprints, verified publishers, creator updates, and version history.',
    'Account security status, full account export, permanent account deletion, and offline recovery tools.',
    'Installable PWA shell with service-worker caching, recovery snapshots, profiles, and command palette.',
    'Files backup and restore plus the IDK System Self-Test.',
    'Smart Workspaces, Universal Clipboard, Share Sheet, and System Timeline.',
    'Drag-and-drop desktop widgets for weather, news, calendar, stocks, and sports.',
    'Accounts & Devices with profile-isolated storage, multi-provider sync, browser sessions, and hardware bridges.',
    'Encrypted recovery packages, storage health, offline retry queues, PWA updates, accessibility focus management, and sandboxed installed apps.',
    'Security headers, login throttling, app capability fingerprints, crash diagnostics, and persistent-storage controls.',
    'Ecosystem Hub with collaboration rooms, extension records, private AI mode, localization, virtual desktops, portability, and update-channel controls.',
    'Reliability Center with deployment checks, diagnostics export, sync health, account recovery codes, password reset, and app trust controls.',
    'Official Spotify, YouTube, and Internet Archive media links with no unapproved streaming proxies.'
  ],
  health: await backendStatus()
}));
app.get('/api/ai/status', (req, res) => res.json(aiStatus()));
app.post('/api/ai', aiRequest);
app.get('/uv/uv.config.js', (req, res) => res.sendFile(join(root, 'uv.config.js')));
app.get('/uv/uv.sw.js', (req, res) => res.type('js').send(uvServiceWorker));
app.get('/uv/sw.js', (req, res) => res.type('js').send(uvServiceWorkerLoader));
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

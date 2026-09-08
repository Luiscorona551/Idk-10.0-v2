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

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const ignored = new Set(['node_modules', '.git']);
const files = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && path.endsWith('.js')) files.push(path);
  }
}

walk(root);
for (const file of files) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (error) { console.error(`Syntax check failed: ${relative(root, file)}\n${error.stdout?.toString() || error.stderr?.toString() || error.message}`); process.exitCode = 1; }
}

let references = 0;
for (const page of ['index.html', 'desktop.html']) {
  const html = readFileSync(join(root, page), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
  for (const asset of assets) {
    const path = asset.split(/[?#]/, 1)[0];
    if (!path || /^(?:https?:|data:|#|\/\/)/i.test(path)) continue;
    references += 1;
    const localPath = path.replace(/^\/+/, '');
    if (!existsSync(join(root, localPath))) {
      console.error(`Missing local asset referenced by ${page}: ${asset}`);
      process.exitCode = 1;
    }
  }
}

const apps = readFileSync(join(root, 'apps.js'), 'utf8');
if (!apps.includes('https://open.spotify.com/')) { console.error('Official Spotify entry is missing.'); process.exitCode = 1; }
if (/7reels\.cc/i.test(apps)) { console.error('Unapproved movie source found.'); process.exitCode = 1; }
if (!apps.includes('GAME_FAVORITES_KEY') || !apps.includes('game-player-toolbar')) { console.error('Game quality controls are missing.'); process.exitCode = 1; }
if (!apps.includes("names = await loadJSON('games.json')") || !apps.includes('function gameHTMLURL(name)') || !apps.includes('return GAME_CDN + encodeURIComponent(file);') || !apps.includes("const src = gameHTMLURL(name);")) { console.error('Games app must load games.json and open each game through its matching HTML URL.'); process.exitCode = 1; }
if (apps.includes('gameBlobURL(') || apps.includes('URL.createObjectURL(new Blob([await res.text()]')) { console.error('Games must open the original HTML URL directly, not a generated blob URL.'); process.exitCode = 1; }
if (!apps.includes("https://www.blooket.com/")) { console.error('Official Blooket entry is missing.'); process.exitCode = 1; }
if (!apps.includes('soundboard:') || !apps.includes('render: () => externalSite(site.url, site.title, { embeddable: false })')) { console.error('Soundboard sources must use the safe external launch flow.'); process.exitCode = 1; }
const accountClient = readFileSync(join(root, 'idk-account-client.js'), 'utf8');
if (!accountClient.includes("catch { return true; }") || accountClient.includes("const o = modal()")) { console.error('Account auth must not block unauthenticated desktop startup.'); process.exitCode = 1; }
const bootScreen = readFileSync(join(root, 'idk-boot-screen.js'), 'utf8');
if (!bootScreen.includes('try { seen = window.localStorage?.getItem(KEY)') || !bootScreen.includes('try { window.localStorage?.setItem(KEY, \'1\'); }')) { console.error('Boot screen must tolerate unavailable browser storage.'); process.exitCode = 1; }
const stability = readFileSync(join(root, 'idk-production-stability.js'), 'utf8');
if (!stability.includes("try{localStorage.setItem('idkProductionVersion',VERSION)}catch{}")) { console.error('Production stability boot must tolerate unavailable browser storage.'); process.exitCode = 1; }
if (!stability.includes("Boolean(d.ai?.configured)") || !stability.includes("Boolean(d.vm?.enabled&&d.vm?.qemu?.enabled)") || !stability.includes("try{storage=Boolean(window.localStorage&&window.indexedDB)}catch{}")) { console.error('System Health must report actual AI/VM configuration and tolerate blocked storage.'); process.exitCode = 1; }
const observerFiles = [
  'idk-friendly-dm.js', 'idk-calls-friendly.js', 'idk-release-batch.js',
  'idk-finish-suite.js', 'idk-all-six.js', 'idk-os-next.js',
  'idk-media-mail-polish.js', 'idk-advanced-polish.js',
  'idk-music-playlists.js', 'idk-desktop-custom-browser-suite.js'
];
for (const name of observerFiles) {
  const source = readFileSync(join(root, name), 'utf8');
  if (/observe(document.body/.test(source)) {
    console.error(`Desktop feature ${name} must not install a document-wide mutation observer.`);
    process.exitCode = 1;
  }
}
const messengerCleanup = readFileSync(join(root, 'idk-messenger-cleanup.js'), 'utf8');
if (messengerCleanup.includes("querySelectorAll('*')")) {
  console.error('Messenger cleanup must not traverse every DOM element.');
  process.exitCode = 1;
}
const smartDesktop = readFileSync(join(root, 'idk-smart-desktop.js'), 'utf8');
if (smartDesktop.includes('setInterval(scan, 2500)') || /observe(document.body/.test(smartDesktop)) {
  console.error('Smart Desktop must not poll or watch the entire page.');
  process.exitCode = 1;
}
const releaseBatch = readFileSync(join(root, 'idk-release-batch.js'), 'utf8');
if ((releaseBatch.match(/new MutationObserver/g) || []).length !== 1) {
  console.error('Release Batch must install only one scoped mutation observer.');
  process.exitCode = 1;
}
const server = readFileSync(join(root, 'server.js'), 'utf8');
if (!server.includes('IDK_ICE_SERVERS') || !server.includes('hasTurn')) { console.error('TURN-ready call configuration is missing.'); process.exitCode = 1; }
if (process.argv.includes('--smoke')) {
  const base = String(process.env.IDK_BASE_URL || '').replace(/\/$/, '');
  if (!base) { console.error('Set IDK_BASE_URL when using --smoke.'); process.exitCode = 1; }
  else {
    for (const path of ['/healthz', '/api/call/config', '/api/browser/scope']) {
      try {
        const response = await fetch(`${base}${path}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || data.ok === false) throw new Error(`${response.status}`);
        console.log(`Smoke check passed: ${path}`);
      } catch (error) {
        console.error(`Smoke check failed: ${path} (${error.message})`);
        process.exitCode = 1;
      }
    }
  }
}
if (process.exitCode) process.exit(process.exitCode);
console.log(`IDK validation passed: ${files.length} JavaScript files and ${references.length} local assets checked.`);

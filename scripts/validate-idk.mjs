import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
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

const desktop = readFileSync(join(root, 'desktop.html'), 'utf8');
const references = [...desktop.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]).filter(value => /\.(?:js|css)$/.test(value) && !/^https?:/.test(value));
for (const reference of references) {
  if (!readFileSync(join(root, reference), 'utf8')) process.exitCode = 1;
}

const apps = readFileSync(join(root, 'apps.js'), 'utf8');
if (!apps.includes('https://open.spotify.com/')) { console.error('Official Spotify entry is missing.'); process.exitCode = 1; }
if (/7reels\.cc/i.test(apps)) { console.error('Unapproved movie source found.'); process.exitCode = 1; }
if (!apps.includes('GAME_FAVORITES_KEY') || !apps.includes('game-player-toolbar')) { console.error('Game quality controls are missing.'); process.exitCode = 1; }
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

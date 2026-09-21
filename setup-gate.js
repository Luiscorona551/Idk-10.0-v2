import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_KEYS = [
  'PZ4B-PRWS-2WCX'
];

function normalizeKey(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const configuredKeys = (process.env.SETUP_KEYS || process.env.SETUP_KEY || '')
  .split(',')
  .map(key => key.trim())
  .filter(Boolean);
// Built-in keys always remain valid; deployment environment keys are additional.
const KEYS = [...new Set([...DEFAULT_KEYS, ...configuredKeys])];
// A fresh secret per boot means restarting the server re-locks every browser.
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const COOKIE = 'ugs_setup';
// Keep the setup gate persistent for 10 years so reopening the site does not restart setup.\nconst MAX_AGE = 60 * 60 * 24 * 3650;

// Paths the setup flow itself needs before a session exists.
const PUBLIC = [
  /^\/$/,
  /^\/index\.html$/,
  /^\/game\.html$/,
  /^\/setup\.css$/,
  /^\/setup\.js$/,
  /^\/ugs-icon\.jpeg$/,
  /^\/profile-[0-9]\.jpg$/,
  /^\/official-flag\.jpg$/,
  /^\/favicon\.ico$/
];

// Hashing first keeps the comparison constant time whatever the lengths are.
function equals(a, b) {
  const digest = value => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function sign(expiry) {
  return `${expiry}.${createHmac('sha256', SECRET).update(String(expiry)).digest('hex')}`;
}

function valid(token) {
  const [expiry, digest] = String(token).split('.');
  if (!expiry || !digest || Number(expiry) < Date.now()) return false;
  const expected = createHmac('sha256', SECRET).update(expiry).digest('hex');
  return equals(digest, expected);
}

export function hasSession(req) {
  const cookies = req.headers.cookie ?? '';
  const match = cookies.split(';').map(part => part.trim().split('='))
    .find(([name]) => name === COOKIE);
  return Boolean(match && valid(decodeURIComponent(match[1])));
}

export function setupRoutes(app) {
  app.post('/api/setup', (req, res) => {
    const submittedKey = normalizeKey(req.body?.key);
    if (!KEYS.some(key => equals(submittedKey, normalizeKey(key)))) {
      return res.status(403).json({ ok: false });
    }
    const token = sign(Date.now() + MAX_AGE * 1000);
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: MAX_AGE * 1000,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
    });
    res.json({ ok: true });
  });

  app.use((req, res, next) => {
    if (PUBLIC.some(pattern => pattern.test(req.path)) || hasSession(req)) return next();
    if (req.method === 'GET' && req.accepts('html')) return res.redirect('/');
    res.sendStatus(403);
  });
}

import { Pool } from 'pg';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const sessions = new Map();

export function accountDbEnabled() { return Boolean(pool); }
export async function initAccountDb() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS idk_users (id UUID PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT, avatar TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  await pool.query(`CREATE TABLE IF NOT EXISTS idk_state (user_id UUID PRIMARY KEY REFERENCES idk_users(id) ON DELETE CASCADE, desktop JSONB NOT NULL DEFAULT '{}'::jsonb, games JSONB NOT NULL DEFAULT '[]'::jsonb, files JSONB NOT NULL DEFAULT '[]'::jsonb, messenger JSONB NOT NULL DEFAULT '{}'::jsonb, sheets JSONB NOT NULL DEFAULT '{}'::jsonb, cards JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
}
function hashPassword(password, salt = randomBytes(16).toString('hex')) { return `${salt}:${scryptSync(String(password), salt, 64).toString('hex')}`; }
function verifyPassword(password, stored) { if (!stored) return true; const [salt, hex] = String(stored).split(':'); if (!salt || !hex) return false; try { return timingSafeEqual(scryptSync(String(password), salt, 64), Buffer.from(hex, 'hex')); } catch { return false; } }
function token() { return randomBytes(32).toString('hex'); }
function setSession(res, userId) { const t = token(); sessions.set(t, { userId, expires: Date.now() + 1000 * 60 * 60 * 24 * 30 }); res.cookie('idk_account', t, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 1000 * 60 * 60 * 24 * 30 }); return t; }
function userFromReq(req) { const raw = req.headers.cookie || ''; const m = raw.split(';').map(x => x.trim().split('=')) .find(([k]) => k === 'idk_account'); if (!m) return null; const s = sessions.get(decodeURIComponent(m[1] || '')); if (!s || s.expires < Date.now()) return null; return s.userId; }

export function accountUserId(req) { return userFromReq(req); }
export function accountRoutes(app) {
  app.get('/api/account/status', async (req, res) => {
    if (!pool) return res.json({ ok: true, configured: false, authenticated: false });
    const userId = userFromReq(req);
    if (!userId) return res.json({ ok: true, configured: true, authenticated: false });
    const { rows } = await pool.query('SELECT id, username, avatar FROM idk_users WHERE id=$1', [userId]);
    res.json({ ok: true, configured: true, authenticated: Boolean(rows[0]), user: rows[0] || null });
  });
  app.post('/api/account/register', async (req, res) => {
    if (!pool) return res.status(503).json({ ok:false, error:'Persistent database is not configured. Add DATABASE_URL in Railway.' });
    const username = String(req.body?.username || '').trim().slice(0,32);
    const password = String(req.body?.password || '');
    const avatar = String(req.body?.avatar || 'profile-1.jpg').slice(0,100);
    if (!/^[\w .-]{2,32}$/u.test(username)) return res.status(400).json({ ok:false, error:'Choose a username between 2 and 32 characters.' });
    if (password.length < 6) return res.status(400).json({ ok:false, error:'Password must be at least 6 characters.' });
    const id = crypto.randomUUID();
    try {
      await pool.query('INSERT INTO idk_users(id,username,password_hash,avatar) VALUES($1,$2,$3,$4)', [id, username, hashPassword(password), avatar]);
      await pool.query('INSERT INTO idk_state(user_id) VALUES($1)', [id]);
      setSession(res, id);
      res.json({ ok:true, user:{ id, username, avatar } });
    } catch (e) { res.status(409).json({ ok:false, error:'That username is already in use.' }); }
  });
  app.post('/api/account/login', async (req, res) => {
    if (!pool) return res.status(503).json({ ok:false, error:'Persistent database is not configured.' });
    const username = String(req.body?.username || '').trim(); const password = String(req.body?.password || '');
    const { rows } = await pool.query('SELECT id,username,password_hash,avatar FROM idk_users WHERE lower(username)=lower($1)', [username]);
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ ok:false, error:'Incorrect username or password.' });
    setSession(res, user.id); res.json({ ok:true, user:{ id:user.id, username:user.username, avatar:user.avatar } });
  });
  app.post('/api/account/logout', (req,res) => { const m=(req.headers.cookie||'').split(';').map(x=>x.trim().split('=')) .find(([k])=>k==='idk_account'); if(m) sessions.delete(decodeURIComponent(m[1]||'')); res.clearCookie('idk_account'); res.json({ok:true}); });
  app.get('/api/account/state', async (req,res) => {
    if (!pool) return res.status(503).json({ok:false,error:'Persistent database is not configured.'});
    const id=userFromReq(req); if(!id) return res.status(401).json({ok:false,error:'Not signed in.'});
    const {rows}=await pool.query('SELECT desktop,games,files,messenger,sheets,cards,updated_at FROM idk_state WHERE user_id=$1',[id]);
    res.json({ok:true,state:rows[0]||{}});
  });
  app.put('/api/account/state', async (req,res) => {
    if (!pool) return res.status(503).json({ok:false,error:'Persistent database is not configured.'});
    const id=userFromReq(req); if(!id) return res.status(401).json({ok:false,error:'Not signed in.'});
    const b=req.body||{}; const clean=(v,f)=>v===undefined?f:v;
    await pool.query(`UPDATE idk_state SET desktop=$2::jsonb,games=$3::jsonb,files=$4::jsonb,messenger=$5::jsonb,sheets=$6::jsonb,cards=$7::jsonb,updated_at=NOW() WHERE user_id=$1`,[id,JSON.stringify(clean(b.desktop,{})),JSON.stringify(clean(b.games,[])),JSON.stringify(clean(b.files,[])),JSON.stringify(clean(b.messenger,{})),JSON.stringify(clean(b.sheets,{})),JSON.stringify(clean(b.cards,[]))]);
    res.json({ok:true});
  });
}

export async function saveLegacyState(req, res) { return null; }
export async function getUserState(req) { if(!pool) return null; const id=userFromReq(req); if(!id)return null; const {rows}=await pool.query('SELECT * FROM idk_state WHERE user_id=$1',[id]); return rows[0]||null; }

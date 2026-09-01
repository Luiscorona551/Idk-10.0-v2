import { Pool } from 'pg';
import { createHmac, randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const SECRET = process.env.SESSION_SECRET || 'idk-account-change-me';
const MAX_AGE = 1000 * 60 * 60 * 24 * 30;

export function accountDbEnabled() { return Boolean(pool); }
export async function initAccountDb() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS idk_users (id UUID PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, avatar TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  await pool.query(`CREATE TABLE IF NOT EXISTS idk_state (user_id UUID PRIMARY KEY REFERENCES idk_users(id) ON DELETE CASCADE, desktop JSONB NOT NULL DEFAULT '{}'::jsonb, games JSONB NOT NULL DEFAULT '[]'::jsonb, files JSONB NOT NULL DEFAULT '[]'::jsonb, messenger JSONB NOT NULL DEFAULT '{}'::jsonb, sheets JSONB NOT NULL DEFAULT '{}'::jsonb, cards JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
}
function hashPassword(password, salt = randomBytes(16).toString('hex')) { return `${salt}:${scryptSync(String(password), salt, 64).toString('hex')}`; }
function verifyPassword(password, stored) { const [salt, hex] = String(stored || '').split(':'); if (!salt || !hex) return false; try { return timingSafeEqual(scryptSync(String(password), salt, 64), Buffer.from(hex, 'hex')); } catch { return false; } }
function makeToken(userId) { const exp = Date.now() + MAX_AGE; const body = `${userId}.${exp}`; const sig = createHmac('sha256', SECRET).update(body).digest('hex'); return `${body}.${sig}`; }
function userFromReq(req) { const m=(req.headers.cookie||'').split(';').map(x=>x.trim().split('=')).find(([k])=>k==='idk_account'); if(!m)return null; const parts=decodeURIComponent(m[1]||'').split('.'); if(parts.length!==3)return null; const [userId,exp,sig]=parts; if(!userId||Number(exp)<Date.now())return null; const expected=createHmac('sha256',SECRET).update(`${userId}.${exp}`).digest('hex'); try{return timingSafeEqual(Buffer.from(sig),Buffer.from(expected))?userId:null;}catch{return null;} }
function setSession(res,userId){ res.cookie('idk_account',makeToken(userId),{httpOnly:true,sameSite:'lax',secure:true,maxAge:MAX_AGE}); }
export function accountUserId(req){ return userFromReq(req); }

export function accountRoutes(app) {
  app.get('/api/account/status', async (req,res)=>{
    if(!pool)return res.json({ok:true,configured:false,authenticated:false});
    const id=userFromReq(req); if(!id)return res.json({ok:true,configured:true,authenticated:false});
    const {rows}=await pool.query('SELECT id,username,avatar FROM idk_users WHERE id=$1',[id]);
    res.json({ok:true,configured:true,authenticated:Boolean(rows[0]),user:rows[0]||null});
  });
  app.post('/api/account/register', async(req,res)=>{
    if(!pool)return res.status(503).json({ok:false,error:'Persistent database is not configured. Add DATABASE_URL in Railway.'});
    const username=String(req.body?.username||'').trim().slice(0,32), password=String(req.body?.password||''), avatar=String(req.body?.avatar||'profile-1.jpg').slice(0,100);
    if(!/^[\w .-]{2,32}$/u.test(username))return res.status(400).json({ok:false,error:'Choose a username between 2 and 32 characters.'});
    if(password.length<6)return res.status(400).json({ok:false,error:'Password must be at least 6 characters.'});
    const id=randomUUID();
    try { await pool.query('INSERT INTO idk_users(id,username,password_hash,avatar) VALUES($1,$2,$3,$4)',[id,username,hashPassword(password),avatar]); await pool.query('INSERT INTO idk_state(user_id) VALUES($1)',[id]); setSession(res,id); res.json({ok:true,user:{id,username,avatar}}); }
    catch { res.status(409).json({ok:false,error:'That username is already in use.'}); }
  });
  app.post('/api/account/login',async(req,res)=>{
    if(!pool)return res.status(503).json({ok:false,error:'Persistent database is not configured.'});
    const username=String(req.body?.username||'').trim(),password=String(req.body?.password||''); const {rows}=await pool.query('SELECT id,username,password_hash,avatar FROM idk_users WHERE lower(username)=lower($1)',[username]); const u=rows[0];
    if(!u||!verifyPassword(password,u.password_hash))return res.status(401).json({ok:false,error:'Incorrect username or password.'}); setSession(res,u.id); res.json({ok:true,user:{id:u.id,username:u.username,avatar:u.avatar}});
  });
  app.post('/api/account/logout',(req,res)=>{res.clearCookie('idk_account');res.json({ok:true});});
  app.get('/api/account/state',async(req,res)=>{if(!pool)return res.status(503).json({ok:false,error:'Persistent database is not configured.'});const id=userFromReq(req);if(!id)return res.status(401).json({ok:false,error:'Not signed in.'});const {rows}=await pool.query('SELECT desktop,games,files,messenger,sheets,cards,updated_at FROM idk_state WHERE user_id=$1',[id]);res.json({ok:true,state:rows[0]||{}});});
  app.put('/api/account/state',async(req,res)=>{if(!pool)return res.status(503).json({ok:false,error:'Persistent database is not configured.'});const id=userFromReq(req);if(!id)return res.status(401).json({ok:false,error:'Not signed in.'});const b=req.body||{};const j=(v,d)=>JSON.stringify(v===undefined?d:v);await pool.query(`UPDATE idk_state SET desktop=$2::jsonb,games=$3::jsonb,files=$4::jsonb,messenger=$5::jsonb,sheets=$6::jsonb,cards=$7::jsonb,updated_at=NOW() WHERE user_id=$1`,[id,j(b.desktop,{}),j(b.games,[]),j(b.files,[]),j(b.messenger,{}),j(b.sheets,{}),j(b.cards,[])]);res.json({ok:true});});
}

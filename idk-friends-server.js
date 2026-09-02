import { randomUUID } from 'node:crypto';
import { accountDbEnabled, accountUserId, getAccountPool } from './idk-account-server.js';

const cleanUsername = value => String(value ?? '').trim().slice(0, 32);
const publicUser = row => ({ id: row.id, username: row.username, avatar: row.avatar || 'profile-1.jpg' });

export async function initFriendsDb() {
  const pool = getAccountPool();
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS idk_friend_requests (id UUID PRIMARY KEY, requester_id UUID NOT NULL REFERENCES idk_users(id) ON DELETE CASCADE, recipient_id UUID NOT NULL REFERENCES idk_users(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(requester_id,recipient_id));`);
  await pool.query(`CREATE TABLE IF NOT EXISTS idk_friendships (user_id UUID NOT NULL REFERENCES idk_users(id) ON DELETE CASCADE, friend_id UUID NOT NULL REFERENCES idk_users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id,friend_id), CHECK(user_id <> friend_id));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idk_friend_requests_recipient_idx ON idk_friend_requests(recipient_id,status,created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idk_friend_requests_requester_idx ON idk_friend_requests(requester_id,status,created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idk_friendships_user_idx ON idk_friendships(user_id,created_at DESC);`);
}

function requireUser(req, res) {
  if (!accountDbEnabled()) { res.status(503).json({ ok:false, error:'Persistent database is not configured.' }); return null; }
  const id = accountUserId(req);
  if (!id) { res.status(401).json({ ok:false, error:'Sign in to use Friends.' }); return null; }
  return id;
}

export function friendRoutes(app) {
  app.get('/api/friends/search', async (req,res) => {
    const me = requireUser(req,res); if (!me) return;
    const q = cleanUsername(req.query.q);
    if (q.length < 2) return res.json({ ok:true, users:[] });
    try {
      const { rows } = await getAccountPool().query(`SELECT id,username,avatar FROM idk_users WHERE id<>$1 AND lower(username) LIKE lower($2) ORDER BY lower(username) LIMIT 20`, [me, `%${q}%`]);
      res.json({ ok:true, users:rows.map(publicUser) });
    } catch (error) { console.error('Friend search failed:',error); res.status(500).json({ok:false,error:'Could not search users.'}); }
  });

  app.get('/api/friends', async (req,res) => {
    const me = requireUser(req,res); if (!me) return;
    try {
      const pool = getAccountPool();
      const friends = await pool.query(`SELECT u.id,u.username,u.avatar FROM idk_friendships f JOIN idk_users u ON u.id=f.friend_id WHERE f.user_id=$1 ORDER BY lower(u.username)`, [me]);
      const incoming = await pool.query(`SELECT r.id,u.id AS "userId",u.username,u.avatar,r.created_at AS "createdAt" FROM idk_friend_requests r JOIN idk_users u ON u.id=r.requester_id WHERE r.recipient_id=$1 AND r.status='pending' ORDER BY r.created_at DESC`, [me]);
      const outgoing = await pool.query(`SELECT r.id,u.id AS "userId",u.username,u.avatar,r.created_at AS "createdAt" FROM idk_friend_requests r JOIN idk_users u ON u.id=r.recipient_id WHERE r.requester_id=$1 AND r.status='pending' ORDER BY r.created_at DESC`, [me]);
      res.json({ ok:true, friends:friends.rows.map(publicUser), incoming:incoming.rows, outgoing:outgoing.rows });
    } catch (error) { console.error('Friends list failed:',error); res.status(500).json({ok:false,error:'Could not load Friends.'}); }
  });

  app.post('/api/friends/request', async (req,res) => {
    const me = requireUser(req,res); if (!me) return;
    const username = cleanUsername(req.body?.username); if (!username) return res.status(400).json({ok:false,error:'Enter a username.'});
    try {
      const pool = getAccountPool();
      const found = await pool.query('SELECT id,username,avatar FROM idk_users WHERE lower(username)=lower($1)', [username]);
      const target = found.rows[0];
      if (!target) return res.status(404).json({ok:false,error:'No IDK user was found with that username.'});
      if (target.id === me) return res.status(400).json({ok:false,error:'You cannot add yourself.'});
      const existing = await pool.query(`SELECT status,requester_id,recipient_id FROM idk_friend_requests WHERE (requester_id=$1 AND recipient_id=$2) OR (requester_id=$2 AND recipient_id=$1) ORDER BY updated_at DESC LIMIT 1`, [me,target.id]);
      if (existing.rows[0]?.status === 'pending') return res.status(409).json({ok:false,error: existing.rows[0].requester_id === me ? 'Friend request already sent.' : 'That user already sent you a request.'});
      const areFriends = await pool.query('SELECT 1 FROM idk_friendships WHERE user_id=$1 AND friend_id=$2', [me,target.id]);
      if (areFriends.rows[0]) return res.status(409).json({ok:false,error:'You are already friends.'});
      await pool.query(`INSERT INTO idk_friend_requests(id,requester_id,recipient_id,status,created_at,updated_at) VALUES($1,$2,$3,'pending',NOW(),NOW()) ON CONFLICT(requester_id,recipient_id) DO UPDATE SET status='pending',updated_at=NOW()`, [randomUUID(),me,target.id]);
      res.status(201).json({ok:true,user:publicUser(target)});
    } catch (error) { console.error('Friend request failed:',error); res.status(500).json({ok:false,error:'Could not send the friend request.'}); }
  });

  app.post('/api/friends/respond', async (req,res) => {
    const me = requireUser(req,res); if (!me) return;
    const requestId = String(req.body?.requestId || '').slice(0,64), action = String(req.body?.action || '').toLowerCase();
    if (!requestId || !['accept','decline'].includes(action)) return res.status(400).json({ok:false,error:'Invalid friend request.'});
    const pool = getAccountPool(); const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`SELECT r.id,r.requester_id,r.recipient_id,u.id AS "userId",u.username,u.avatar FROM idk_friend_requests r JOIN idk_users u ON u.id=r.requester_id WHERE r.id=$1 AND r.recipient_id=$2 AND r.status='pending' FOR UPDATE`, [requestId,me]);
      const request = rows[0]; if (!request) { await client.query('ROLLBACK'); return res.status(404).json({ok:false,error:'That friend request is no longer pending.'}); }
      if (action === 'accept') {
        await client.query('INSERT INTO idk_friendships(user_id,friend_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [me,request.requester_id]);
        await client.query('INSERT INTO idk_friendships(user_id,friend_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [request.requester_id,me]);
      }
      await client.query(`UPDATE idk_friend_requests SET status=$2,updated_at=NOW() WHERE id=$1`, [requestId,action === 'accept' ? 'accepted' : 'declined']);
      await client.query('COMMIT');
      res.json({ok:true,action, user:{id:request.userId,username:request.username,avatar:request.avatar || 'profile-1.jpg'}});
    } catch (error) { try { await client.query('ROLLBACK'); } catch {} console.error('Friend response failed:',error); res.status(500).json({ok:false,error:'Could not update the friend request.'}); }
    finally { client.release(); }
  });

  app.delete('/api/friends/:friendId', async (req,res) => {
    const me = requireUser(req,res); if (!me) return;
    const friendId = String(req.params.friendId || '').slice(0,64); if (!friendId || friendId === me) return res.status(400).json({ok:false,error:'Invalid friend.'});
    try { const pool=getAccountPool(); await pool.query('DELETE FROM idk_friendships WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)',[me,friendId]); res.json({ok:true}); }
    catch(error){ console.error('Remove friend failed:',error); res.status(500).json({ok:false,error:'Could not remove friend.'}); }
  });
}

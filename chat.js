import WebSocket, { WebSocketServer } from 'ws';
import { createHash, randomUUID } from 'node:crypto';
import { accountDbEnabled, accountUserId, getAccountPool } from './idk-account-server.js';

const MAX_MESSAGE = 2000;
const MAX_PAYLOAD = 250000;
const MAX_HISTORY = 50;
const MAX_PER_ROOM = 50;
const MAX_MUTE_MINUTES = 60;
const MAX_METADATA = 180000;
const HEARTBEAT_MS = 30000;
const CALL_RING_MS = 120000;
const CALL_ACTIVE_MS = 4 * 60 * 60 * 1000;
const ROOM_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
const rooms = new Map();
const userSockets = new Map();
const calls = new Map();

function room(code) { if (!rooms.has(code)) rooms.set(code, { clients: new Set(), history: [], members: new Map(), bans: new Map(), pinned: new Set(), callParticipants: new Map(), ownerId: null, config: { name: code, theme: 'midnight', readOnlyGuests: false, passwordHash: '', inviteExpiresAt: 0 }, sharedState: { notes: '', tasks: [], whiteboard: [] }, loaded: false, lastActiveAt: Date.now() }); return rooms.get(code); }
function nickKey(value) { return String(value).trim().toLowerCase(); }
function send(socket, payload) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); }
function broadcast(code, payload) { const current = rooms.get(code); if (!current) return; if (payload.type === 'message' && !payload.private) { current.history.push(payload); if (current.history.length > MAX_HISTORY) current.history.shift(); } current.clients.forEach(client => send(client, payload)); }
function safePresence(value = {}, fallback = { status: 'online', message: '' }) { const item = value && typeof value === 'object' ? value : {}; const status = ['online', 'away', 'busy', 'offline'].includes(item.status) ? item.status : fallback.status; return { status, message: String(item.message || fallback.message || '').trim().slice(0, 120) }; }
function users(code) { const current = rooms.get(code); return [...(current?.clients ?? [])].map(client => { const member = current.members.get(client.peerId); return { id: client.peerId, userId: client.userId || null, name: client.nick, presence: safePresence(client.presence), guest: Boolean(member?.guest), role: member?.role || (client.peerId === current.ownerId ? 'owner' : 'member'), mutedUntil: member?.mutedUntil || 0 }; }); }
function presence(code, text) { const current = rooms.get(code); if (!current) return; broadcast(code, { type: 'presence', text, users: users(code), ownerId: current.ownerId }); }
function addUserSocket(socket) { if (!socket.userId) return; const sockets = userSockets.get(socket.userId) || new Set(); sockets.add(socket); userSockets.set(socket.userId, sockets); }
function removeUserSocket(socket) { if (!socket.userId) return; const sockets = userSockets.get(socket.userId); sockets?.delete(socket); if (sockets && !sockets.size) userSockets.delete(socket.userId); }
function callData(value) { if (!value || typeof value !== 'object') return null; try { return JSON.parse(JSON.stringify(value).slice(0, MAX_METADATA)); } catch { return null; } }
function passwordHash(value) { const password = String(value || ''); return password ? createHash('sha256').update(password).digest('hex') : ''; }
function safeRoomConfig(value, fallback = {}) { const config = value && typeof value === 'object' ? value : {}; const theme = ['midnight', 'tide', 'sunset', 'graphite'].includes(config.theme) ? config.theme : fallback.theme; const password = Object.prototype.hasOwnProperty.call(config, 'password') ? passwordHash(config.password) : (config.clearPassword ? '' : (config.passwordHash || fallback.passwordHash || '')); const expiry = Number(config.inviteExpiresAt ?? fallback.inviteExpiresAt ?? 0); return { name: String(config.name || fallback.name || 'IDK Room').trim().slice(0, 40) || 'IDK Room', theme: ['midnight', 'tide', 'sunset', 'graphite'].includes(theme) ? theme : 'midnight', readOnlyGuests: Boolean(config.readOnlyGuests), passwordHash: password, inviteExpiresAt: Number.isFinite(expiry) && expiry > 0 ? expiry : 0 }; }
function publicRoomConfig(config) { return { name: config.name, theme: config.theme, readOnlyGuests: config.readOnlyGuests, inviteExpiresAt: config.inviteExpiresAt || 0, passwordRequired: Boolean(config.passwordHash) }; }
function safeCollabState(value, fallback = {}) { const state = value && typeof value === 'object' ? value : {}; const tasks = Array.isArray(state.tasks) ? state.tasks.map(task => ({ id: String(task.id || randomUUID()).slice(0, 80), text: String(task.text || '').trim().slice(0, 180), done: Boolean(task.done) })).filter(task => task.text).slice(0, 100) : (fallback.tasks || []); const whiteboard = Array.isArray(state.whiteboard) ? state.whiteboard.slice(0, 250).map(stroke => Array.isArray(stroke) ? stroke.slice(0, 80).map(point => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 })) : []).filter(stroke => stroke.length > 1) : (fallback.whiteboard || []); return { notes: String(state.notes ?? fallback.notes ?? '').slice(0, 12000), tasks, whiteboard }; }
async function dbRoomRecord(code) { const pool = getAccountPool(); if (!pool) return null; const { rows } = await pool.query('SELECT room_code AS code,name,theme,read_only_guests AS "readOnlyGuests",password_hash AS "passwordHash",EXTRACT(EPOCH FROM invite_expires_at)*1000 AS "inviteExpiresAt",shared_state AS "sharedState",owner_user_id AS "ownerUserId",EXTRACT(EPOCH FROM last_active_at)*1000 AS "lastActiveAt" FROM idk_rooms WHERE room_code=$1', [code]); return rows[0] || null; }
async function dbRoomBans(code) { const pool = getAccountPool(); if (!pool) return []; const { rows } = await pool.query('SELECT name_key AS "nameKey",user_id AS "userId" FROM idk_room_bans WHERE room_code=$1', [code]); return rows; }
async function dbSaveRoom(code, config, ownerUserId = null, sharedState = {}) { const pool = getAccountPool(); if (!pool) return; await pool.query('INSERT INTO idk_rooms(room_code,name,theme,read_only_guests,password_hash,invite_expires_at,shared_state,owner_user_id,updated_at,last_active_at) VALUES($1,$2,$3,$4,$5,TO_TIMESTAMP(NULLIF($6::double precision,0)/1000),$7::jsonb,$8,NOW(),NOW()) ON CONFLICT(room_code) DO UPDATE SET name=EXCLUDED.name,theme=EXCLUDED.theme,read_only_guests=EXCLUDED.read_only_guests,password_hash=EXCLUDED.password_hash,invite_expires_at=EXCLUDED.invite_expires_at,shared_state=EXCLUDED.shared_state,owner_user_id=COALESCE(idk_rooms.owner_user_id,EXCLUDED.owner_user_id),updated_at=NOW(),last_active_at=NOW()', [code, config.name, config.theme, config.readOnlyGuests, config.passwordHash || '', config.inviteExpiresAt || 0, JSON.stringify(sharedState), ownerUserId]); }
async function dbTouchRoom(code) { const pool = getAccountPool(); if (!pool) return; await pool.query('UPDATE idk_rooms SET last_active_at=NOW() WHERE room_code=$1', [code]); }
async function dbBanRoom(code, userId, name) { const pool = getAccountPool(); if (!pool) return; await pool.query('INSERT INTO idk_room_bans(room_code,name_key,user_id) VALUES($1,$2,$3) ON CONFLICT(room_code,name_key) DO UPDATE SET user_id=EXCLUDED.user_id', [code, nickKey(name), userId || null]); }
async function dbUnbanRoom(code, nameKey) { const pool = getAccountPool(); if (!pool) return; await pool.query('DELETE FROM idk_room_bans WHERE room_code=$1 AND name_key=$2', [code, nickKey(nameKey)]); }
function sendToUser(userId, payload) { userSockets.get(userId)?.forEach(socket => send(socket, payload)); return Boolean(userSockets.get(userId)?.size); }
function expireCall(call) { if (calls.get(call.id) !== call) return; calls.delete(call.id); [call.initiator, call.recipient].forEach(userId => sendToUser(userId, { type: 'call', action: 'expired', callId: call.id })); }
function scheduleCall(call, active = false) { clearTimeout(call.expiry); call.phase = active ? 'active' : 'ringing'; call.expiresAt = Date.now() + (active ? CALL_ACTIVE_MS : CALL_RING_MS); call.expiry = setTimeout(() => expireCall(call), active ? CALL_ACTIVE_MS : CALL_RING_MS); call.expiry.unref?.(); }
async function areFriends(userId, friendId) { if (!accountDbEnabled() || !userId || !friendId) return false; try { const { rows } = await getAccountPool().query('SELECT 1 FROM idk_friendships f WHERE f.user_id=$1 AND f.friend_id=$2 AND NOT EXISTS (SELECT 1 FROM idk_user_blocks b WHERE (b.user_id=$1 AND b.blocked_id=$2) OR (b.user_id=$2 AND b.blocked_id=$1)) LIMIT 1', [userId, friendId]); return Boolean(rows[0]); } catch { return false; } }
function messageMeta(data) { const value = { mentions: Array.isArray(data.mentions) ? data.mentions.map(item => String(item).slice(0, 32)).filter(Boolean).slice(0, 12) : [], attachments: Array.isArray(data.attachments) ? data.attachments.map(item => ({ fileId: String(item.fileId || '').slice(0, 120), name: String(item.name || 'attachment').slice(0, 120), mime: String(item.mime || 'application/octet-stream').slice(0, 80), size: Math.min(Math.max(Number(item.size) || 0, 0), 200000), content: typeof item.content === 'string' && item.content.length <= 160000 ? item.content : '' })).slice(0, 4) : [], replyTo: data.replyTo && typeof data.replyTo === 'object' ? { id: String(data.replyTo.id || '').slice(0, 80), name: String(data.replyTo.name || '').slice(0, 32), text: String(data.replyTo.text || '').slice(0, 180) } : null }; return JSON.stringify(value).length <= MAX_METADATA ? value : { mentions: value.mentions, attachments: [], replyTo: value.replyTo }; }
function applyMeta(row, base) { const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}; return { ...base, id: row.id, mentions: metadata.mentions || [], attachments: metadata.attachments || [], replyTo: metadata.replyTo || null }; }
async function dbRoomHistory(code) { const pool = getAccountPool(); if (!pool) return []; const { rows } = await pool.query(`SELECT id,sender_user_id AS "userId",sender_name AS name,text,metadata,EXTRACT(EPOCH FROM created_at)*1000 AS at FROM idk_room_messages WHERE room_code=$1 AND private=FALSE ORDER BY created_at DESC LIMIT $2`, [code, MAX_HISTORY]); return rows.reverse().map(row => applyMeta(row, { type: 'message', userId: row.userId, name: row.name, text: row.text, at: Number(row.at) })); }
async function dbDmHistory(userId, targetUserId) { const pool = getAccountPool(); if (!pool || !userId || !targetUserId) return []; const { rows } = await pool.query(`SELECT id,sender_user_id AS "userId",sender_name AS name,text,metadata,EXTRACT(EPOCH FROM created_at)*1000 AS at FROM idk_room_messages WHERE private=TRUE AND ((sender_user_id=$1 AND target_user_id=$2) OR (sender_user_id=$2 AND target_user_id=$1)) ORDER BY created_at ASC LIMIT $3`, [userId, targetUserId, MAX_HISTORY]); return rows.map(row => applyMeta(row, { type: 'message', private: true, userId: row.userId, name: row.name, text: row.text, at: Number(row.at) })); }

export const chat = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
const heartbeat = setInterval(() => { chat.clients.forEach(socket => { if (socket.readyState !== WebSocket.OPEN) return socket.terminate(); if (socket.isAlive === false) return socket.terminate(); socket.isAlive = false; socket.ping(); }); }, HEARTBEAT_MS); heartbeat.unref?.();

chat.on('connection', (socket, req) => {
  socket.code = null; socket.nick = null; socket.presence = { status: 'online', message: '' }; socket.peerId = randomUUID(); socket.userId = accountUserId(req); socket.isAlive = true;
  addUserSocket(socket);
  socket.on('pong', () => { socket.isAlive = true; }); socket.on('error', () => {});
  socket.on('message', async raw => {
    let data; try { data = JSON.parse(raw.toString().slice(0, MAX_PAYLOAD)); } catch { return; }

    if (data.type === 'call') {
      const action = String(data.action || '').toLowerCase();
      const callId = String(data.callId || '').slice(0, 80);
      if (!socket.userId || !callId || !['invite', 'accept', 'reject', 'signal', 'end'].includes(action)) return send(socket, { type: 'call', action: 'error', text: 'Sign in before starting a call.' });
      if (action === 'invite') {
        const targetUserId = String(data.targetUserId || '').slice(0, 64);
        if (!targetUserId || targetUserId === socket.userId || !(await areFriends(socket.userId, targetUserId))) return send(socket, { type: 'call', action: 'error', text: 'Calls are available only between accepted friends.' });
        if (!userSockets.get(targetUserId)?.size) return send(socket, { type: 'call', action: 'error', text: 'That friend is not online right now.' });
        const call = { id: callId, initiator: socket.userId, recipient: targetUserId };
        calls.set(callId, call);
        scheduleCall(call);
        sendToUser(targetUserId, { type: 'call', action: 'invite', callId, fromUserId: socket.userId, fromName: socket.nick || 'IDK user', targetUserId, payload: callData(data.payload) });
        send(socket, { type: 'call', action: 'ringing', callId, targetUserId });
        return;
      }
      const call = calls.get(callId);
      if (!call || ![call.initiator, call.recipient].includes(socket.userId)) return send(socket, { type: 'call', action: 'error', text: 'That call is no longer available.' });
      const targetUserId = call.initiator === socket.userId ? call.recipient : call.initiator;
      sendToUser(targetUserId, { type: 'call', action, callId, fromUserId: socket.userId, fromName: socket.nick || 'IDK user', targetUserId, payload: callData(data.payload) });
      if (action === 'accept') scheduleCall(call, true);
      else if (action === 'signal' && call.phase === 'active') scheduleCall(call, true);
      else if (action === 'reject' || action === 'end') { clearTimeout(call.expiry); calls.delete(callId); }
      return;
    }

    if (data.type === 'join') {
      if (socket.code) return send(socket, { type: 'error', text: 'You are already in a room.' });
       if (accountDbEnabled() && !socket.userId && !data.guestMode) return send(socket, { type: 'error', text: 'Sign in to IDK Messenger first.' });
      const code = String(data.room ?? '').trim().toLowerCase().slice(0, 32);
      const requestedNick = String(data.name ?? '').trim().slice(0, 24);
      const nick = socket.userId ? (requestedNick || 'IDK user') : (requestedNick || 'anon');
      if (!code) return send(socket, { type: 'error', text: 'Room name required.' });
      const target = room(code);
      const firstMember = !target.ownerId;
      if (!target.loaded) {
        try {
          let persisted = await dbRoomRecord(code);
          if (persisted?.lastActiveAt && Date.now() - Number(persisted.lastActiveAt) > ROOM_IDLE_MS) { await getAccountPool()?.query('DELETE FROM idk_rooms WHERE room_code=$1', [code]); persisted = null; }
          if (persisted) { target.config = safeRoomConfig(persisted, target.config); target.sharedState = safeCollabState(persisted.sharedState, target.sharedState); }
          const persistedBans = await dbRoomBans(code);
          persistedBans.forEach(item => target.bans.set(item.nameKey, item));
        } catch {}
        target.loaded = true;
      }
      if (target.config.inviteExpiresAt && Date.now() > target.config.inviteExpiresAt) return send(socket, { type: 'error', text: 'This room invite has expired.' });
      if (target.config.passwordHash && passwordHash(data.roomPassword) !== target.config.passwordHash) return send(socket, { type: 'error', text: 'This room needs its password to join.' });
      if (target.clients.size >= MAX_PER_ROOM) return send(socket, { type: 'error', text: 'That room is full.' });
      if (target.bans.has(nickKey(nick))) { send(socket, { type: 'error', text: 'You are banned from that room.' }); return socket.close(4003, 'Banned'); }
       socket.code = code; socket.nick = nick; socket.presence = safePresence(data.presence);
      if (firstMember) { target.ownerId = socket.peerId; if (!target.config.name || target.config.name === code) target.config = safeRoomConfig(data.roomConfig, target.config); try { await dbSaveRoom(code, target.config, socket.userId, target.sharedState); } catch {} }
      target.members.set(socket.peerId, { id: socket.peerId, name: nick, guest: Boolean(data.guestMode), role: target.ownerId === socket.peerId ? 'owner' : 'member', mutedUntil: 0 });
      target.clients.add(socket);
      target.lastActiveAt = Date.now();
      try { await dbTouchRoom(code); } catch {}
      if (accountDbEnabled()) { try { target.history = await dbRoomHistory(code); } catch {} }
      send(socket, { type: 'joined', room: code, name: nick, peerId: socket.peerId, userId: socket.userId, role: target.members.get(socket.peerId).role, ownerId: target.ownerId, config: publicRoomConfig(target.config), history: target.history, pinned: [...target.pinned], collabState: target.sharedState, users: users(code) });
      presence(code, `${nick} joined`);
      return;
    }

      if (data.type === 'presence-update' && socket.code) {
        socket.presence = safePresence(data.presence, socket.presence);
        presence(socket.code, `${socket.nick} updated their status`);
        return;
      }

      if (data.type === 'room-config' && socket.code) {
        const current = rooms.get(socket.code), member = current?.members.get(socket.peerId);
        if (!current || member?.role !== 'owner') return send(socket, { type: 'error', text: 'Only the room host can change room settings.' });
        current.config = safeRoomConfig(data.config, current.config); current.lastActiveAt = Date.now(); try { await dbSaveRoom(socket.code, current.config, socket.userId, current.sharedState); } catch {} broadcast(socket.code, { type: 'room-config', config: publicRoomConfig(current.config) }); return;
      }

      if (data.type === 'room-bans' && socket.code) {
        const current = rooms.get(socket.code), member = current?.members.get(socket.peerId);
        if (!current || member?.role !== 'owner') return send(socket, { type: 'error', text: 'Only the room host can view the ban list.' });
        send(socket, { type: 'room-bans', bans: [...current.bans.values()].map(item => ({ nameKey: item.nameKey, userId: item.userId || null })) }); return;
      }

      if (data.type === 'collab-update' && socket.code) {
        const current = rooms.get(socket.code), member = current?.members.get(socket.peerId);
        if (!current || (member?.guest && current.config.readOnlyGuests)) return send(socket, { type: 'error', text: 'Guests cannot edit shared tools in this room.' });
        current.sharedState = safeCollabState(data.state, current.sharedState); current.lastActiveAt = Date.now(); try { await dbSaveRoom(socket.code, current.config, current.ownerId === socket.peerId ? socket.userId : null, current.sharedState); } catch {} broadcast(socket.code, { type: 'collab-state', state: current.sharedState, by: socket.nick }); return;
      }

      if (data.type === 'room-call' && socket.code) {
        const current = rooms.get(socket.code), action = String(data.action || '').toLowerCase();
        if (!current || !['join', 'leave', 'signal'].includes(action)) return;
        if (action === 'join') { current.callParticipants.set(socket.peerId, { id: socket.peerId, name: socket.nick, userId: socket.userId || null }); send(socket, { type: 'room-call', action: 'joined', participants: [...current.callParticipants.values()] }); current.clients.forEach(client => { if (client !== socket) send(client, { type: 'room-call', action: 'participant-joined', participant: current.callParticipants.get(socket.peerId) }); }); return; }
        if (action === 'leave') { current.callParticipants.delete(socket.peerId); broadcast(socket.code, { type: 'room-call', action: 'participant-left', peerId: socket.peerId }); return; }
        const targetId = String(data.targetId || '').slice(0, 80), targetSocket = [...current.clients].find(client => client.peerId === targetId); if (targetSocket && targetSocket !== socket) send(targetSocket, { type: 'room-call', action: 'signal', from: { id: socket.peerId, name: socket.nick }, payload: callData(data.payload) }); return;
      }

      if (data.type === 'pin-message' && socket.code) {
        const current = rooms.get(socket.code), member = current?.members.get(socket.peerId), messageId = String(data.messageId || '').slice(0, 80);
        if (!current || !messageId || (member?.guest && current.config.readOnlyGuests)) return;
        if (data.pinned === false) current.pinned.delete(messageId); else if (current.pinned.size < 20) current.pinned.add(messageId);
        broadcast(socket.code, { type: 'pinned', pinned: [...current.pinned] }); return;
      }

      if (data.type === 'workspace-share' && socket.code) {
       const current = rooms.get(socket.code), member = current?.members.get(socket.peerId);
       if (!current || (member?.guest && member.role !== 'owner' && current.config.readOnlyGuests)) return send(socket, { type: 'error', text: 'Guests cannot share workspace details in this room.' });
       broadcast(socket.code, { type: 'workspace-share', name: socket.nick, userId: socket.userId || null, workspace: callData(data.workspace) || {} }); return;
     }

     if (data.type === 'message' && socket.code) {
       const current = rooms.get(socket.code), member = current?.members.get(socket.peerId);
       if (member?.mutedUntil > Date.now()) return send(socket, { type: 'error', text: `You are muted for ${Math.ceil((member.mutedUntil - Date.now()) / 60000)} more minute(s).` });
       if (member?.guest && current.config.readOnlyGuests) return send(socket, { type: 'error', text: 'Guest view mode is enabled for this room.' });
      const text = String(data.text ?? '').trim().slice(0, MAX_MESSAGE); if (!text && !data.attachments?.length) return;
      const metadata = messageMeta(data), payload = { type: 'message', id: randomUUID(), name: socket.nick, userId: socket.userId || null, text, at: Date.now(), ...metadata };
      if (socket.userId) { const pool = getAccountPool(); try { await pool.query('INSERT INTO idk_room_messages(id,room_code,sender_user_id,sender_name,text,metadata,private) VALUES($1,$2,$3,$4,$5,$6,FALSE)', [payload.id, socket.code, socket.userId, socket.nick, text, metadata]); } catch {} }
      broadcast(socket.code, payload); return;
    }

    if (data.type === 'dm-history' && socket.userId) {
      const targetUserId = String(data.targetUserId || '').slice(0, 64); if (!targetUserId || targetUserId === socket.userId) return;
      try { send(socket, { type: 'dm-history', targetUserId, messages: await dbDmHistory(socket.userId, targetUserId) }); } catch { send(socket, { type: 'dm-history', targetUserId, messages: [] }); }
      return;
    }

    if (data.type === 'direct-message' && socket.code) {
      const current = rooms.get(socket.code), member = current?.members.get(socket.peerId);
      if (member?.mutedUntil > Date.now()) return send(socket, { type: 'error', text: `You are muted for ${Math.ceil((member.mutedUntil - Date.now()) / 60000)} more minute(s).` });
      const targetUserId = String(data.targetUserId || '').slice(0, 64);
      const targetId = String(data.targetId || '').slice(0, 64);
      const targetSocket = [...(current?.clients ?? [])].find(client => (targetUserId && client.userId === targetUserId) || (!targetUserId && client.peerId === targetId));
       const text = String(data.text ?? '').trim().slice(0, MAX_MESSAGE), metadata = messageMeta(data);
      if (!targetSocket || targetSocket === socket) return send(socket, { type: 'error', text: 'Choose someone else in this room for a personal chat.' });
       if (!text && !data.attachments?.length) return;
       const payload = { type: 'message', private: true, id: randomUUID(), name: socket.nick, userId: socket.userId || null, fromId: socket.peerId, toId: targetSocket.peerId, toUserId: targetSocket.userId || null, toName: targetSocket.nick, text, at: Date.now(), ...metadata };
       if (socket.userId && targetSocket.userId) { const pool = getAccountPool(); try { await pool.query('INSERT INTO idk_room_messages(id,room_code,sender_user_id,sender_name,target_user_id,text,metadata,private) VALUES($1,$2,$3,$4,$5,$6,$7,TRUE)', [payload.id, socket.code, socket.userId, socket.nick, targetSocket.userId, text, metadata]); } catch {} }
      send(socket, payload); send(targetSocket, payload); return;
    }

    if (data.type === 'reaction' && socket.code) {
      const current = rooms.get(socket.code), message = current?.history.find(item => item.id === String(data.messageId || ''));
      if (!message) return;
      const emoji = String(data.emoji || '❤️').slice(0, 8); message.reactions ||= {};
      const users = Array.isArray(message.reactions[emoji]) ? message.reactions[emoji] : [];
      message.reactions[emoji] = users.includes(socket.peerId) ? users.filter(id => id !== socket.peerId) : [...users, socket.peerId].slice(-50);
      broadcast(socket.code, { type: 'reaction', messageId: message.id, reactions: message.reactions });
      return;
    }

    if (data.type === 'typing' && socket.code) {
      const current = rooms.get(socket.code);
      const targetUserId = String(data.targetUserId || '').slice(0, 64);
      const targetId = String(data.targetId || '').slice(0, 64);
      const targetSocket = [...(current?.clients ?? [])].find(client => (targetUserId && client.userId === targetUserId) || (!targetUserId && targetId && client.peerId === targetId));
      const payload = { type: 'typing', private: Boolean(data.private), fromId: socket.peerId, fromUserId: socket.userId || null, name: socket.nick, typing: Boolean(data.typing) };
      if (payload.private) { if (targetSocket && targetSocket !== socket) send(targetSocket, payload); }
      else current?.clients.forEach(client => { if (client !== socket) send(client, payload); });
      return;
    }

    if (data.type === 'moderation' && socket.code) {
      const current = rooms.get(socket.code), actor = current?.members.get(socket.peerId), canModerate = actor?.role === 'owner' || actor?.role === 'moderator';
      if (!current || !canModerate) return send(socket, { type: 'error', text: 'Only the owner or a moderator can moderate members.' });
      const targetId = String(data.targetId ?? '').slice(0, 64), targetSocket = [...current.clients].find(client => client.peerId === targetId), targetMember = targetSocket && current.members.get(targetSocket.peerId);
      if (!targetSocket || !targetMember || targetSocket === socket) return send(socket, { type: 'error', text: 'Choose another member first.' });
      const action = String(data.action ?? '').toLowerCase();
       if (action === 'transfer-owner') { if (actor.role !== 'owner') return send(socket, { type: 'error', text: 'Only the owner can transfer ownership.' }); current.ownerId = targetSocket.peerId; actor.role = 'member'; targetMember.role = 'owner'; try { await dbSaveRoom(socket.code, current.config, targetSocket.userId, current.sharedState); } catch {} send(socket, { type: 'moderation-result', text: `${targetSocket.nick} is now the room host.` }); presence(socket.code, `${targetSocket.nick} is now the room host`); }
       else if (action === 'promote') { if (actor.role !== 'owner' || targetMember.role !== 'member') return send(socket, { type: 'error', text: 'Only the owner can promote a member to moderator.' }); targetMember.role = 'moderator'; send(socket, { type: 'moderation-result', text: `${targetSocket.nick} is now a moderator.` }); presence(socket.code, `${targetSocket.nick} was promoted to moderator`); }
      else if (actor.role === 'moderator' && targetMember.role !== 'member') return send(socket, { type: 'error', text: 'Moderators can only manage regular members.' });
      else if (action === 'mute') { const minutes = Math.min(Math.max(Number(data.minutes) || 5, 1), MAX_MUTE_MINUTES); targetMember.mutedUntil = Date.now() + minutes * 60000; send(targetSocket, { type: 'muted', until: targetMember.mutedUntil }); send(socket, { type: 'moderation-result', text: `${targetSocket.nick} muted for ${minutes} minute(s).` }); presence(socket.code, `${targetSocket.nick} was muted`); }
       else if (action === 'kick' || action === 'ban') { if (action === 'ban') { current.bans.set(nickKey(targetSocket.nick), { nameKey: nickKey(targetSocket.nick), userId: targetSocket.userId || null }); try { await dbBanRoom(socket.code, targetSocket.userId, targetSocket.nick); } catch {} } const actorLabel = actor.role === 'owner' ? 'room owner' : 'moderator'; send(targetSocket, { type: 'kicked', reason: action === 'ban' ? `You were banned by the ${actorLabel}.` : `You were kicked by the ${actorLabel}.` }); send(socket, { type: 'moderation-result', text: `${targetSocket.nick} ${action === 'ban' ? 'banned' : 'kicked'}.` }); targetSocket.close(action === 'ban' ? 4003 : 4004, action === 'ban' ? 'Banned' : 'Kicked'); }
       else if (action === 'unban') { if (actor.role !== 'owner') return send(socket, { type: 'error', text: 'Only the owner can remove a ban.' }); const nameKey = String(data.nameKey || ''); if (!nameKey) return; current.bans.delete(nickKey(nameKey)); try { await dbUnbanRoom(socket.code, nameKey); } catch {} send(socket, { type: 'moderation-result', text: `${nameKey} can join again.` }); }
       return;
    }
  });

  socket.on('close', () => { removeUserSocket(socket); [...calls.entries()].forEach(([id, call]) => { if (call.initiator === socket.userId || call.recipient === socket.userId) { clearTimeout(call.expiry); calls.delete(id); } }); const current = rooms.get(socket.code); if (!current) return; if (current.callParticipants.delete(socket.peerId)) broadcast(socket.code, { type: 'room-call', action: 'participant-left', peerId: socket.peerId }); current.clients.delete(socket); current.members.delete(socket.peerId); current.lastActiveAt = Date.now(); if (!current.clients.size) return rooms.delete(socket.code); if (current.ownerId === socket.peerId) { const nextOwner = [...current.clients][0]; current.ownerId = nextOwner?.peerId || null; if (nextOwner) { current.members.get(nextOwner.peerId).role = 'owner'; dbSaveRoom(socket.code, current.config, nextOwner.userId, current.sharedState).catch(() => {}); } } presence(socket.code, `${socket.nick} left`); });
});

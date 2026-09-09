import WebSocket, { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
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
const rooms = new Map();
const userSockets = new Map();
const calls = new Map();

function room(code) { if (!rooms.has(code)) rooms.set(code, { clients: new Set(), history: [], members: new Map(), bans: new Map(), ownerId: null }); return rooms.get(code); }
function nickKey(value) { return String(value).trim().toLowerCase(); }
function send(socket, payload) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); }
function broadcast(code, payload) { const current = rooms.get(code); if (!current) return; if (payload.type === 'message' && !payload.private) { current.history.push(payload); if (current.history.length > MAX_HISTORY) current.history.shift(); } current.clients.forEach(client => send(client, payload)); }
function users(code) { const current = rooms.get(code); return [...(current?.clients ?? [])].map(client => { const member = current.members.get(client.peerId); return { id: client.peerId, userId: client.userId || null, name: client.nick, role: member?.role || (client.peerId === current.ownerId ? 'owner' : 'member'), mutedUntil: member?.mutedUntil || 0 }; }); }
function presence(code, text) { const current = rooms.get(code); if (!current) return; broadcast(code, { type: 'presence', text, users: users(code), ownerId: current.ownerId }); }
function addUserSocket(socket) { if (!socket.userId) return; const sockets = userSockets.get(socket.userId) || new Set(); sockets.add(socket); userSockets.set(socket.userId, sockets); }
function removeUserSocket(socket) { if (!socket.userId) return; const sockets = userSockets.get(socket.userId); sockets?.delete(socket); if (sockets && !sockets.size) userSockets.delete(socket.userId); }
function callData(value) { if (!value || typeof value !== 'object') return null; try { return JSON.parse(JSON.stringify(value).slice(0, MAX_METADATA)); } catch { return null; } }
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
  socket.code = null; socket.nick = null; socket.peerId = randomUUID(); socket.userId = accountUserId(req); socket.isAlive = true;
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
      if (accountDbEnabled() && !socket.userId) return send(socket, { type: 'error', text: 'Sign in to IDK Messenger first.' });
      const code = String(data.room ?? '').trim().toLowerCase().slice(0, 32);
      const requestedNick = String(data.name ?? '').trim().slice(0, 24);
      const nick = socket.userId ? (requestedNick || 'IDK user') : (requestedNick || 'anon');
      if (!code) return send(socket, { type: 'error', text: 'Room name required.' });
      const target = room(code);
      if (target.clients.size >= MAX_PER_ROOM) return send(socket, { type: 'error', text: 'That room is full.' });
      if (target.bans.has(nickKey(nick))) { send(socket, { type: 'error', text: 'You are banned from that room.' }); return socket.close(4003, 'Banned'); }
      socket.code = code; socket.nick = nick;
      if (!target.ownerId) target.ownerId = socket.peerId;
      target.members.set(socket.peerId, { id: socket.peerId, name: nick, role: target.ownerId === socket.peerId ? 'owner' : 'member', mutedUntil: 0 });
      target.clients.add(socket);
      if (accountDbEnabled()) { try { target.history = await dbRoomHistory(code); } catch {} }
      send(socket, { type: 'joined', room: code, name: nick, peerId: socket.peerId, userId: socket.userId, role: target.members.get(socket.peerId).role, ownerId: target.ownerId, history: target.history, users: users(code) });
      presence(code, `${nick} joined`);
      return;
    }

    if (data.type === 'message' && socket.code) {
      const current = rooms.get(socket.code), member = current?.members.get(socket.peerId);
      if (member?.mutedUntil > Date.now()) return send(socket, { type: 'error', text: `You are muted for ${Math.ceil((member.mutedUntil - Date.now()) / 60000)} more minute(s).` });
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
      if (action === 'promote') { if (actor.role !== 'owner' || targetMember.role !== 'member') return send(socket, { type: 'error', text: 'Only the owner can promote a member to moderator.' }); targetMember.role = 'moderator'; send(socket, { type: 'moderation-result', text: `${targetSocket.nick} is now a moderator.` }); presence(socket.code, `${targetSocket.nick} was promoted to moderator`); }
      else if (actor.role === 'moderator' && targetMember.role !== 'member') return send(socket, { type: 'error', text: 'Moderators can only manage regular members.' });
      else if (action === 'mute') { const minutes = Math.min(Math.max(Number(data.minutes) || 5, 1), MAX_MUTE_MINUTES); targetMember.mutedUntil = Date.now() + minutes * 60000; send(targetSocket, { type: 'muted', until: targetMember.mutedUntil }); send(socket, { type: 'moderation-result', text: `${targetSocket.nick} muted for ${minutes} minute(s).` }); presence(socket.code, `${targetSocket.nick} was muted`); }
      else if (action === 'kick' || action === 'ban') { if (action === 'ban') current.bans.set(nickKey(targetSocket.nick), Date.now()); const actorLabel = actor.role === 'owner' ? 'room owner' : 'moderator'; send(targetSocket, { type: 'kicked', reason: action === 'ban' ? `You were banned by the ${actorLabel}.` : `You were kicked by the ${actorLabel}.` }); send(socket, { type: 'moderation-result', text: `${targetSocket.nick} ${action === 'ban' ? 'banned' : 'kicked'}.` }); targetSocket.close(action === 'ban' ? 4003 : 4004, action === 'ban' ? 'Banned' : 'Kicked'); }
      return;
    }
  });

  socket.on('close', () => { removeUserSocket(socket); [...calls.entries()].forEach(([id, call]) => { if (call.initiator === socket.userId || call.recipient === socket.userId) { clearTimeout(call.expiry); calls.delete(id); } }); const current = rooms.get(socket.code); if (!current) return; current.clients.delete(socket); current.members.delete(socket.peerId); if (!current.clients.size) return rooms.delete(socket.code); if (current.ownerId === socket.peerId) { const nextOwner = [...current.clients][0]; current.ownerId = nextOwner?.peerId || null; if (nextOwner) current.members.get(nextOwner.peerId).role = 'owner'; } presence(socket.code, `${socket.nick} left`); });
});

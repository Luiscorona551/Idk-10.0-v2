(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const PROFILE_KEY = 'idkMessengerProfile';
  const readProfile = () => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; } };
  const saveProfile = value => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(value)); } catch {} };
  let socket = null, controller = null, pendingTarget = null;

  function addStyles() {
    if (document.getElementById('idk-live-messenger-style')) return;
    const link = document.createElement('link'); link.id = 'idk-live-messenger-style'; link.rel = 'stylesheet'; link.href = 'idk-messenger-live.css'; document.head.append(link);
  }

  function openMessenger(options = {}) {
    addStyles(); document.querySelector('.idk-live-messenger-overlay')?.remove();
    if (socket) { socket.close(); socket = null; }
    const profile = readProfile(), accountUser = window.IDKAccount?.user, initialTarget = options.target || pendingTarget; pendingTarget = null;
    const overlay = document.createElement('div'); overlay.className = 'idk-live-messenger-overlay';
    const root = document.createElement('section'); root.className = 'idk-live-messenger';
    root.innerHTML = `<header class="idk-live-title"><strong>Idk Messenger</strong><span class="idk-live-status">Offline</span><button class="idk-live-close" type="button" aria-label="Close Messenger">×</button></header><div class="idk-live-connect"><input class="field" data-m-name maxlength="24" placeholder="Your name" value="${esc(accountUser?.username || profile.name || '')}" ${accountUser ? 'readonly' : ''}><input class="field" data-m-room maxlength="32" placeholder="Room name" value="${esc(profile.room || 'general')}"><button class="btn" data-m-connect type="button">Connect</button></div><nav class="idk-live-tabs"><button class="active" data-tab="room" type="button">💬 Chat Room <b class="idk-live-tab-badge" data-tab-badge="room" hidden>0</b></button><button data-tab="dm" type="button">💙 Direct DMs <b class="idk-live-tab-badge" data-tab-badge="dm" hidden>0</b></button></nav><div class="idk-live-body"><aside class="idk-live-members"><strong>People in room</strong><input class="field idk-dm-search" data-member-search placeholder="Find a person…" aria-label="Find a person"><div data-members><span class="muted">Connect to see people.</span></div></aside><main class="idk-live-main"><div class="idk-live-room" data-pane="room"><div class="idk-live-heading"><strong># <span data-room-title>general</span></strong><small>Messages are shared with everyone in this room.</small></div><div class="idk-live-messages" data-room-messages></div><div class="idk-live-typing" data-room-typing hidden></div><form class="idk-live-compose" data-room-form><input class="field" placeholder="Message the room…" autocomplete="off"><button class="btn" type="submit">Send</button></form></div><div class="idk-live-dm" data-pane="dm" hidden><div class="idk-live-heading"><strong data-dm-title>Direct messages</strong><small>Private messages are saved to your IDK account.</small></div><div class="idk-live-messages" data-dm-messages><div class="idk-live-empty">Select someone from the room to start a private conversation.</div></div><div class="idk-live-typing" data-dm-typing hidden></div><form class="idk-live-compose" data-dm-form><input class="field" placeholder="Write a private message…" autocomplete="off" disabled><button class="btn" type="submit" disabled>Send</button></form></div></main></div>`;
    overlay.append(root); document.body.append(overlay);
    const status = root.querySelector('.idk-live-status'), name = root.querySelector('[data-m-name]'), room = root.querySelector('[data-m-room]'), members = root.querySelector('[data-members]'), memberSearch = root.querySelector('[data-member-search]'), roomMessages = root.querySelector('[data-room-messages]'), dmMessages = root.querySelector('[data-dm-messages]'), roomTyping = root.querySelector('[data-room-typing]'), dmTyping = root.querySelector('[data-dm-typing]'), dmTitle = root.querySelector('[data-dm-title]'), dmInput = root.querySelector('[data-dm-form] input'), dmButton = root.querySelector('[data-dm-form] button'), roomTitle = root.querySelector('[data-room-title]'), roomBadge = root.querySelector('[data-tab-badge="room"]'), dmBadge = root.querySelector('[data-tab-badge="dm"]'), tabs = [...root.querySelectorAll('[data-tab]')], panes = [...root.querySelectorAll('[data-pane]')];
    const state = { users: [], room: '', me: '', mePeerId: null, meUserId: null, selected: null, selectedUserId: null, selectedName: '', unreadRoom: 0, unreadDm: 0, joined: false, typingTimers: {}, localTyping: { room: false, dm: false } };
    let connectionId = 0;
    const setBadge = (badge, value) => { badge.textContent = String(value); badge.hidden = value < 1; };
    const activePane = pane => root.querySelector(`[data-pane="${pane}"]`)?.hidden === false;
    const send = payload => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); };
    const showTyping = (kind, who, active) => { const target = kind === 'dm' ? dmTyping : roomTyping; clearTimeout(state.typingTimers[kind]); target.hidden = !active; target.textContent = active ? `${who || 'Someone'} is typing…` : ''; if (active) state.typingTimers[kind] = setTimeout(() => showTyping(kind, '', false), 1800); };

    function selectTarget(target) {
      if (!target) return;
      const match = state.users.find(user => (target.userId && user.userId === target.userId) || (target.id && user.id === target.id) || (target.username && user.name?.toLowerCase() === target.username.toLowerCase()) || (target.name && user.name?.toLowerCase() === target.name.toLowerCase()));
      if (!match) { pendingTarget = target; status.textContent = state.joined ? `${target.username || target.name || 'Friend'} is not in this room.` : 'Connect to this room to start a chat.'; return; }
      state.selected = match.id; state.selectedUserId = match.userId || null; state.selectedName = match.name || target.username || target.name || 'Friend'; dmTitle.textContent = `DM · ${state.selectedName}`; dmInput.disabled = dmButton.disabled = false; dmMessages.replaceChildren(Object.assign(document.createElement('div'), { className: 'idk-live-empty', textContent: 'Loading private conversation…' })); if (state.selectedUserId) send({ type: 'dm-history', targetUserId: state.selectedUserId }); root.querySelector('[data-tab="dm"]').click(); renderUsers();
    }

    function renderUsers() {
      const query = memberSearch.value.trim().toLowerCase(); members.replaceChildren(); const visible = state.users.filter(user => !query || user.name.toLowerCase().includes(query));
      if (!visible.length) { members.append(Object.assign(document.createElement('span'), { className: 'muted', textContent: state.users.length ? 'No matching people.' : 'No one else is connected.' })); return; }
      visible.forEach(user => { const isSelf = user.id === state.mePeerId || Boolean(state.meUserId && user.userId === state.meUserId); const button = document.createElement('button'); button.type = 'button'; button.className = 'idk-live-member' + ((state.selectedUserId && state.selectedUserId === user.userId) || (!state.selectedUserId && state.selected === user.id) ? ' selected' : ''); button.innerHTML = `<span class="idk-live-dot"></span><span><strong>${esc(user.name)}</strong><small>${user.id === state.selected ? 'Selected' : isSelf ? 'You' : 'Online'}</small></span>`; if (!isSelf) button.onclick = () => selectTarget(user); members.append(button); });
      if (pendingTarget) { const target = pendingTarget; pendingTarget = null; selectTarget(target); }
    }

    function addMessage(target, payload, privateMessage = false) {
      const item = document.createElement('article'), mine = payload.userId === state.meUserId || (!payload.userId && payload.name === state.me); item.className = `idk-live-message${mine ? ' mine' : ''}`; item.innerHTML = `<div class="idk-live-message-meta"><strong>${esc(payload.name || 'anon')}</strong><time>${new Date(payload.at || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>${privateMessage ? ' · private' : ''}</div><div>${esc(payload.text)}</div>`; target.querySelector('.idk-live-empty')?.remove(); target.append(item); target.scrollTop = target.scrollHeight;
    }

    function handleMessage(data) {
      if (data.type === 'joined') { state.joined = true; state.me = data.name; state.mePeerId = data.peerId || null; state.meUserId = data.userId || state.meUserId; state.users = data.users || []; roomMessages.replaceChildren(); (data.history || []).forEach(item => addMessage(roomMessages, item)); renderUsers(); status.textContent = `Online · ${state.users.length} people`; if (pendingTarget) selectTarget(pendingTarget); return; }
      if (data.type === 'presence') { state.users = data.users || []; status.textContent = `Online · ${state.users.length} people`; renderUsers(); return; }
      if (data.type === 'dm-history') { if (data.targetUserId !== state.selectedUserId) return; dmMessages.replaceChildren(); if (!data.messages?.length) dmMessages.append(Object.assign(document.createElement('div'), { className: 'idk-live-empty', textContent: 'No messages yet. Say hello!' })); else data.messages.forEach(item => addMessage(dmMessages, item, true)); return; }
      if (data.type === 'typing') { const kind = data.private ? 'dm' : 'room'; const relevant = !data.private || (state.selectedUserId && data.fromUserId === state.selectedUserId) || (state.selected && data.fromId === state.selected); if (relevant) showTyping(kind, data.name, data.typing); return; }
      if (data.type === 'message') { if (data.private) { const mine = (data.userId && data.userId === state.meUserId) || (!data.userId && data.name === state.me); const relevant = mine || data.toUserId === state.selectedUserId || data.fromId === state.selected; if (!relevant) { state.unreadDm += 1; setBadge(dmBadge, state.unreadDm); return; } addMessage(dmMessages, data, true); if (!activePane('dm')) { state.unreadDm += 1; setBadge(dmBadge, state.unreadDm); } } else { addMessage(roomMessages, data); if (!activePane('room')) { state.unreadRoom += 1; setBadge(roomBadge, state.unreadRoom); } } return; }
      if (data.type === 'error') status.textContent = data.text || 'Messenger error'; if (data.type === 'kicked') status.textContent = data.reason || 'Disconnected';
    }

    function connect() {
      const requestedName = accountUser?.username || name.value.trim() || 'anon'; const requestedRoom = room.value.trim().toLowerCase().replace(/[^a-z0-9 _-]/g, '').slice(0, 32) || 'general'; saveProfile({ name: requestedName, room: requestedRoom }); state.room = requestedRoom; roomTitle.textContent = requestedRoom; status.textContent = 'Connecting…'; if (socket) socket.close(); const thisConnection = ++connectionId; state.joined = false; state.users = []; const protocol = location.protocol === 'https:' ? 'wss' : 'ws'; socket = new WebSocket(`${protocol}://${location.host}/chat`); socket.addEventListener('open', () => { if (thisConnection === connectionId) send({ type: 'join', name: requestedName, room: requestedRoom }); }); socket.addEventListener('message', event => { if (thisConnection !== connectionId) return; let data; try { data = JSON.parse(event.data); } catch { return; } handleMessage(data); }); socket.addEventListener('close', () => { if (thisConnection !== connectionId) return; state.joined = false; state.users = []; renderUsers(); status.textContent = 'Offline'; });
    }

    function emitTyping(kind, active) { const privateMessage = kind === 'dm'; if (!state.joined || (privateMessage && !state.selected)) return; send({ type: 'typing', private: privateMessage, targetId: privateMessage ? state.selected : '', typing: Boolean(active) }); }
    function bindComposer(form, kind) { const input = form.querySelector('input'); form.onsubmit = event => { event.preventDefault(); const text = input.value.trim(); if (!text) return; emitTyping(kind, false); send(kind === 'dm' ? { type: 'direct-message', targetUserId: state.selectedUserId || undefined, targetId: state.selected, text } : { type: 'message', text }); input.value = ''; }; input.addEventListener('input', () => { if (!input.value.trim()) { state.localTyping[kind] = false; emitTyping(kind, false); return; } if (!state.localTyping[kind]) { state.localTyping[kind] = true; emitTyping(kind, true); } clearTimeout(state.typingTimers[`local-${kind}`]); state.typingTimers[`local-${kind}`] = setTimeout(() => { state.localTyping[kind] = false; emitTyping(kind, false); }, 1300); }); }

    root.querySelector('.idk-live-close').onclick = () => { overlay.remove(); if (socket) { socket.close(); socket = null; } controller = null; };
    root.querySelector('[data-m-connect]').onclick = connect; memberSearch.oninput = renderUsers; bindComposer(root.querySelector('[data-room-form]'), 'room'); bindComposer(root.querySelector('[data-dm-form]'), 'dm');
    tabs.forEach(tab => tab.onclick = () => { tabs.forEach(item => item.classList.toggle('active', item === tab)); panes.forEach(pane => { pane.hidden = pane.dataset.pane !== tab.dataset.tab; }); if (tab.dataset.tab === 'room') { state.unreadRoom = 0; setBadge(roomBadge, 0); } else { state.unreadDm = 0; setBadge(dmBadge, 0); } });
    controller = { selectUser: selectTarget }; if (accountUser?.username || profile.name || initialTarget) setTimeout(connect, 80); else name.focus(); if (initialTarget) pendingTarget = initialTarget;
  }

  function installIcon() { const layer = document.getElementById('icons'); if (!layer || layer.querySelector('[data-live-messenger]')) return; ['chat', 'dm'].forEach(id => layer.querySelector(`[data-final-app="${id}"]`)?.remove()); const button = document.createElement('button'); button.type = 'button'; button.dataset.liveMessenger = 'true'; button.className = 'idk-final-desktop-icon'; button.innerHTML = '<span>💬</span><label>Idk Messenger</label>'; button.ondblclick = () => openMessenger(); layer.append(button); }
  function selectUser(target) { if (controller) controller.selectUser(target); else { pendingTarget = target; openMessenger({ target }); } }
  function init() { addStyles(); installIcon(); setTimeout(installIcon, 600); setTimeout(installIcon, 1400); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  window.IdkMessenger = { open: openMessenger, selectUser };
})();

(() => {
  'use strict';
  if (window.IDKRooms) return;

  const ROOMS_KEY = 'idkSavedRooms';
  const THEMES = ['midnight', 'tide', 'sunset', 'graphite'];
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const open = (id, options) => window.OS?.open?.(id, options);
  const roomList = () => { const value = read(ROOMS_KEY, []); return Array.isArray(value) ? value.slice(0, 24) : []; };
  const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  const userName = () => window.IDKAccount?.user?.username || read('idkMessengerProfile', {}).name || read('chatName', '') || 'Guest';
  const userId = () => window.IDKAccount?.user?.id || null;
  const saveRoom = record => { const saved = { ...record, messages: (record.messages || []).slice(-20) }; write(ROOMS_KEY, [saved, ...roomList().filter(item => item.code !== saved.code)].slice(0, 24)); };
  const removeRoom = value => write(ROOMS_KEY, roomList().filter(item => item.code !== value));
  const button = (label, action, className = 'btn tab') => { const node = document.createElement('button'); node.type = 'button'; node.className = className; node.textContent = label; node.onclick = action; return node; };

  function roomApp(options = {}) {
    const root = document.createElement('div'); root.className = 'app idk-rooms-app';
    root.innerHTML = `<header class="idk-rooms-head"><div><span class="idk-flow-kicker">IDK ROOMS</span><h2>Shared spaces, your way.</h2><p>Bring friends into a focused room without sharing private files, passwords, or your whole desktop.</p></div><div class="idk-rooms-head-actions"><span data-status>Not connected</span><button class="btn" data-new>New room</button></div></header><section class="idk-rooms-lobby" data-lobby><div class="idk-rooms-lobby-card"><strong>Join or create a room</strong><p>Use a six-character code or create a new room and share its invite link.</p><form data-join><input class="field" name="name" maxlength="40" placeholder="Room name"><input class="field" name="code" maxlength="8" placeholder="Room code (optional)" autocomplete="off"><select class="field" name="theme"><option value="midnight">Midnight</option><option value="tide">Neon Tide</option><option value="sunset">Sunset Bloom</option><option value="graphite">Graphite</option></select><label class="idk-rooms-check"><input type="checkbox" name="readonly"> Guests can view, but not write</label><button class="btn" type="submit">Create or join</button></form><p class="idk-rooms-note" data-lobby-status></p></div><div class="idk-rooms-saved"><div class="idk-rooms-section-head"><strong>Saved rooms</strong><small>Reusable room settings</small></div><div data-saved></div></div></section><section class="idk-rooms-live" data-live hidden><aside class="idk-rooms-sidebar"><div class="idk-rooms-room-card"><span class="idk-flow-kicker">ACTIVE ROOM</span><strong data-room-name></strong><code data-room-code></code><p data-room-note></p><div class="idk-rooms-actions" data-room-actions><button class="btn tab" data-settings-toggle>Room settings</button><button class="btn tab" data-leave>Leave room</button></div><section class="idk-rooms-settings" data-settings hidden><label>Room name<input class="field" data-settings-name maxlength="40"></label><label>Theme<select class="field" data-settings-theme><option value="midnight">Midnight</option><option value="tide">Neon Tide</option><option value="sunset">Sunset Bloom</option><option value="graphite">Graphite</option></select></label><label class="idk-rooms-check"><input type="checkbox" data-settings-readonly> Guests can view, but not write</label><button class="btn" data-save-settings>Apply changes</button></section></div><section class="idk-rooms-members"><div class="idk-rooms-section-head"><strong>People here</strong><small data-member-count></small></div><div data-members></div></section></aside><main class="idk-rooms-main"><div class="idk-rooms-toolbar"><strong>Room chat</strong><div class="idk-rooms-actions"><button class="btn tab" data-share-link>Copy invite</button><button class="btn tab" data-call>Call a friend</button><button class="btn tab" data-share-workspace>Share workspace</button></div></div><div class="idk-rooms-messages" data-messages></div><section class="idk-rooms-shared" data-shared hidden><strong><span data-shared-by></span> shared a workspace view.</strong><small data-shared-copy></small><button class="btn" data-apply-share>Apply view locally</button><button class="btn tab" data-dismiss-share>Dismiss</button></section><section class="idk-rooms-share" data-share-panel hidden><div><strong>Share selected workspace details</strong><small>Only the choices you check are sent. Files, passwords, and account data never leave this browser.</small></div><label><input type="checkbox" data-share-apps checked> Open apps</label><label><input type="checkbox" data-share-theme> Theme</label><label><input type="checkbox" data-share-desktop> Virtual desktop</label><button class="btn" data-send-share>Share now</button></section><form class="idk-rooms-compose" data-message><input class="field" name="text" maxlength="2000" placeholder="Message the room..." autocomplete="off"><button class="btn" type="submit">Send</button></form></main></section>`;
    const lobby = root.querySelector('[data-lobby]'), live = root.querySelector('[data-live]'), joinForm = root.querySelector('[data-join]'), lobbyStatus = root.querySelector('[data-lobby-status]'), saved = root.querySelector('[data-saved]'), status = root.querySelector('[data-status]'), messages = root.querySelector('[data-messages]'), members = root.querySelector('[data-members]'), compose = root.querySelector('[data-message]'), sharePanel = root.querySelector('[data-share-panel]'), sharedPanel = root.querySelector('[data-shared]'), settings = root.querySelector('[data-settings]');
    let socket = null, record = null, role = 'member', ownerId = null, memberList = [], shared = null, intentionalClose = false, reconnectTimer = 0, reconnectAttempts = 0;
    const send = payload => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); };
    const isModerator = () => role === 'owner' || role === 'moderator';
    const canWrite = () => !record?.readOnlyGuests || Boolean(userId()) || role === 'owner' || role === 'moderator';
    const canShare = () => !record?.readOnlyGuests || Boolean(userId()) || role === 'owner' || role === 'moderator';
    const setTheme = () => { root.dataset.roomTheme = record?.theme || 'midnight'; };

    function renderSaved() {
      const list = roomList();
      saved.replaceChildren(...(list.length ? list.map(item => { const card = document.createElement('article'); card.className = 'idk-rooms-saved-row'; card.innerHTML = `<div><strong>${esc(item.name || `Room ${item.code}`)}</strong><small>${esc(item.code)} · ${esc(item.theme || 'midnight')}</small></div><div class="idk-rooms-actions"></div>`; const actions = card.querySelector('.idk-rooms-actions'); actions.append(button('Join', () => connect(item), 'btn'), button('Delete', () => { removeRoom(item.code); renderSaved(); }, 'btn tab')); return card; }) : [Object.assign(document.createElement('p'), { className: 'idk-rooms-note', textContent: 'No saved rooms yet.' })]));
    }

    function renderMessages() {
      messages.replaceChildren(...(record?.messages?.length ? record.messages.map(item => { const row = document.createElement('article'); row.className = `idk-room-message${item.userId === userId() ? ' mine' : ''}`; row.innerHTML = `<div><strong>${esc(item.name || 'Guest')}</strong><time>${new Date(item.at || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div><p>${esc(item.text || '')}</p>`; return row; }) : [Object.assign(document.createElement('p'), { className: 'idk-rooms-note', textContent: 'Room messages will appear here.' })]));
      messages.scrollTop = messages.scrollHeight;
    }

    function renderMembers() {
      const me = memberList.find(member => member.id === socket?.peerId); if (me) role = me.role || role;
      root.querySelector('[data-member-count]').textContent = `${memberList.length} present`;
      members.replaceChildren(...(memberList.length ? memberList.map(member => { const row = document.createElement('article'); row.className = 'idk-room-member'; row.innerHTML = `<span class="idk-room-avatar">${esc((member.name || '?').slice(0, 1).toUpperCase())}</span><div><strong>${esc(member.name || 'Guest')}${member.id === ownerId ? ' · Host' : ''}</strong><small>${member.guest ? 'Guest' : member.role || 'Member'}${member.mutedUntil > Date.now() ? ' · muted' : ''}</small></div><div class="idk-rooms-actions"></div>`; const actions = row.querySelector('.idk-rooms-actions'); if (member.userId && member.userId !== userId()) actions.append(button('Call', () => window.IdkCalls?.start?.({ id: member.userId, name: member.name }) || open('calls'), 'btn tab')); if (isModerator() && member.id !== ownerId && member.id !== socket?.peerId) { actions.append(button('Mute', () => send({ type: 'moderation', action: 'mute', targetId: member.id, minutes: 5 }), 'btn tab'), button('Kick', () => send({ type: 'moderation', action: 'kick', targetId: member.id }), 'btn tab'), button('Ban', () => send({ type: 'moderation', action: 'ban', targetId: member.id }), 'btn tab')); if (role === 'owner' && member.role === 'member') actions.append(button('Make mod', () => send({ type: 'moderation', action: 'promote', targetId: member.id }), 'btn tab')); } return row; }) : [Object.assign(document.createElement('p'), { className: 'idk-rooms-note', textContent: 'Waiting for people to join.' })]));
      settings.hidden = role !== 'owner';
    }

    function renderLive() {
      lobby.hidden = true; live.hidden = false; root.querySelector('[data-room-name]').textContent = record.name || `Room ${record.code}`; root.querySelector('[data-room-code]').textContent = record.code; root.querySelector('[data-room-note]').textContent = record.readOnlyGuests ? 'Guest view mode is on.' : 'Members can chat and share selected workspace details.'; root.querySelector('[data-settings-name]').value = record.name || ''; root.querySelector('[data-settings-theme]').value = record.theme || 'midnight'; root.querySelector('[data-settings-readonly]').checked = Boolean(record.readOnlyGuests); renderMessages(); renderMembers(); setTheme();
      const write = canWrite(); compose.querySelector('input').disabled = !write; compose.querySelector('button').disabled = !write; root.querySelector('[data-share-workspace]').disabled = !canShare();
    }

    function closeSocket(permanent = false) { intentionalClose = permanent; clearTimeout(reconnectTimer); reconnectTimer = 0; socket?.close(); socket = null; }
    function handle(data) {
      if (data.type === 'joined') { role = data.role || 'member'; ownerId = data.ownerId; memberList = data.users || []; record.messages = Array.isArray(data.history) ? data.history : []; record.readOnlyGuests = Boolean(data.config?.readOnlyGuests ?? record.readOnlyGuests); record.name = data.config?.name || record.name; record.theme = data.config?.theme || record.theme; saveRoom(record); reconnectAttempts = 0; status.textContent = `Connected as ${role}.`; renderLive(); return; }
      if (data.type === 'presence') { memberList = data.users || []; ownerId = data.ownerId || ownerId; renderMembers(); status.textContent = data.text || 'Room updated.'; return; }
      if (data.type === 'message') { record.messages = [...(record.messages || []), data].slice(-50); renderMessages(); return; }
      if (data.type === 'workspace-share') { shared = data.workspace || {}; const count = (shared.apps || []).length; root.querySelector('[data-shared-by]').textContent = data.name || 'A member'; root.querySelector('[data-shared-copy]').textContent = `${count} app(s)${shared.theme ? ', theme' : ''}${shared.desktop ? ', virtual desktop' : ''} selected. Nothing changes until you apply it.`; sharedPanel.hidden = false; return; }
      if (data.type === 'room-config') { record.name = data.config?.name || record.name; record.theme = data.config?.theme || record.theme; record.readOnlyGuests = Boolean(data.config?.readOnlyGuests); saveRoom(record); renderLive(); return; }
      if (data.type === 'error' || data.type === 'moderation-result' || data.type === 'muted') { status.textContent = data.text || (data.until ? `Muted until ${new Date(data.until).toLocaleTimeString()}.` : 'Room update.'); renderMembers(); return; }
      if (data.type === 'kicked') { closeSocket(true); lobby.hidden = false; live.hidden = true; lobbyStatus.textContent = data.reason || 'You were removed from the room.'; }
    }

    function connect(next) {
      const normalized = String(next.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (!normalized) return;
      closeSocket(true); intentionalClose = false; record = { code: normalized, name: String(next.name || `Room ${normalized}`).slice(0, 40), theme: next.theme || 'midnight', readOnlyGuests: Boolean(next.readOnlyGuests), messages: [], updatedAt: Date.now() }; saveRoom(record); renderLive(); status.textContent = 'Connecting...';
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws'; const currentCode = normalized; socket = new WebSocket(`${protocol}://${location.host}/chat`); socket.onopen = () => { send({ type: 'join', room: record.code, name: userName(), guestMode: !userId(), roomConfig: next.owner ? { name: record.name, theme: record.theme, readOnlyGuests: record.readOnlyGuests } : undefined }); }; socket.onmessage = event => { try { handle(JSON.parse(event.data)); } catch {} }; socket.onclose = () => { if (record?.code !== currentCode || intentionalClose) return; status.textContent = 'Room disconnected. Reconnecting...'; if (reconnectAttempts < 5) { reconnectAttempts += 1; reconnectTimer = setTimeout(() => connect({ ...record, owner: false }), reconnectAttempts * 1200); } else status.textContent = 'Room disconnected. Reopen to reconnect.'; };
    }

    joinForm.onsubmit = event => { event.preventDefault(); const form = event.currentTarget; const enteredCode = form.code.value.trim(); connect({ code: enteredCode || code(), name: form.name.value.trim() || 'IDK Room', theme: form.theme.value, readOnlyGuests: form.readonly.checked, owner: !enteredCode }); };
    root.querySelector('[data-new]').onclick = () => { joinForm.reset(); joinForm.code.value = ''; joinForm.name.value = 'Focus Room'; joinForm.querySelector('[name=name]').focus(); };
    root.querySelector('[data-share-link]').onclick = async () => { const link = `${location.origin}${location.pathname}#room=${record.code}`; try { await navigator.clipboard.writeText(link); status.textContent = 'Invite link copied.'; } catch { window.prompt('Copy this room invite', link); } };
    root.querySelector('[data-call]').onclick = () => { const target = memberList.find(item => item.userId && item.userId !== userId()); if (target) window.IdkCalls?.start?.({ id: target.userId, name: target.name }); else open('calls'); };
    root.querySelector('[data-share-workspace]').onclick = () => { if (canShare()) sharePanel.hidden = !sharePanel.hidden; };
    root.querySelector('[data-send-share]').onclick = () => { const workspace = {}; if (root.querySelector('[data-share-apps]').checked) workspace.apps = [...document.querySelectorAll('#windows .window[data-app]:not(.minimized)')].map(win => win.dataset.app).filter(Boolean).slice(0, 12); if (root.querySelector('[data-share-theme]').checked) workspace.theme = read('theme', 'midnight'); if (root.querySelector('[data-share-desktop]').checked) workspace.desktop = localStorage.getItem('idkActiveVirtualDesktop') || 'desktop-1'; if (!Object.keys(workspace).length) return; send({ type: 'workspace-share', workspace }); status.textContent = 'Selected workspace details shared.'; sharePanel.hidden = true; };
    root.querySelector('[data-apply-share]').onclick = () => { if (!shared) return; if (shared.theme && typeof applyTheme === 'function') applyTheme(shared.theme); if (shared.desktop && window.IDKEcosystem?.showDesktop) window.IDKEcosystem.showDesktop(shared.desktop); (shared.apps || []).forEach((app, index) => setTimeout(() => open(app), index * 100)); notify('IDK Rooms', 'Shared workspace applied locally.', 'success'); sharedPanel.hidden = true; };
    root.querySelector('[data-dismiss-share]').onclick = () => { shared = null; sharedPanel.hidden = true; };
    root.querySelector('[data-settings-toggle]').onclick = () => { if (role === 'owner') settings.hidden = !settings.hidden; };
    root.querySelector('[data-save-settings]').onclick = () => { if (role !== 'owner') return; record.name = root.querySelector('[data-settings-name]').value.trim() || record.name; record.theme = root.querySelector('[data-settings-theme]').value; record.readOnlyGuests = root.querySelector('[data-settings-readonly]').checked; saveRoom(record); send({ type: 'room-config', config: { name: record.name, theme: record.theme, readOnlyGuests: record.readOnlyGuests } }); settings.hidden = true; notify('IDK Rooms', 'Room settings saved for future visits.', 'success'); };
    root.querySelector('[data-leave]').onclick = () => { closeSocket(true); record = null; live.hidden = true; lobby.hidden = false; status.textContent = 'Not connected'; renderSaved(); };
    compose.onsubmit = event => { event.preventDefault(); const input = compose.querySelector('input'); const text = input.value.trim(); if (!text || !canWrite()) return; send({ type: 'message', text }); input.value = ''; };
    renderSaved();
    const hash = location.hash.match(/^#room=([A-Za-z0-9]+)/); if (options.roomCode || hash) connect(roomList().find(item => item.code === (options.roomCode || hash[1]).toUpperCase()) || { code: options.roomCode || hash[1], name: 'Invited Room', owner: false });
    root.cleanup = () => closeSocket(true);
    return root;
  }

  function install() {
    if (typeof APPS !== 'undefined') APPS.rooms ||= { title: 'IDK Rooms', glyph: '◌', desktop: true, dock: false, width: 1040, height: 740, render: roomApp };
    else return setTimeout(install, 250);
    const hash = location.hash.match(/^#room=([A-Za-z0-9]+)/); if (hash) setTimeout(() => open('rooms', { roomCode: hash[1].toUpperCase() }), 300);
  }

  window.IDKRooms = { open: options => open('rooms', options), create: () => open('rooms', {}), saved: roomList };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

(() => {
  'use strict';
  if (window.IDKBatchFifteen) return;

  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const button = (label, action, className = 'btn') => { const node = document.createElement('button'); node.type = 'button'; node.className = className; node.textContent = label; node.onclick = action; return node; };
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const defaultPrefs = { dnd: false, quietStart: '22:00', quietEnd: '08:00', calls: true, messages: true, friends: true, system: true };
  const prefs = () => ({ ...defaultPrefs, ...read('idkNotificationPrefs', {}) });
  const inQuietHours = state => { if (!state.dnd || !state.quietStart || !state.quietEnd) return false; const now = new Date().toTimeString().slice(0, 5); return state.quietStart <= state.quietEnd ? now >= state.quietStart && now < state.quietEnd : now >= state.quietStart || now < state.quietEnd; };
  const category = title => /call/i.test(title) ? 'calls' : /message|mention|chat/i.test(title) ? 'messages' : /friend|request/i.test(title) ? 'friends' : 'system';

  function installNotificationGuard() {
    const original = window.OS?.notify;
    if (!original || original.__idkBatchFifteen) return;
    const wrapped = (title, message, kind = 'info') => { const state = prefs(); const type = category(title); if (inQuietHours(state) && kind !== 'danger') return; if (state[type] === false && kind !== 'danger') return; return original.call(window.OS, title, message, kind); };
    wrapped.__idkBatchFifteen = true; window.OS.notify = wrapped;
  }

  function notificationSettingsApp() {
    const state = prefs(); const root = document.createElement('div'); root.className = 'app idk-notification-settings';
    root.innerHTML = '<header class="idk-control-head"><div><span class="idk-flow-kicker">IDK NOTIFICATIONS</span><h2>Notification controls</h2><p>Choose what can interrupt you. Notifications remain in this browser and sync with your account when signed in.</p></div><span class="idk-control-badge">YOUR DEVICE</span></header><div class="idk-notification-settings-grid"><label class="idk-check-row"><input type="checkbox" data-dnd> Do Not Disturb</label><label>Quiet hours start<input class="field" type="time" data-start></label><label>Quiet hours end<input class="field" type="time" data-end></label><label class="idk-check-row"><input type="checkbox" data-key="calls"> Calls</label><label class="idk-check-row"><input type="checkbox" data-key="messages"> Messages and mentions</label><label class="idk-check-row"><input type="checkbox" data-key="friends"> Friend requests</label><label class="idk-check-row"><input type="checkbox" data-key="system"> System updates</label></div><p class="idk-control-status" data-status></p><div class="idk-flow-actions"><button class="btn" data-save>Save notification settings</button><button class="btn tab" data-clear>Clear notification center</button></div>';
    root.querySelector('[data-dnd]').checked = state.dnd; root.querySelector('[data-start]').value = state.quietStart; root.querySelector('[data-end]').value = state.quietEnd; root.querySelectorAll('[data-key]').forEach(input => { input.checked = state[input.dataset.key] !== false; });
    root.querySelector('[data-save]').onclick = () => { const next = { dnd: root.querySelector('[data-dnd]').checked, quietStart: root.querySelector('[data-start]').value, quietEnd: root.querySelector('[data-end]').value }; root.querySelectorAll('[data-key]').forEach(input => { next[input.dataset.key] = input.checked; }); write('idkNotificationPrefs', next); window.IDKAccount?.sync?.(); root.querySelector('[data-status]').textContent = 'Notification preferences saved on this device.'; notify('Notifications', 'Your notification preferences were saved.', 'success'); };
    root.querySelector('[data-clear]').onclick = () => { document.getElementById('notifications-clear')?.click(); root.querySelector('[data-status]').textContent = 'Notification center cleared.'; };
    return root;
  }

  let backgroundSocket = null, backgroundRetry = 0, backgroundTimer = 0;
  function stopBackgroundCalls() { clearTimeout(backgroundTimer); backgroundSocket?.close(); backgroundSocket = null; backgroundRetry = 0; }
  function incomingBanner(invite) {
    document.getElementById('idk-incoming-call-banner')?.remove();
    const banner = document.createElement('section'); banner.id = 'idk-incoming-call-banner'; banner.setAttribute('role', 'alert'); banner.innerHTML = `<strong>${esc(invite.fromName || 'A friend')} is calling</strong><small>Incoming IDK voice call</small><div><button type="button" data-answer>Open Calls</button><button type="button" data-dismiss>Dismiss</button></div>`;
    banner.querySelector('[data-answer]').onclick = () => { banner.remove(); window.IdkCalls?.open?.(); };
    banner.querySelector('[data-dismiss]').onclick = () => { if (backgroundSocket?.readyState === WebSocket.OPEN) backgroundSocket.send(JSON.stringify({ type: 'call', action: 'reject', callId: invite.callId, targetUserId: invite.fromUserId })); const items = read('idkCallHistory', []); write('idkCallHistory', [{ name: invite.fromName || 'Friend', missed: true, direction: 'incoming', at: Date.now() }, ...items].slice(0, 20)); window.IDKAccount?.sync?.(); localStorage.removeItem('idkPendingCall'); banner.remove(); };
    document.body.append(banner);
  }
  function startBackgroundCalls() {
    if (backgroundSocket || document.querySelector('.idk-calls-app') || !window.IDKAccount?.user || !navigator.onLine) return;
    const profile = read('idkMessengerProfile', {}), protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    try { backgroundSocket = new WebSocket(`${protocol}://${location.host}/chat`); backgroundSocket.onopen = () => { backgroundRetry = 0; backgroundSocket.send(JSON.stringify({ type: 'join', name: window.IDKAccount.user.username, room: profile.room || 'general' })); }; backgroundSocket.onmessage = event => { let data; try { data = JSON.parse(event.data); } catch { return; } if (data.type !== 'call' || data.action !== 'invite') return; write('idkPendingCall', data); window.IDKPendingCallInvite = data; incomingBanner(data); notify('Incoming IDK call', `${data.fromName || 'A friend'} is calling you.`, 'success'); window.dispatchEvent(new CustomEvent('idk-background-call', { detail: data })); }; backgroundSocket.onclose = () => { backgroundSocket = null; if (!document.querySelector('.idk-calls-app') && window.IDKAccount?.user && backgroundRetry < 3) { backgroundRetry += 1; backgroundTimer = setTimeout(startBackgroundCalls, backgroundRetry * 1500); } }; backgroundSocket.onerror = () => {}; } catch { backgroundSocket = null; }
  }
  function syncBackgroundCalls() { if (document.querySelector('.idk-calls-app')) stopBackgroundCalls(); else startBackgroundCalls(); }

  function recentChats(root) {
    const members = root.querySelector('.idk-live-members'); if (!members || members.querySelector('[data-idk-recent-inbox]')) return;
    let activeTarget = null;
    const section = document.createElement('section'); section.dataset.idkRecentInbox = 'true'; section.className = 'idk-recent-inbox'; section.innerHTML = '<div class="idk-recent-head"><strong>Recent chats</strong><button type="button" data-refresh aria-label="Refresh recent chats">↻</button></div><input class="field" data-recent-search placeholder="Search conversations" aria-label="Search conversations"><div data-recent-list></div>';
    members.prepend(section); const list = section.querySelector('[data-recent-list]'), search = section.querySelector('[data-recent-search]');
    const render = () => { const query = search.value.trim().toLowerCase(), items = read('idkMessengerRecents', []).filter(item => !query || `${item.name} ${item.last}`.toLowerCase().includes(query)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.at || 0) - (a.at || 0)); list.replaceChildren(...(items.length ? items.slice(0, 12).map(item => { const row = document.createElement('div'); row.className = 'idk-recent-row'; row.innerHTML = `<button type="button" data-open><span class="idk-recent-avatar">${esc((item.name || '?').slice(0, 1).toUpperCase())}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.last || 'Open conversation')}${item.unread ? ` · ${item.unread} new` : ''}</small></span></button><button type="button" data-pin aria-label="${item.pinned ? 'Unpin' : 'Pin'} conversation">${item.pinned ? '★' : '☆'}</button>`; row.querySelector('[data-open]').onclick = () => { item.unread = 0; write('idkMessengerRecents', items); window.IdkMessenger?.selectUser?.({ userId: item.userId, username: item.name }); render(); }; row.querySelector('[data-pin]').onclick = () => { item.pinned = !item.pinned; write('idkMessengerRecents', items); render(); }; return row; }) : [Object.assign(document.createElement('p'), { className: 'idk-control-status', textContent: 'Your recent conversations will appear here.' })])); };
    const saveTarget = target => { if (!target?.userId) return; activeTarget = target; const items = read('idkMessengerRecents', []), found = items.find(item => item.userId === target.userId); if (!found) items.unshift({ userId: target.userId, name: target.name || 'Friend', last: '', at: Date.now(), unread: 0, pinned: false }); else { found.name = target.name || found.name; found.at = Date.now(); } write('idkMessengerRecents', items.slice(0, 40)); render(); };
    window.addEventListener('idk-messenger-target', event => { saveTarget(event.detail); if (event.detail) activeTarget = event.detail; });
    window.addEventListener('idk-messenger-message', event => { const item = event.detail; if (!item?.private || !item.userId) return; const items = read('idkMessengerRecents', []), found = items.find(value => value.userId === item.peerUserId || value.userId === activeTarget?.userId); if (!found) return; found.last = item.text || 'Attachment'; found.at = Date.now(); if (!item.mine && activeTarget?.userId !== found.userId) found.unread = (found.unread || 0) + 1; write('idkMessengerRecents', items); render(); });
    search.oninput = render; section.querySelector('[data-refresh]').onclick = render; render();
  }

  function enhanceCallRows(root) {
    root.querySelectorAll('.idk-call-friend[data-friend-id]').forEach(row => { if (row.querySelector('[data-call-safety]')) return; const actions = document.createElement('span'); actions.className = 'idk-call-safety'; const block = button('Block', async () => { const response = await fetch(`/api/friends/${encodeURIComponent(row.dataset.friendId)}/block`, { method: 'POST', credentials: 'same-origin' }).then(value => value.json()).catch(() => ({ ok: false })); if (response.ok) { row.remove(); notify('Friends', 'That friend is blocked from calls and friend lists.', 'success'); } else notify('Friends', response.error || 'Could not block that friend.', 'warning'); }, 'btn tab'); const report = button('Report', async () => { const reason = prompt('Why are you reporting this friend?')?.trim(); if (!reason) return; const response = await fetch(`/api/friends/${encodeURIComponent(row.dataset.friendId)}/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ reason }) }).then(value => value.json()).catch(() => ({ ok: false })); notify('Friends', response.ok ? 'Report submitted.' : (response.error || 'Could not submit the report.'), response.ok ? 'success' : 'warning'); }, 'btn tab'); block.dataset.callSafety = 'true'; report.dataset.callSafety = 'true'; actions.append(block, report); row.append(actions); });
  }

  function install() {
    installNotificationGuard();
    if (typeof APPS !== 'undefined') APPS.notificationSettings ||= { title: 'Notification Settings', glyph: '🔔', desktop: false, dock: false, width: 680, height: 570, render: notificationSettingsApp };
    const observer = new MutationObserver(() => { document.querySelectorAll('.idk-live-messenger').forEach(recentChats); document.querySelectorAll('.idk-calls-app').forEach(enhanceCallRows); syncBackgroundCalls(); }); observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('idk-account-restored', () => setTimeout(syncBackgroundCalls, 250)); window.addEventListener('online', syncBackgroundCalls); window.addEventListener('offline', stopBackgroundCalls); syncBackgroundCalls();
    setTimeout(() => document.querySelectorAll('.idk-live-messenger').forEach(recentChats), 500);
  }
  window.IDKBatchFifteen = { notificationSettingsApp, startBackgroundCalls, stopBackgroundCalls, recentChats };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

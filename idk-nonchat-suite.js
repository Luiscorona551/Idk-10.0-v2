(() => {
  'use strict';
  if (window.IDKNonChatSuite) return;

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const button = (label, action, className = 'btn') => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = className;
    item.textContent = label;
    item.addEventListener('click', action);
    return item;
  };

  const open = (id, options = {}) => {
    if (id === 'sheets') return window.IDKSheets?.open?.();
    if (typeof APPS !== 'undefined' && APPS[id]) return window.OS?.open?.(id, options);
    notify('IDK', `${id} is not available in this build.`, 'warning');
  };
  const list = key => {
    const items = read(key, []);
    return Array.isArray(items) ? items : [];
  };
  const files = () => list('idkFileSystem');
  const queueSize = () => list('idkOfflineQueue').length + list('idkCloudSyncQueue').length;
  const app = (id, title, glyph, detail, action = () => open(id)) => ({ id, title, glyph, detail, action });
  const PRESENCE_KEY = 'idkPresence';
  const FOCUS_KEY = 'idkFocusModeState';
  const VERSION_KEY = 'idkFileVersions';
  const EXTENSION_KEY = 'idkEnabledExtensions';

  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const dateOnly = value => {
    const date = new Date(`${value || today()}T12:00:00`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  };
  const profileName = () => window.IDKAccount?.user?.username || read('idkProfile', {}).displayName || read('idkMessengerProfile', {}).name || window.IDKConnectivitySuite?.activeProfile?.()?.name || 'Guest';
  const presenceState = () => ({ status: 'online', message: '', updatedAt: 0, ...read(PRESENCE_KEY, {}) });
  const presenceLabel = value => ({ online: 'Online', away: 'Away', busy: 'Busy', offline: 'Offline' }[value] || 'Online');

  function setPresence(next = {}) {
    const value = { ...presenceState(), ...next, status: ['online', 'away', 'busy', 'offline'].includes(next.status) ? next.status : presenceState().status, message: String(next.message ?? presenceState().message).trim().slice(0, 120), updatedAt: Date.now() };
    try { localStorage.setItem(PRESENCE_KEY, JSON.stringify(value)); } catch {}
    window.dispatchEvent(new CustomEvent('idk-presence-changed', { detail: value }));
    return value;
  }

  function occurrenceDue(item, dateField, now) {
    const dateValue = item?.[dateField];
    if (!dateValue) return false;
    const base = dateOnly(dateValue), current = dateOnly(today());
    if (base > current) return false;
    const repeat = item.repeat || 'none';
    const days = Math.floor((current - base) / 86400000);
    const matches = repeat === 'daily' || (repeat === 'weekly' && days % 7 === 0) || (repeat === 'monthly' && current.getDate() === base.getDate()) || (repeat === 'none' && dateValue === today());
    if (!matches) return false;
    if (item.time && dateValue === today()) {
      const parts = String(item.time).split(':').map(Number);
      if (parts.length === 2 && (now.getHours() < parts[0] || (now.getHours() === parts[0] && now.getMinutes() < parts[1]))) return false;
    }
    return true;
  }

  function checkReminders() {
    const now = new Date(), delivered = read('idkReminderDelivery', {}), next = {};
    Object.entries(delivered || {}).forEach(([key, value]) => { if (Date.now() - Number(value) < 1209600000) next[key] = value; });
    const items = [
      ...list('idkTodos').filter(item => !item.done).map(item => ({ ...item, title: item.text, field: 'due', kind: 'Task' })),
      ...list('idkCalendarEvents').map(item => ({ ...item, field: 'date', kind: 'Reminder' }))
    ];
    items.filter(item => occurrenceDue(item, item.field, now)).forEach(item => {
      const key = `${item.id || item.title}:${today()}:${item.time || ''}`;
      if (next[key]) return;
      next[key] = Date.now();
      const message = `${item.title || 'Scheduled item'}${item.time ? ` · ${item.time}` : ''}`;
      notify(`${item.kind} due`, message, 'success');
      window.IDKBatchSixteen?.browserNotify?.(`${item.kind} due`, message, 'info');
    });
    try { localStorage.setItem('idkReminderDelivery', JSON.stringify(next)); } catch {}
  }

  function installReminderScheduler() {
    checkReminders();
    window.setInterval(checkReminders, 30000);
    window.addEventListener('idk-data-changed', checkReminders);
    window.addEventListener('visibilitychange', checkReminders);
  }

  const focusState = () => ({ enabled: false, mode: 'deep', endsAt: 0, apps: ['notes', 'planner'], ...read(FOCUS_KEY, {}) });
  function setFocus(next = {}) {
    const current = focusState(), enabled = Boolean(next.enabled ?? current.enabled), endsAt = enabled ? Number(next.endsAt || current.endsAt || Date.now() + 50 * 60000) : 0;
    const value = { ...current, ...next, enabled, endsAt, apps: Array.isArray(next.apps || current.apps) ? [...new Set(next.apps || current.apps)].slice(0, 6) : current.apps };
    try { localStorage.setItem(FOCUS_KEY, JSON.stringify(value)); } catch {}
    if (enabled) setPresence({ status: 'busy', message: `Focused · ${value.mode}` });
    else if (presenceState().message.startsWith('Focused')) setPresence({ status: 'online', message: '' });
    window.dispatchEvent(new CustomEvent('idk-focus-changed', { detail: value }));
    return value;
  }
  function startFocus(minutes = 50, mode = 'deep', apps = focusState().apps) {
    const value = setFocus({ enabled: true, mode, apps, endsAt: Date.now() + Math.max(5, Number(minutes) || 50) * 60000 });
    value.apps.forEach((id, index) => setTimeout(() => open(id), index * 180));
    notify('Focus Mode', `${presenceLabel('busy')} for ${Math.round((value.endsAt - Date.now()) / 60000)} minutes.`, 'success');
    return value;
  }
  function tickFocus() { const current = focusState(); if (current.enabled && current.endsAt && current.endsAt <= Date.now()) { setFocus({ enabled: false }); notify('Focus Mode', 'Your focus session is complete.', 'success'); } }
  function installFocusScheduler() { tickFocus(); window.setInterval(tickFocus, 30000); window.addEventListener('visibilitychange', tickFocus); }

  function notificationCenterApp() {
    const root = document.createElement('div'); root.className = 'app idk-notification-center';
    root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK INBOX</span><h2>Notifications Center</h2><p>System updates, reminders, messages, and workspace activity in one place.</p></div><span class="idk-nonchat-badge" data-count></span></header><div class="idk-notification-toolbar"><button class="btn tab" data-refresh>Refresh</button><button class="btn tab" data-clear>Clear history</button><button class="btn" data-settings>Notification settings</button></div><div class="idk-notification-list" data-list></div>';
    const listNode = root.querySelector('[data-list]');
    const render = () => { const items = window.OS?.getActivityHistory?.() || []; root.querySelector('[data-count]').textContent = `${items.length} saved`; listNode.replaceChildren(...(items.length ? items.map(item => { const row = document.createElement('article'); row.className = `idk-notification-row ${esc(item.kind || 'info')}`; row.innerHTML = `<div><strong>${esc(item.title)}</strong><p>${esc(item.message)}</p></div><time>${new Date(item.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>`; return row; }) : [Object.assign(document.createElement('p'), { className: 'idk-nonchat-empty', textContent: 'You are all caught up.' })])); };
    root.querySelector('[data-refresh]').onclick = render; root.querySelector('[data-clear]').onclick = () => { window.OS?.clearActivity?.(); render(); notify('Notifications', 'Notification history cleared.', 'success'); }; root.querySelector('[data-settings]').onclick = () => open('settings'); window.addEventListener('idk-activity', render); root.cleanup = () => window.removeEventListener('idk-activity', render); render(); return root;
  }

  function dailyBriefApp() {
    const root = document.createElement('div'); root.className = 'app idk-daily-brief';
    root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK MORNING DESK</span><h2>Daily Brief</h2><p>A short, useful summary of what deserves your attention today.</p></div><span class="idk-nonchat-badge" data-date></span></header><div class="idk-brief-grid" data-grid></div><div class="idk-nonchat-actions"><button class="btn" data-focus>Start Focus Mode</button><button class="btn tab" data-today>Open Today</button><button class="btn tab" data-review>End-of-Day Review</button><button class="btn tab" data-notifications>Notifications</button></div>';
    const grid = root.querySelector('[data-grid]');
    const render = () => { const tasks = list('idkTodos').filter(item => !item.done), due = tasks.filter(item => item.due && item.due <= today()), events = list('idkCalendarEvents').filter(item => item.date === today()), notes = list('idkRichNotes').filter(item => !item.trashed).slice(0, 3), activity = window.OS?.getActivityHistory?.() || []; root.querySelector('[data-date]').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }); const item = (title, value, detail, action) => { const node = document.createElement('article'); node.className = 'idk-brief-card'; node.innerHTML = `<strong>${esc(value)}</strong><span>${esc(title)}</span><small>${esc(detail)}</small>`; if (action) node.append(button('Open', action, 'btn tab')); return node; }; grid.replaceChildren(item('Open tasks', tasks.length, due.length ? `${due.length} due or overdue` : 'Nothing due today', () => open('planner')), item('Today’s reminders', events.length, events.length ? events.map(value => value.title).slice(0, 2).join(' · ') : 'Your calendar is clear', () => open('calendar')), item('Unread activity', activity.length, activity[0]?.title || 'No recent alerts', () => open('notificationCenter')), item('Recent notes', notes.length, notes[0]?.title || 'No notes waiting', () => open('notes'))); };
    root.querySelector('[data-focus]').onclick = () => startFocus(50, 'deep'); root.querySelector('[data-today]').onclick = () => open(typeof APPS !== 'undefined' && APPS.today ? 'today' : 'planner'); root.querySelector('[data-review]').onclick = () => open('endOfDay'); root.querySelector('[data-notifications]').onclick = () => open('notificationCenter'); window.addEventListener('idk-data-changed', render); window.addEventListener('idk-activity', render); root.cleanup = () => { window.removeEventListener('idk-data-changed', render); window.removeEventListener('idk-activity', render); }; render(); return root;
  }

  function endOfDayApp() {
    const root = document.createElement('div'); root.className = 'app idk-end-of-day';
    root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK DAILY CLOSE</span><h2>End-of-Day Review</h2><p>Close the loop on today, keep unfinished work visible, and begin tomorrow with a clean plan.</p></div><span class="idk-nonchat-badge" data-date></span></header><div class="idk-brief-grid" data-grid></div><div class="idk-end-of-day-sections" data-sections></div><div class="idk-nonchat-actions"><button class="btn" data-focus>Focus unfinished work</button><button class="btn tab" data-planner>Open Planner</button><button class="btn tab" data-review>Mark day reviewed</button></div><p class="idk-nonchat-status" data-status></p>';
    const grid = root.querySelector('[data-grid]'), sections = root.querySelector('[data-sections]'), status = root.querySelector('[data-status]');
    const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
    const render = () => { const completed = list('idkTodos').filter(item => item.done && item.completed && today() === new Date(item.completed).toISOString().slice(0, 10)), unfinished = list('idkTodos').filter(item => !item.done), tomorrowEvents = list('idkCalendarEvents').filter(item => item.date === tomorrow()), activity = window.OS?.getActivityHistory?.() || [], reviewed = read('idkDayReviews', {})[today()]; root.querySelector('[data-date]').textContent = reviewed ? 'REVIEWED' : new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }); const card = (title, value, detail) => { const node = document.createElement('article'); node.className = 'idk-brief-card'; node.innerHTML = `<strong>${esc(value)}</strong><span>${esc(title)}</span><small>${esc(detail)}</small>`; return node; }; grid.replaceChildren(card('Completed today', completed.length, completed.length ? 'Good work. Keep the momentum.' : 'No completed tasks recorded yet.'), card('Still open', unfinished.length, unfinished.length ? 'Choose what carries forward.' : 'Nothing left on your list.'), card('Tomorrow', tomorrowEvents.length, tomorrowEvents.length ? tomorrowEvents.map(item => item.title).slice(0, 2).join(' · ') : 'No reminders scheduled.'), card('Activity', activity.length, activity[0]?.title || 'No recent activity.')); const section = (title, items, empty, format) => { const node = document.createElement('section'); node.className = 'idk-end-of-day-section'; node.innerHTML = `<header><strong>${esc(title)}</strong><small>${items.length} item${items.length === 1 ? '' : 's'}</small></header><div data-list></div>`; const listNode = node.querySelector('[data-list]'); listNode.replaceChildren(...(items.slice(0, 6).map(item => Object.assign(document.createElement('p'), { className: 'idk-end-of-day-row', textContent: format(item) })) || [Object.assign(document.createElement('p'), { className: 'idk-nonchat-empty', textContent: empty })])); if (!items.length) listNode.append(Object.assign(document.createElement('p'), { className: 'idk-nonchat-empty', textContent: empty })); return node; }; sections.replaceChildren(section('Completed', completed, 'Nothing completed today yet.', item => item.text), section('Carry forward', unfinished, 'You are all caught up.', item => `${item.text}${item.due ? ` · due ${item.due}` : ''}`), section('Tomorrow’s reminders', tomorrowEvents, 'Tomorrow is clear.', item => `${item.title}${item.time ? ` · ${item.time}` : ''}`)); status.textContent = reviewed ? `Reviewed today at ${new Date(reviewed).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : 'Reviewing is local and can be changed any time.'; };
    root.querySelector('[data-focus]').onclick = () => startFocus(50, 'deep', ['planner']); root.querySelector('[data-planner]').onclick = () => open('planner'); root.querySelector('[data-review]').onclick = () => { const reviews = read('idkDayReviews', {}); reviews[today()] = Date.now(); localStorage.setItem('idkDayReviews', JSON.stringify(reviews)); render(); notify('Daily Review', 'Today was marked as reviewed.', 'success'); }; window.addEventListener('idk-data-changed', render); window.addEventListener('idk-activity', render); root.cleanup = () => { window.removeEventListener('idk-data-changed', render); window.removeEventListener('idk-activity', render); }; render(); return root;
  }

  function focusModeApp() {
    const current = focusState(), root = document.createElement('div'); root.className = 'app idk-focus-mode';
    root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK FOCUS</span><h2>Focus Mode</h2><p>Quiet the desktop, set your presence to busy, and keep the work that matters in view.</p></div><span class="idk-nonchat-badge" data-state></span></header><div class="idk-focus-timer" data-timer></div><div class="idk-focus-form"><label>Session<select class="field" data-minutes><option value="25">25 minutes</option><option value="50">50 minutes</option><option value="90">90 minutes</option><option value="120">2 hours</option></select></label><label>Mode<select class="field" data-mode><option value="deep">Deep work</option><option value="study">Study</option><option value="creative">Creative</option><option value="private">Private session</option></select></label></div><div class="idk-focus-apps"><strong>Open with focus</strong><label><input type="checkbox" value="notes" checked> Notes</label><label><input type="checkbox" value="planner" checked> Planner</label><label><input type="checkbox" value="dashboard"> Dashboard</label><label><input type="checkbox" value="timer"> Timer</label></div><div class="idk-nonchat-actions"><button class="btn" data-start>Start focus</button><button class="btn tab" data-end>End session</button></div><p class="idk-nonchat-status" data-status></p>';
    const timer = root.querySelector('[data-timer]'), stateBadge = root.querySelector('[data-state]'), status = root.querySelector('[data-status]');
    const render = () => { const value = focusState(), remaining = Math.max(0, value.endsAt - Date.now()); stateBadge.textContent = value.enabled ? 'ACTIVE' : 'READY'; timer.textContent = value.enabled ? `${String(Math.floor(remaining / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}` : '00:00'; status.textContent = value.enabled ? `Presence is busy · ${value.mode} · ends ${new Date(value.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Start a session when you want fewer distractions.'; };
    root.querySelector('[data-start]').onclick = () => { const apps = [...root.querySelectorAll('.idk-focus-apps input:checked')].map(item => item.value); startFocus(Number(root.querySelector('[data-minutes]').value), root.querySelector('[data-mode]').value, apps); render(); }; root.querySelector('[data-end]').onclick = () => { setFocus({ enabled: false }); render(); }; window.addEventListener('idk-focus-changed', render); const interval = window.setInterval(render, 1000); root.cleanup = () => { clearInterval(interval); window.removeEventListener('idk-focus-changed', render); }; render(); return root;
  }

  function briefDataUrl(data) { const bytes = new Uint8Array(data), chunk = 0x8000; let binary = ''; for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk)); return btoa(binary); }
  function bytesFromBase64(value) { const binary = atob(value || ''); return Uint8Array.from(binary, char => char.charCodeAt(0)); }
  async function fileContents(entry) { if (entry.storage === 'indexeddb' && window.SYSTEM_APPS?.readBlob) { const blob = await window.SYSTEM_APPS.readBlob(entry); if (!blob) return null; const bytes = new Uint8Array(await blob.arrayBuffer()); return { value: entry.text ? await blob.text() : briefDataUrl(bytes), encoding: entry.text ? 'text' : 'base64', size: bytes.length }; } return { value: String(entry.content || ''), encoding: 'text', size: Number(entry.size || 0) }; }
  async function snapshotFile(entry) { const content = await fileContents(entry); if (!content || content.size > 450000) throw new Error('This file is too large for local version history.'); const versions = read(VERSION_KEY, []), version = { id: `version-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, fileId: entry.id, name: entry.name, parent: entry.parent || '', mime: entry.mime || 'text/plain', ...content, at: Date.now() }; versions.unshift(version); try { localStorage.setItem(VERSION_KEY, JSON.stringify(versions.slice(0, 120))); } catch { throw new Error('Local storage is full. Export a backup or remove old versions.'); } return version; }
  async function restoreVersion(version) { if (version.encoding === 'text') return window.SYSTEM_APPS?.writeTextFile?.(version.name, version.value, version.parent, version.mime); return window.SYSTEM_APPS?.writeBlobFile?.(version.name, new Blob([bytesFromBase64(version.value)], { type: version.mime }), version.parent, version.mime, version.fileId); }
  function versionHistoryApp(options = {}) {
    const root = document.createElement('div'); root.className = 'app idk-version-history'; root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK FILES</span><h2>Version History</h2><p>Save local checkpoints and restore an earlier copy of a file without leaving IDK.</p></div><span class="idk-nonchat-badge" data-count></span></header><div class="idk-version-layout"><section><label class="idk-version-label">File<select class="field" data-file></select></label><div class="idk-version-actions"><button class="btn" data-snapshot>Save current version</button><button class="btn tab" data-open>Open Files</button></div><p class="idk-nonchat-status" data-status></p></section><section><div class="idk-version-list" data-list></div></section></div>';
    const select = root.querySelector('[data-file]'), listNode = root.querySelector('[data-list]'), status = root.querySelector('[data-status]');
    const renderFiles = () => { const entries = files().filter(item => item.type === 'file'); select.replaceChildren(...entries.map(item => Object.assign(document.createElement('option'), { value: item.id, textContent: item.name }))); if (options.fileId && entries.some(item => item.id === options.fileId)) select.value = options.fileId; root.querySelector('[data-count]').textContent = `${read(VERSION_KEY, []).length} saved`; renderVersions(); };
    const renderVersions = () => { const id = select.value, items = read(VERSION_KEY, []).filter(item => item.fileId === id); listNode.replaceChildren(...(items.length ? items.map(item => { const row = document.createElement('article'); row.className = 'idk-version-row'; row.innerHTML = `<div><strong>${esc(item.name)}</strong><small>${new Date(item.at).toLocaleString()} · ${Math.round(item.size / 1024)} KB</small></div><div class="idk-versions-actions"></div>`; row.querySelector('.idk-versions-actions').append(button('Restore', async () => { try { await restoreVersion(item); status.textContent = 'Version restored to Files.'; notify('Version History', `${item.name} was restored.`, 'success'); } catch (error) { status.textContent = error.message; } }, 'btn'), button('Delete', () => { localStorage.setItem(VERSION_KEY, JSON.stringify(read(VERSION_KEY, []).filter(value => value.id !== item.id))); renderFiles(); }, 'btn tab')); return row; }) : [Object.assign(document.createElement('p'), { className: 'idk-nonchat-empty', textContent: select.value ? 'No versions saved for this file yet.' : 'Import or create a file first.' })])); };
    select.onchange = renderVersions; root.querySelector('[data-snapshot]').onclick = async () => { const entry = files().find(item => item.id === select.value); if (!entry) return; try { await snapshotFile(entry); status.textContent = 'Current file saved as a new version.'; notify('Version History', `Saved ${entry.name}.`, 'success'); renderFiles(); } catch (error) { status.textContent = error.message; } }; root.querySelector('[data-open]').onclick = () => open('files'); window.addEventListener('idk-data-changed', renderFiles); root.cleanup = () => window.removeEventListener('idk-data-changed', renderFiles); renderFiles(); return root;
  }

  function wrapApp(id, enhance) {
    const target = typeof APPS !== 'undefined' && APPS[id];
    if (!target?.render || target.render.__idkEnhanced) return;
    const render = target.render;
    const wrapped = options => { const root = render(options); return enhance(root, options) || root; };
    wrapped.__idkEnhanced = true;
    target.render = wrapped;
  }
  function enhanceDailyApp(root, kind) {
    const host = root?.querySelector('.idk-flow-head-actions, .idk-planner-toolbar');
    if (!host || host.querySelector('[data-idk-daily-tools]')) return root;
    const add = (label, id, action, className = 'btn tab') => { const item = button(label, action, className); item.dataset.idkDailyTools = id; host.prepend(item); };
    const notifications = button('Notifications', () => open('notificationCenter'), 'btn tab'); notifications.dataset.idkDailyTools = 'notifications'; host.prepend(notifications);
    add('Voice capture', 'voice', () => open('voiceCapture'));
    add('Focus Mode', 'focus', () => open('focusMode'), 'btn');
    if (kind === 'today') add('Daily Brief', 'brief', () => open('dailyBrief'));
    if (kind === 'today') add('End-of-day', 'review', () => open('endOfDay'));
    const updateNotifications = () => { const count = window.OS?.getActivityHistory?.()?.length || 0; notifications.textContent = count ? `Notifications (${count})` : 'Notifications'; };
    const cleanup = root.cleanup; window.addEventListener('idk-activity', updateNotifications); root.cleanup = () => { window.removeEventListener('idk-activity', updateNotifications); cleanup?.(); }; updateNotifications();
    return root;
  }
  function enhanceFiles(root) {
    if (!root || root.dataset.idkFileHistory) return root;
    root.dataset.idkFileHistory = 'true';
    const decorate = () => root.querySelectorAll('.file-entry').forEach(row => {
      if (row.querySelector('[data-idk-history]')) return;
      const name = row.querySelector('.file-entry-name strong')?.textContent?.trim();
      const entry = files().find(item => item.type === 'file' && item.name === name);
      const actions = row.querySelector('.file-entry-actions');
      if (!entry || !actions) return;
      const history = button('History', () => open('versionHistory', { fileId: entry.id }), 'btn tab');
      history.dataset.idkHistory = 'true';
      actions.append(history);
    });
    const observer = new MutationObserver(decorate); observer.observe(root, { childList: true, subtree: true }); decorate();
    const cleanup = root.cleanup; root.cleanup = () => { observer.disconnect(); cleanup?.(); };
    return root;
  }

  function voiceCaptureApp() {
    const root = document.createElement('div'); root.className = 'app idk-voice-capture'; root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK QUICK CAPTURE</span><h2>Voice Capture</h2><p>Speak a task, note, or reminder and save it locally in one tap.</p></div><span class="idk-nonchat-badge" data-state>READY</span></header><div class="idk-voice-form"><label>Save as<select class="field" data-type><option value="task">Task</option><option value="note">Note</option><option value="event">Reminder</option></select></label><textarea class="field" data-text rows="6" placeholder="Your transcript will appear here…"></textarea><div class="idk-nonchat-actions"><button class="btn" data-record>Start listening</button><button class="btn tab" data-save>Save capture</button></div></div><p class="idk-nonchat-status" data-status></p>';
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition, text = root.querySelector('[data-text]'), record = root.querySelector('[data-record]'), state = root.querySelector('[data-state]'), status = root.querySelector('[data-status]'); let recognition = null;
    if (!Recognition) { state.textContent = 'UNAVAILABLE'; status.textContent = 'Voice capture needs a browser with speech recognition. You can still type and save a capture.'; } else { recognition = new Recognition(); recognition.continuous = false; recognition.interimResults = true; recognition.lang = navigator.language || 'en-US'; recognition.onstart = () => { state.textContent = 'LISTENING'; record.textContent = 'Stop listening'; }; recognition.onresult = event => { text.value = [...event.results].map(result => result[0].transcript).join(''); }; recognition.onerror = event => { status.textContent = `Voice capture: ${event.error}.`; state.textContent = 'READY'; record.textContent = 'Start listening'; }; recognition.onend = () => { state.textContent = 'READY'; record.textContent = 'Start listening'; }; }
    record.onclick = () => { if (!recognition) return text.focus(); try { recognition.start(); } catch { recognition.stop(); } }; root.querySelector('[data-save]').onclick = () => { const value = text.value.trim(); if (!value) return status.textContent = 'Speak or type something first.'; const type = root.querySelector('[data-type]').value; if (type === 'task') { const items = list('idkTodos'); items.unshift({ id: `task-${Date.now()}`, text: value, done: false, priority: 'normal', due: today(), repeat: 'none', added: Date.now(), completed: 0 }); localStorage.setItem('idkTodos', JSON.stringify(items)); } else if (type === 'note') { const items = list('idkRichNotes'); items.unshift({ id: `note-${Date.now()}`, title: value.slice(0, 64), text: value, tags: 'voice', folder: 'Personal', trashed: false, updated: Date.now() }); localStorage.setItem('idkRichNotes', JSON.stringify(items)); } else { const items = list('idkCalendarEvents'); items.unshift({ id: `event-${Date.now()}`, title: value, date: today(), time: '', repeat: 'none', reminded: false }); localStorage.setItem('idkCalendarEvents', JSON.stringify(items)); } window.dispatchEvent(new CustomEvent('idk-data-changed', { detail: { type } })); notify('Quick Capture', `${type[0].toUpperCase() + type.slice(1)} saved.`, 'success'); text.value = ''; status.textContent = 'Capture saved locally.'; }; return root;
  }

  function automationRecipesApp() {
    const root = document.createElement('div'); root.className = 'app idk-automation-recipes'; root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK AUTOMATIONS</span><h2>Automation Recipes</h2><p>Start with a useful recipe, then customize it in Echo Automations.</p></div><span class="idk-nonchat-badge">LOCAL FIRST</span></header><div class="idk-recipe-grid" data-list></div><div class="idk-nonchat-actions"><button class="btn" data-manager>Open Echo Automations</button></div><p class="idk-nonchat-status" data-status></p>';
    const recipes = [{ name: 'Deep Work', detail: 'Start Focus Mode for 50 minutes with Notes and Planner.', action: 'focus', minutes: 50 }, { name: 'Morning Brief', detail: 'Open Daily Brief and Notifications Center.', action: 'brief' }, { name: 'Backup before travel', detail: 'Open Backup & Restore before you leave.', action: 'backup' }, { name: 'Quiet evening', detail: 'Set your presence to away and open your dashboard.', action: 'evening' }]; const listNode = root.querySelector('[data-list]'); recipes.forEach(recipe => { const card = document.createElement('article'); card.className = 'idk-recipe-card'; card.innerHTML = `<div><strong>${esc(recipe.name)}</strong><small>${esc(recipe.detail)}</small></div>`; card.append(button('Run', () => { if (recipe.action === 'focus') startFocus(recipe.minutes); else if (recipe.action === 'brief') { open('dailyBrief'); open('notificationCenter'); } else if (recipe.action === 'backup') window.IDKPerfectOS?.exportBackup?.() || window.IDKBackup?.open?.(); else { setPresence({ status: 'away', message: 'Quiet evening' }); open('dashboard'); } }, 'btn')); listNode.append(card); }); root.querySelector('[data-manager]').onclick = () => window.IDKPlatformNext?.openAutomationManager?.() || open('settings'); root.querySelector('[data-status]').textContent = 'Recipes run locally. Nothing is sent to a server unless you choose account sync.'; return root;
  }

  function extensionMarketplaceApp() {
    const enabled = read(EXTENSION_KEY, []), root = document.createElement('div'); root.className = 'app idk-extension-marketplace'; root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK ECOSYSTEM</span><h2>Extension Marketplace</h2><p>Discover safe IDK capabilities. Built-in extensions never get more access than the features they use.</p></div><span class="idk-nonchat-badge">PERMISSION AWARE</span></header><div class="idk-extension-grid" data-list></div><div class="idk-nonchat-actions"><button class="btn" data-store>Open App Store</button><button class="btn tab" data-permissions>Review permissions</button></div>';
    const catalog = [{ id: 'focus', title: 'Focus Pack', detail: 'Focus sessions, presence, and workspace launch.', permissions: 'local workspace, notifications' }, { id: 'brief', title: 'Daily Brief', detail: 'A calm start-of-day summary.', permissions: 'local tasks, calendar, activity' }, { id: 'capture', title: 'Voice Capture', detail: 'Speech-to-task, note, or reminder.', permissions: 'microphone only when recording' }, { id: 'versions', title: 'File History', detail: 'Local file checkpoints and restore.', permissions: 'local Files only' }]; const listNode = root.querySelector('[data-list]'); catalog.forEach(item => { const card = document.createElement('article'); card.className = 'idk-extension-card'; card.innerHTML = `<div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p><small>${esc(item.permissions)}</small></div><button class="btn ${enabled.includes(item.id) ? 'tab' : ''}" type="button">${enabled.includes(item.id) ? 'Enabled' : 'Enable'}</button>`; card.querySelector('button').onclick = event => { const next = new Set(read(EXTENSION_KEY, [])); next.has(item.id) ? next.delete(item.id) : next.add(item.id); localStorage.setItem(EXTENSION_KEY, JSON.stringify([...next])); event.currentTarget.textContent = next.has(item.id) ? 'Enabled' : 'Enable'; event.currentTarget.classList.toggle('tab', next.has(item.id)); notify('Extensions', `${item.title} ${next.has(item.id) ? 'enabled' : 'disabled'}.`, 'success'); }; listNode.append(card); }); root.querySelector('[data-store]').onclick = () => window.IDKPlatformNext?.openDiscovery?.() || window.IDKProductFeatures?.appCenter?.() || open('apps'); root.querySelector('[data-permissions]').onclick = () => open('permissions'); return root;
  }

  function openUniversalSearch(seed = '') {
    document.getElementById('idk-nonchat-search')?.remove();
    const root = document.createElement('section');
    root.id = 'idk-nonchat-search';
    root.className = 'idk-nonchat-search';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = '<div class="idk-nonchat-search-card"><header><div><span class="idk-nonchat-kicker">IDK FINDER</span><h2>Search everything</h2><p>Apps, file names and contents, notes, tasks, reminders, people, and tools.</p></div><button type="button" data-close aria-label="Close search">×</button></header><input class="field" data-query placeholder="Search IDK…" autocomplete="off"><div class="idk-nonchat-search-results" data-results></div><small class="idk-nonchat-search-help">Enter to open · Escape to close · Ctrl/Cmd + K</small></div>';
    const query = root.querySelector('[data-query]'), results = root.querySelector('[data-results]');
    let request = 0;
    const addResult = (item, type) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'idk-nonchat-search-result';
      row.append(Object.assign(document.createElement('strong'), { textContent: item.title }), Object.assign(document.createElement('small'), { textContent: type + (item.detail ? ` · ${item.detail}` : '') }));
      row.onclick = () => { root.remove(); item.run(); };
      results.append(row);
    };
    const render = async () => {
      const value = query.value.trim().toLowerCase(), currentRequest = ++request;
      results.replaceChildren();
      const matches = [];
      if (typeof APPS !== 'undefined') Object.entries(APPS).filter(([id, item]) => id !== 'player' && (!value || item.title.toLowerCase().includes(value))).slice(0, 12).forEach(([id, item]) => matches.push({ title: item.title, type: 'App', detail: id, run: () => open(id) }));
      files().filter(item => !value || `${item.name} ${item.mime || ''}`.toLowerCase().includes(value)).slice(0, 12).forEach(item => matches.push({ title: item.name, type: 'File', detail: item.mime || 'local file', run: () => window.IDKFileAssociations?.open?.(item) || open('files') }));
      list('idkRichNotes').filter(item => !value || `${item.title} ${item.text} ${item.tags}`.toLowerCase().includes(value)).slice(0, 10).forEach(item => matches.push({ title: item.title || 'Untitled note', type: 'Note', detail: 'Saved locally', run: () => open('notes') }));
      list('idkTodos').filter(item => !value || `${item.text} ${item.priority} ${item.due}`.toLowerCase().includes(value)).slice(0, 10).forEach(item => matches.push({ title: item.text, type: 'Task', detail: item.due || 'No due date', run: () => open(typeof APPS !== 'undefined' && APPS.planner ? 'planner' : 'todo') }));
      list('idkCalendarEvents').filter(item => !value || `${item.title} ${item.date} ${item.time}`.toLowerCase().includes(value)).slice(0, 10).forEach(item => matches.push({ title: item.title, type: 'Reminder', detail: `${item.date || 'No date'}${item.time ? ` · ${item.time}` : ''}`, run: () => open(typeof APPS !== 'undefined' && APPS.planner ? 'planner' : 'calendar') }));
      list('idkMessengerContacts').filter(item => !value || `${item.name || ''} ${item.username || ''}`.toLowerCase().includes(value)).slice(0, 8).forEach(item => matches.push({ title: item.name || item.username, type: 'Person', detail: 'Messenger contact', run: () => open('chat') }));
      [['Workspace Center', 'workspaceCenter'], ['OS Expansion Hub', 'osExpansion'], ['Personal Dashboard', 'dashboard'], ['Profile & Presence', 'profile'], ['Widget Library', 'widgetLibrary'], ['Settings', 'settings'], ['Privacy Center', 'privacy'], ['App Store', 'apps']].filter(([title]) => !value || title.toLowerCase().includes(value)).forEach(([title, id]) => matches.push({ title, type: 'IDK tool', run: () => open(id) }));
      matches.slice(0, 30).forEach(item => addResult(item, item.type));
      if (value && window.SYSTEM_APPS?.readBlob) {
        const textFiles = files().filter(item => item.type === 'file' && item.text).slice(0, 40);
        for (const item of textFiles) {
          if (currentRequest !== request) return;
          try { const blob = await window.SYSTEM_APPS.readBlob(item); const text = await blob?.text?.(); if (text?.toLowerCase().includes(value) && !matches.some(match => match.title === item.name)) addResult({ title: item.name, type: 'File contents', detail: 'Matched saved text', run: () => window.IDKFileAssociations?.open?.(item) || open('files') }, 'File contents'); } catch {}
        }
      }
      if (!matches.length && !results.children.length) results.append(Object.assign(document.createElement('p'), { className: 'idk-nonchat-search-empty', textContent: value ? 'No matching IDK data yet.' : 'Start typing to search your workspace.' }));
    };
    query.oninput = render;
    query.onkeydown = event => { if (event.key === 'Escape') root.remove(); if (event.key === 'Enter') results.querySelector('button')?.click(); };
    root.querySelector('[data-close]').onclick = () => root.remove();
    root.onclick = event => { if (event.target === root) root.remove(); };
    document.body.append(root);
    query.value = seed;
    render();
    query.focus();
    return root;
  }

  function profileApp() {
    const current = presenceState(), profile = read('idkProfile', {}), account = window.IDKAccount?.user;
    const root = document.createElement('div');
    root.className = 'app idk-profile-presence';
    root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK IDENTITY</span><h2>Profile & Presence</h2><p>Choose how your name and availability appear across IDK.</p></div><span class="idk-nonchat-badge" data-badge></span></header><section class="idk-profile-card"><span class="idk-profile-avatar" data-avatar></span><div><strong data-name></strong><small data-account></small></div></section><div class="idk-profile-form"><label>Display name<input class="field" data-name-input maxlength="32"></label><label>Availability<select class="field" data-status><option value="online">Online</option><option value="away">Away</option><option value="busy">Busy</option><option value="offline">Offline</option></select></label><label>Status message<input class="field" data-message maxlength="120" placeholder="What are you working on?"></label></div><div class="idk-nonchat-actions"><button class="btn" data-save>Save presence</button><button class="btn tab" data-profiles>Manage local profiles</button><button class="btn tab" data-account-action>Account & Devices</button></div><p class="idk-nonchat-status" data-status-copy>Presence is stored locally and shared with connected IDK Rooms or Messenger sessions.</p>';
    const nameInput = root.querySelector('[data-name-input]'), statusInput = root.querySelector('[data-status]'), messageInput = root.querySelector('[data-message]');
    nameInput.value = account?.username || profile.displayName || read('idkMessengerProfile', {}).name || profileName();
    statusInput.value = current.status;
    messageInput.value = current.message;
    const render = () => { const name = nameInput.value.trim() || profileName(); root.querySelector('[data-name]').textContent = name; root.querySelector('[data-avatar]').textContent = name.slice(0, 1).toUpperCase(); root.querySelector('[data-account]').textContent = account ? `Signed in as ${account.username}` : 'Local profile · sign in to sync across devices'; root.querySelector('[data-badge]').textContent = presenceLabel(statusInput.value); };
    root.querySelector('[data-save]').onclick = () => { if (!account) { const next = { ...read('idkProfile', {}), displayName: nameInput.value.trim().slice(0, 32) || 'Guest' }; try { localStorage.setItem('idkProfile', JSON.stringify(next)); } catch {} } const messenger = { ...read('idkMessengerProfile', {}), name: nameInput.value.trim().slice(0, 24) || 'Guest' }; try { localStorage.setItem('idkMessengerProfile', JSON.stringify(messenger)); } catch {} setPresence({ status: statusInput.value, message: messageInput.value }); render(); notify('Profile', 'Your profile and presence were updated.', 'success'); };
    root.querySelector('[data-profiles]').onclick = () => window.IDKAccountsDevices?.open?.('profiles') || window.IDKConnectivitySuite?.openProfiles?.();
    root.querySelector('[data-account-action]').onclick = () => window.IDKAccountsDevices?.open?.() || open('accounts');
    render();
    return root;
  }

  function dashboardApp() {
    const root = document.createElement('div');
    root.className = 'app idk-personal-dashboard';
    root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK DAILY DESK</span><h2>Personal Dashboard</h2><p>Your focus, reminders, files, profile, and widgets at a glance.</p></div><span class="idk-nonchat-badge" data-badge></span></header><div class="idk-dashboard-grid" data-grid></div><div class="idk-nonchat-actions"><button class="btn" data-task>Open Planner</button><button class="btn tab" data-search>Search everything</button><button class="btn tab" data-widgets>Manage widgets</button><button class="btn tab" data-profile>Profile & Presence</button></div>';
    const grid = root.querySelector('[data-grid]');
    const render = () => {
      const openTasks = list('idkTodos').filter(item => !item.done).sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999'))).slice(0, 4);
      const events = list('idkCalendarEvents').filter(item => item.date >= today()).sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`)).slice(0, 4);
      const recentFiles = files().filter(item => item.type === 'file').sort((a, b) => Number(b.updated || 0) - Number(a.updated || 0)).slice(0, 4);
      const presence = presenceState(), name = profileName(), widgets = list('idkDesktopWidgets');
      const card = (title, copy, items, action, empty) => { const node = document.createElement('article'); node.className = 'idk-dashboard-card'; node.innerHTML = `<header><strong>${esc(title)}</strong><small>${esc(copy)}</small></header><div class="idk-dashboard-list"></div>`; const body = node.querySelector('.idk-dashboard-list'); if (!items.length) body.append(Object.assign(document.createElement('p'), { className: 'idk-dashboard-empty', textContent: empty })); else items.forEach(item => body.append(Object.assign(document.createElement('div'), { className: 'idk-dashboard-row', innerHTML: `<strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small>` }))); node.append(button('Open', action, 'btn tab')); return node; };
      grid.replaceChildren(
        card('Focus next', `${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}`, openTasks.map(item => ({ title: item.text, detail: item.due ? `Due ${item.due}` : 'No due date' })), () => open(typeof APPS !== 'undefined' && APPS.planner ? 'planner' : 'todo'), 'You are all caught up.'),
        card('Coming up', `${events.length} reminder${events.length === 1 ? '' : 's'}`, events.map(item => ({ title: item.title, detail: `${item.date}${item.time ? ` · ${item.time}` : ''}` })), () => open(typeof APPS !== 'undefined' && APPS.planner ? 'planner' : 'calendar'), 'No upcoming reminders.'),
        card('Recent files', `${recentFiles.length} recent item${recentFiles.length === 1 ? '' : 's'}`, recentFiles.map(item => ({ title: item.name, detail: item.mime || 'Local file' })), () => open('files'), 'No local files yet.'),
        card('Desktop widgets', `${widgets.length} active`, [{ title: 'Live desktop information', detail: 'Weather, news, calendar, stocks, and sports' }], () => window.IDKDesktopWidgets?.open?.() || open('widgetLibrary'), 'No widgets placed yet.'),
        card('Profile presence', `${presenceLabel(presence.status)} · ${name}`, presence.message ? [{ title: presence.message, detail: 'Current status message' }] : [{ title: 'No status message', detail: 'Set one to tell people what you are doing.' }], () => open('profile'), 'Set your availability.')
      );
      root.querySelector('[data-badge]').textContent = presenceLabel(presence.status);
    };
    root.querySelector('[data-task]').onclick = () => open(typeof APPS !== 'undefined' && APPS.planner ? 'planner' : 'todo');
    root.querySelector('[data-search]').onclick = () => openUniversalSearch();
    root.querySelector('[data-widgets]').onclick = () => window.IDKDesktopWidgets?.open?.() || open('widgetLibrary');
    root.querySelector('[data-profile]').onclick = () => open('profile');
    const rerender = () => render();
    window.addEventListener('idk-data-changed', rerender);
    window.addEventListener('idk-presence-changed', rerender);
    root.cleanup = () => { window.removeEventListener('idk-data-changed', rerender); window.removeEventListener('idk-presence-changed', rerender); };
    render();
    return root;
  }

  function snapshot() {
    const items = files();
    return {
      files: items.filter(item => item?.type === 'file').length,
      folders: items.filter(item => item?.type === 'folder').length,
      notes: list('idkRichNotes').length || (read('idkNotes', '') ? 1 : 0),
      tasks: list('idkTodos').filter(item => !item?.done).length,
      events: list('idkCalendarEvents').length,
      installed: list('idkInstalledPrograms').length,
      pending: queueSize(),
      online: navigator.onLine,
      ai: window.IDKAIControls?.modeLabel?.(read('idkAiMode', 'cloud')) || 'Cloud AI'
    };
  }

  function stat(label, value, detail) {
    const item = document.createElement('article');
    item.className = 'idk-nonchat-stat';
    item.innerHTML = `<strong>${esc(value)}</strong><span>${esc(label)}</span><small>${esc(detail)}</small>`;
    return item;
  }

  function category(root, title, copy, items) {
    const section = document.createElement('section');
    section.className = 'idk-nonchat-section';
    section.innerHTML = `<header><div><span class="idk-nonchat-kicker">IDK WORKSPACE</span><h3>${esc(title)}</h3><p>${esc(copy)}</p></div></header>`;
    const grid = document.createElement('div');
    grid.className = 'idk-nonchat-grid';
    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'idk-nonchat-card';
      card.innerHTML = `<span class="idk-nonchat-glyph">${item.glyph}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></div>`;
      card.append(button('Open', item.action, 'btn tab'));
      grid.append(card);
    });
    section.append(grid);
    root.append(section);
  }

  function renderStats(root) {
    const data = snapshot();
    root.querySelector('[data-stats]').replaceChildren(
      stat('Files', data.files, `${data.folders} folders`),
      stat('Open tasks', data.tasks, `${data.events} calendar events`),
      stat('Installed apps', data.installed, 'App Store and local programs'),
      stat('Sync queue', data.pending, data.online ? 'Online and ready' : 'Offline changes stay local')
    );
    root.querySelector('[data-status]').textContent = `${data.online ? 'Online' : 'Offline'} · ${data.ai} · ${data.notes} note${data.notes === 1 ? '' : 's'} saved locally`;
    root.querySelector('[data-badge]').textContent = data.online ? 'SYSTEM READY' : 'OFFLINE READY';
  }

  async function syncNow(root) {
    root.querySelector('[data-status]').textContent = 'Retrying queued work…';
    try {
      await window.IDKOffline?.flush?.();
      await window.IDKDataLayer?.syncNow?.();
      await window.IDKAccount?.sync?.();
      notify('IDK Sync', 'Queued work was retried.', 'success');
    } catch {
      notify('IDK Sync', 'Some work remains queued. Your local changes are safe.', 'warning');
    }
    renderStats(root);
  }

  function workspaceApp() {
    const root = document.createElement('div');
    root.className = 'app idk-nonchat-app';
    root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK 10.0 CONTROL ROOM</span><h2>Workspace Center</h2><p>Open and manage everything outside Chat and Rooms from one place.</p></div><span class="idk-nonchat-badge" data-badge>SYSTEM READY</span></header><div class="idk-nonchat-stats" data-stats></div><p class="idk-nonchat-status" data-status></p><div class="idk-nonchat-actions"></div><div data-sections></div>';
    root.querySelector('.idk-nonchat-actions').append(
      button('Sync now', () => syncNow(root)),
      button('Backup & Restore', () => window.IDKPerfectOS?.exportBackup?.() || window.IDKBackup?.open?.(), 'btn tab'),
      button('Refresh status', () => renderStats(root), 'btn tab'),
      button('Search everything', () => openUniversalSearch(), 'btn tab'),
      button('Command palette', () => window.IDKCommandPalette?.open?.(), 'btn tab')
    );
    const sections = root.querySelector('[data-sections]');
    category(sections, 'Work', 'Files, notes, planning, and data tools.', [
      app('files', 'Files', '📁', 'Import, edit, preview, organize, and download files.'),
      app('notes', 'Notes', '🗒️', 'Write locally and save notes into Files.'),
      app('calendar', 'Calendar', '📅', 'Keep events and reminders in one place.'),
      app('planner', 'Planner', '☷', 'Plan projects and priorities.', () => open(typeof APPS !== 'undefined' && APPS.planner ? 'planner' : 'todo')),
      app('sheets', 'IDK Sheets', '📊', 'Edit CSV-style data and export it again.'),
      app('versionHistory', 'File History', '↺', 'Save checkpoints and restore earlier file versions.')
    ]);
    category(sections, 'Create & Explore', 'AI, browser, terminal, media, and creative tools.', [
      app('aiModes', 'AI Modes', '◈', 'Choose Cloud, Local, or Offline AI.'),
      app('ai', 'IDK Echo AI', '✦', 'Ask, code, or generate images.'),
      app('terminal', 'Terminal', '>_', 'Use IDK commands to open apps and files.'),
      app('proxy', 'Browser', '◎', 'Browse through the IDK browser workspace.'),
      app('paint', 'Paint', '🎨', 'Create and export images locally.'),
      app('voiceCapture', 'Voice Capture', '◉', 'Speak a task, note, or reminder.')
    ]);
    category(sections, 'Protect & Recover', 'Privacy, permissions, sync, backups, and health.', [
      app('privacy', 'Privacy Center', '🛡', 'Review AI, storage, and browser permission choices.'),
      app('security', 'Security Center', '◈', 'Manage app trust, permissions, and recovery.', () => window.IDKPlatformNext?.openSafetyCenter?.() || open('security')),
      app('syncCenter', 'Sync Center', '⇄', 'Retry offline and cloud changes.'),
      app('recoveryCenter', 'Backup & Recovery', '↺', 'Protect and restore local work.'),
      app('health', 'System Health', '♥', 'Check storage, services, and offline readiness.'),
      app('notificationCenter', 'Notifications Center', '●', 'Review and clear system activity.')
    ]);
    category(sections, 'Manage IDK', 'App lifecycle, desktop setup, and accessibility.', [
      app('dashboard', 'Personal Dashboard', '▦', 'See focus tasks, reminders, files, presence, and widgets.'),
      app('dailyBrief', 'Daily Brief', '☀', 'Get a short summary of today.'),
      app('endOfDay', 'End-of-Day Review', '◷', 'Close today and prepare tomorrow.'),
      app('focusMode', 'Focus Mode', '◉', 'Quiet the desktop and start a timed session.'),
      app('automationRecipes', 'Automation Recipes', '⚡', 'Run useful local workflows.'),
      app('extensionMarketplace', 'Extension Marketplace', '◇', 'Enable safe IDK capability packs.'),
      app('profile', 'Profile & Presence', '●', 'Set your name, status, and availability.'),
      app('apps', 'App Store', '▦', 'Open built-in apps and installed programs.'),
      app('settings', 'Settings', '⚙', 'Appearance, accessibility, sync, and devices.'),
      app('handoff', 'Device Handoff', '⇄', 'Move your account and workspace to another device.'),
      app('widgetLibrary', 'Widget Library', '▦', 'Add live information to the desktop.'),
      app('reliability', 'Reliability', '🛡️', 'Review diagnostics and account/service health.'),
      app('ecosystem', 'Ecosystem', '◎', 'Virtual desktops, extensions, and local AI.'),
      app('permissions', 'App Permissions', '🛡️', 'Allow or block built-in app capabilities.'),
      app('osExpansion', 'OS Expansion Hub', '◌', 'Sessions, health, cloud drives, privacy, updates, sharing, accessibility, and mobile layout.')
    ]);
    renderStats(root);
    const rerender = () => renderStats(root);
    window.addEventListener('online', rerender);
    window.addEventListener('offline', rerender);
    window.addEventListener('idk-data-changed', rerender);
    root.cleanup = () => {
      window.removeEventListener('online', rerender);
      window.removeEventListener('offline', rerender);
      window.removeEventListener('idk-data-changed', rerender);
    };
    return root;
  }

  function registerApps() {
    if (typeof APPS === 'undefined') return setTimeout(registerApps, 150);
    APPS.sheets ||= { title: 'IDK Sheets', glyph: '📊', desktop: false, dock: false, width: 980, height: 680, action: () => window.IDKSheets?.open?.() };
    APPS.universalSearch ||= { title: 'Universal Search', glyph: '⌕', desktop: false, dock: false, width: 760, height: 620, action: () => openUniversalSearch() };
    APPS.dashboard ||= { title: 'Personal Dashboard', glyph: '▦', desktop: true, dock: false, width: 940, height: 680, render: dashboardApp };
    APPS.profile ||= { title: 'Profile & Presence', glyph: '●', desktop: false, dock: false, width: 720, height: 600, render: profileApp };
    APPS.notificationCenter ||= { title: 'Notifications Center', glyph: '●', desktop: false, dock: false, width: 760, height: 650, render: notificationCenterApp };
    APPS.dailyBrief ||= { title: 'Daily Brief', glyph: '☀', desktop: true, dock: false, width: 820, height: 620, render: dailyBriefApp };
    APPS.endOfDay ||= { title: 'End-of-Day Review', glyph: '◷', desktop: true, dock: false, width: 860, height: 700, render: endOfDayApp };
    APPS.focusMode ||= { title: 'Focus Mode', glyph: '◉', desktop: true, dock: false, width: 700, height: 620, render: focusModeApp };
    APPS.versionHistory ||= { title: 'File History', glyph: '↺', desktop: false, dock: false, width: 820, height: 620, render: versionHistoryApp };
    APPS.voiceCapture ||= { title: 'Voice Capture', glyph: '◉', desktop: false, dock: false, width: 700, height: 560, render: voiceCaptureApp };
    APPS.automationRecipes ||= { title: 'Automation Recipes', glyph: '⚡', desktop: false, dock: false, width: 760, height: 620, render: automationRecipesApp };
    APPS.extensionMarketplace ||= { title: 'Extension Marketplace', glyph: '◇', desktop: false, dock: false, width: 820, height: 640, render: extensionMarketplaceApp };
    APPS.workspaceCenter ||= { title: 'Workspace Center', glyph: '◫', desktop: true, dock: false, width: 980, height: 720, render: workspaceApp };
    wrapApp('today', root => enhanceDailyApp(root, 'today'));
    wrapApp('planner', root => enhanceDailyApp(root, 'planner'));
    wrapApp('files', enhanceFiles);
    const host = document.getElementById('idk-os-next-tools') || document.getElementById('dock');
    if (host && !host.querySelector('[data-idk-workspace-center]')) {
      const launcher = button('◫ Workspace', () => open('workspaceCenter'), 'idk-nonchat-launcher');
      launcher.dataset.idkWorkspaceCenter = 'true';
      launcher.title = 'Open Workspace Center';
      launcher.setAttribute('aria-label', 'Open Workspace Center');
      host.append(launcher);
    }
  }

  window.IDKPresence = { get: presenceState, set: setPresence, label: presenceLabel };
  window.IDKReminders = { check: checkReminders };
  window.IDKFocus = { get: focusState, set: setFocus, start: startFocus, stop: () => setFocus({ enabled: false }) };
  window.IDKVersions = { snapshot: snapshotFile, restore: restoreVersion };
  window.IDKFileHistory = { open: fileId => open('versionHistory', { fileId }) };
  window.IDKUnifiedSearch = { ...(window.IDKUnifiedSearch || {}), open: openUniversalSearch };
  window.IDKFlowSearch = { ...(window.IDKFlowSearch || {}), open: openUniversalSearch };
  if (window.IDKProductFeatures) window.IDKProductFeatures.unifiedSearch = openUniversalSearch;
  window.IDKNonChatSuite = { open: () => open('workspaceCenter'), search: openUniversalSearch, snapshot };
  installReminderScheduler();
  installFocusScheduler();
  registerApps();
})();

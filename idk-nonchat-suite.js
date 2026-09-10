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

  const open = id => {
    if (id === 'sheets') return window.IDKSheets?.open?.();
    if (typeof APPS !== 'undefined' && APPS[id]) return window.OS?.open?.(id);
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
      [['Workspace Center', 'workspaceCenter'], ['Personal Dashboard', 'dashboard'], ['Profile & Presence', 'profile'], ['Widget Library', 'widgetLibrary'], ['Settings', 'settings'], ['Privacy Center', 'privacy'], ['App Store', 'apps']].filter(([title]) => !value || title.toLowerCase().includes(value)).forEach(([title, id]) => matches.push({ title, type: 'IDK tool', run: () => open(id) }));
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
      app('sheets', 'IDK Sheets', '📊', 'Edit CSV-style data and export it again.')
    ]);
    category(sections, 'Create & Explore', 'AI, browser, terminal, media, and creative tools.', [
      app('aiModes', 'AI Modes', '◈', 'Choose Cloud, Local, or Offline AI.'),
      app('ai', 'IDK Echo AI', '✦', 'Ask, code, or generate images.'),
      app('terminal', 'Terminal', '>_', 'Use IDK commands to open apps and files.'),
      app('proxy', 'Browser', '◎', 'Browse through the IDK browser workspace.'),
      app('paint', 'Paint', '🎨', 'Create and export images locally.')
    ]);
    category(sections, 'Protect & Recover', 'Privacy, permissions, sync, backups, and health.', [
      app('privacy', 'Privacy Center', '🛡', 'Review AI, storage, and browser permission choices.'),
      app('security', 'Security Center', '◈', 'Manage app trust, permissions, and recovery.', () => window.IDKPlatformNext?.openSafetyCenter?.() || open('security')),
      app('syncCenter', 'Sync Center', '⇄', 'Retry offline and cloud changes.'),
      app('recoveryCenter', 'Backup & Recovery', '↺', 'Protect and restore local work.'),
      app('health', 'System Health', '♥', 'Check storage, services, and offline readiness.')
    ]);
    category(sections, 'Manage IDK', 'App lifecycle, desktop setup, and accessibility.', [
      app('dashboard', 'Personal Dashboard', '▦', 'See focus tasks, reminders, files, presence, and widgets.'),
      app('profile', 'Profile & Presence', '●', 'Set your name, status, and availability.'),
      app('apps', 'App Store', '▦', 'Open built-in apps and installed programs.'),
      app('settings', 'Settings', '⚙', 'Appearance, accessibility, sync, and devices.'),
      app('widgetLibrary', 'Widget Library', '▦', 'Add live information to the desktop.'),
      app('reliability', 'Reliability', '🛡️', 'Review diagnostics and account/service health.'),
      app('ecosystem', 'Ecosystem', '◎', 'Virtual desktops, extensions, and local AI.'),
      app('permissions', 'App Permissions', '🛡️', 'Allow or block built-in app capabilities.')
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
    APPS.workspaceCenter ||= { title: 'Workspace Center', glyph: '◫', desktop: true, dock: false, width: 980, height: 720, render: workspaceApp };
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
  window.IDKUnifiedSearch = { ...(window.IDKUnifiedSearch || {}), open: openUniversalSearch };
  window.IDKFlowSearch = { ...(window.IDKFlowSearch || {}), open: openUniversalSearch };
  if (window.IDKProductFeatures) window.IDKProductFeatures.unifiedSearch = openUniversalSearch;
  window.IDKNonChatSuite = { open: () => open('workspaceCenter'), search: openUniversalSearch, snapshot };
  installReminderScheduler();
  registerApps();
})();

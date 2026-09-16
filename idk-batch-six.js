(() => {
  'use strict';

  const read = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
  };
  const button = (label, action, className = 'btn tab') => { const item = document.createElement('button'); item.type = 'button'; item.className = className; item.textContent = label; item.onclick = action; return item; };
  const note = text => Object.assign(document.createElement('p'), { className: 'idk-connected-note', textContent: text });
  const media = entry => entry?.type === 'file' && (/^(image|video)\//i.test(entry.mime || '') || /\.(png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v)$/i.test(entry.name || ''));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);

  function gallery() {
    const root = document.createElement('div'); root.className = 'app idk-gallery';
    const search = document.createElement('input'); search.className = 'field'; search.type = 'search'; search.placeholder = 'Search media...'; search.setAttribute('aria-label', 'Search media');
    const picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'image/*,video/*'; picker.multiple = true; picker.hidden = true;
    const grid = document.createElement('div'); grid.className = 'idk-gallery-grid'; const preview = document.createElement('section'); preview.className = 'idk-gallery-preview'; preview.append(note('Select an image or video from your Files library.'));
    const urls = [];
    const entries = () => (window.SYSTEM_APPS?.getFiles?.() || read('idkFileSystem', [])).filter(media).sort((a, b) => Number(b.updated || 0) - Number(a.updated || 0));
    const open = async entry => { const blob = await window.SYSTEM_APPS?.readBlob?.(entry).catch?.(() => null); if (!blob) return; const url = URL.createObjectURL(blob); urls.push(url); preview.replaceChildren(blob.type.startsWith('video/') ? Object.assign(document.createElement('video'), { src: url, controls: true, autoplay: true }) : Object.assign(document.createElement('img'), { src: url, alt: entry.name }), Object.assign(document.createElement('strong'), { textContent: entry.name }), note(`${entry.mime || blob.type} - ${Number(entry.size || blob.size).toLocaleString()} bytes`)); };
    const render = () => { grid.replaceChildren(); const query = search.value.trim().toLowerCase(); const list = entries().filter(entry => !query || entry.name.toLowerCase().includes(query)); if (!list.length) { grid.append(note('No images or videos are in Files yet. Import media or use the Files app.')); return; } list.forEach(entry => { const item = document.createElement('button'); item.type = 'button'; item.className = 'idk-gallery-item'; item.textContent = entry.name; item.onclick = () => open(entry); grid.append(item); }); };
    picker.onchange = async () => { const files = [...(picker.files || [])]; if (files.length) { await window.SYSTEM_APPS?.importFiles?.(files); render(); } picker.value = ''; };
    search.oninput = render;
    root.append(Object.assign(document.createElement('div'), { className: 'idk-connected-toolbar' }), grid, preview);
    const toolbar = root.querySelector('.idk-connected-toolbar'); toolbar.append(search, button('Import media', () => picker.click(), 'btn'), picker, button('Open Files', () => window.OS?.open?.('files'))); render();
    root.cleanup = () => urls.forEach(url => URL.revokeObjectURL(url)); return root;
  }

  function contacts() {
    const root = document.createElement('div'); root.className = 'app idk-contacts';
    const query = document.createElement('input'); query.className = 'field'; query.type = 'search'; query.placeholder = 'Search contacts...'; query.setAttribute('aria-label', 'Search contacts');
    const list = document.createElement('div'); list.className = 'idk-contacts-list'; const status = note('Loading contacts…');
    const render = users => { list.replaceChildren(); if (!users?.length) { list.append(note('No contacts are available yet. Use Friends to find people.')); return; } users.filter(user => !query.value.trim() || user.username?.toLowerCase().includes(query.value.trim().toLowerCase())).forEach(user => { const row = document.createElement('article'); row.className = 'idk-contact-row'; row.append(Object.assign(document.createElement('strong'), { textContent: user.username || 'IDK user' }), Object.assign(document.createElement('small'), { textContent: user.online === false ? 'Offline' : 'Friend' }), button('Message', () => { window.OS?.open?.('chat'); window.IdkMessenger?.selectUser?.({ userId: user.id || user.userId, username: user.username }); }, 'btn tab')); list.append(row); }); };
    const load = async () => { try { const response = await fetch('/api/friends', { credentials: 'same-origin' }); const data = await response.json(); status.textContent = data.ok ? `${data.friends?.length || 0} contacts` : (data.error || 'Sign in to load contacts.'); render(data.friends || []); } catch { status.textContent = 'Contacts service unavailable.'; render([]); } };
    query.oninput = () => { const rows = [...list.querySelectorAll('.idk-contact-row')]; rows.forEach(row => { row.hidden = query.value.trim() && !row.textContent.toLowerCase().includes(query.value.trim().toLowerCase()); }); };
    root.append(Object.assign(document.createElement('header'), { className: 'idk-connected-header' }), status, list); const header = root.querySelector('header'); const heading = document.createElement('div'); heading.append(Object.assign(document.createElement('h2'), { textContent: 'Contacts' }), Object.assign(document.createElement('p'), { textContent: 'Friends, profiles, and private conversations.' })); header.append(heading, button('Open Friends', () => window.IdkFriends?.open?.(), 'btn'), query); load(); return root;
  }

  function controlCenter() {
    const root = document.createElement('div'); root.className = 'app idk-control-center';
    const summary = document.createElement('div'); summary.className = 'idk-control-grid';
    const grid = document.createElement('div'); grid.className = 'idk-control-grid';
    const status = note('Checking IDK status…');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const formatBytes = value => value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.round(value / 1024)} KB`;
    const formatTime = value => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
    const readList = key => { const value = read(key, []); return Array.isArray(value) ? value : []; };
    const statusCard = (title, detail) => { const item = document.createElement('article'); item.className = 'idk-control-card'; item.append(Object.assign(document.createElement('strong'), { textContent: title }), Object.assign(document.createElement('small'), { textContent: detail })); return item; };
    const openApp = id => { if (typeof APPS === 'undefined' || !APPS[id] || !window.OS?.open) return false; window.OS.open(id); return true; };
    const refresh = async () => {
      status.textContent = 'Checking IDK status…';
      try {
        const health = await window.IDKDataLayer?.health?.().catch?.(() => ({})) || {};
        const syncState = window.IDKAccount?.getSyncStatus?.() || read('idkSyncStatus', {});
        let storage = {};
        try { storage = await navigator.storage?.estimate?.() || {}; } catch {}
        const pending = Number(health.pending || 0);
        const failures = Number(syncState.failures || 0);
        const queue = [...readList('idkOfflineQueue'), ...readList('idkCloudSyncQueue')];
        const queueTypes = [...new Set(queue.map(item => item?.type).filter(Boolean))].slice(0, 2).join(', ');
        const sync = health.syncState === 'syncing' ? 'Syncing' : pending ? `${pending} pending` : health.account ? 'Cloud ready' : 'Local only';
        summary.replaceChildren(
          statusCard('Connection', health.online ? 'Online' : 'Offline'),
          statusCard('Account', health.account ? 'Connected' : 'Local profile'),
          statusCard('Sync', sync),
          statusCard('Last sync', syncState.lastSuccess ? formatTime(syncState.lastSuccess) : 'No completed sync'),
          statusCard('Queued work', pending ? `${pending} pending${queueTypes ? ` · ${queueTypes}` : ''}` : 'Clear'),
          statusCard('Sync health', syncState.lastError ? 'Needs attention' : failures ? `${failures} recent failure${failures === 1 ? '' : 's'}` : 'Healthy'),
          statusCard('Storage', storage.quota ? `${formatBytes(storage.usage || 0)} used` : 'Unavailable'),
          statusCard('Files', `${health.files || 0} item${health.files === 1 ? '' : 's'}`),
          statusCard('Browser data', health.indexedDB ? 'IndexedDB ready' : 'Limited storage')
        );
        status.textContent = `${health.online ? 'Online' : 'Offline'} · ${health.account ? 'Account sync available' : 'Changes stay on this device'}${pending ? ` · ${pending} queued` : ''}${syncState.lastError ? ` · ${String(syncState.lastError).slice(0, 90)}` : ''}`;
      } catch (error) {
        status.textContent = `Status unavailable: ${error.message || 'try Refresh'}`;
      }
    };
    const syncNow = async () => {
      status.textContent = 'Syncing IDK…';
      try {
        await window.IDKOffline?.flush?.();
        const ok = Boolean(await window.IDKDataLayer?.syncNow?.());
        status.textContent = ok ? 'IDK sync completed.' : 'Sync did not complete. Local changes are safe.';
        notify('Control Center', ok ? 'IDK sync completed.' : 'Sync did not complete. Local changes are safe.', ok ? 'success' : 'warning');
      } catch (error) {
        status.textContent = `Sync failed: ${error.message || 'local changes are safe.'}`;
        notify('Control Center', status.textContent, 'warning');
      }
      await refresh();
    };
    const checkUpdates = async () => { const registration = await navigator.serviceWorker?.getRegistration?.(); if (!registration) { status.textContent = 'Update checks are unavailable in this browser.'; notify('Control Center', status.textContent, 'warning'); return; } status.textContent = 'Checking for an IDK update…'; await registration.update().catch(() => {}); if (registration.waiting) { registration.waiting.postMessage({ type: 'SKIP_WAITING' }); status.textContent = 'Update ready. Reloading IDK…'; notify('Control Center', 'Update ready. Reloading IDK…', 'success'); setTimeout(() => location.reload(), 500); } else { status.textContent = 'IDK is up to date.'; notify('Control Center', status.textContent, 'success'); } };
    const density = () => { const values = ['compact', 'normal', 'large']; const current = localStorage.getItem('iconSize') || 'normal'; const next = values[(values.indexOf(current) + 1) % values.length]; localStorage.setItem('iconSize', next); notify('Display', `Icon density set to ${next}.`, 'success'); setTimeout(() => location.reload(), 350); };
    const openAISetup = () => openApp('aiModes') || openApp('ai') || window.IDKProductionSuite?.open?.();
    const action = (title, detail, run) => { const item = document.createElement('button'); item.className = 'idk-control-card'; item.type = 'button'; item.title = detail; item.setAttribute('aria-label', `${title}: ${detail}`); item.append(Object.assign(document.createElement('strong'), { textContent: title }), Object.assign(document.createElement('small'), { textContent: detail })); item.onclick = async () => { if (item.disabled) return; item.disabled = true; try { await run(); } catch (error) { status.textContent = `${title} failed: ${error.message || 'try again.'}`; notify('Control Center', status.textContent, 'warning'); } finally { item.disabled = false; } }; return item; };
    grid.append(
      action('Sync now', 'Push changes or retry queued work', syncNow),
      action('Backup & Recovery', 'Protect local settings and files', () => window.IDKPlatformPolish?.openRecoveryCenter?.() || window.IDKBackup?.open?.()),
      action('Security & Privacy', 'Account safety and local data', () => window.IDKPlatformPolish?.openSecurityCenter?.() || openApp('privacy') || openApp('reliability')),
      action('Account & Devices', 'Profiles, sessions, and handoff', () => window.IDKAccountsDevices?.open?.('security') || window.IDKAccountsDevices?.open?.('profiles')),
      action('Check for updates', 'Load the newest IDK shell', checkUpdates),
      action('System Health', 'Storage, performance, and diagnostics', () => openApp('system-monitor') || openApp('reliability')),
      action('AI Setup', 'Choose local, cloud, or offline AI', openAISetup),
      action('Profiles', 'Switch local workspaces', () => window.IDKAccountsDevices?.open?.('profiles') || window.IDKConnectivitySuite?.openProfiles?.()),
      action('Smart Workspaces', 'Save or activate desktop setups', () => window.IDKOSNext?.workspaceView?.()),
      action('Activity Center', 'Notifications and recent activity', () => window.OS?.open?.('activity')),
      action('Share Sheet', 'Send text to IDK apps', () => window.IDKOSNext?.openShareSheet?.()),
      action('Icon density', 'Cycle compact, normal, and spacious', density)
    );
    const header = Object.assign(document.createElement('header'), { className: 'idk-connected-header' });
    const heading = document.createElement('div'); heading.append(Object.assign(document.createElement('h2'), { textContent: 'Control Center' }), Object.assign(document.createElement('p'), { textContent: 'Manage IDK status, recovery, privacy, accounts, and updates from one place.' }));
    header.append(heading, button('Refresh', refresh, 'btn'));
    root.append(header, status, summary, grid); refresh(); return root;
  }

  window.IDKBatchSix = { gallery, contacts, controlCenter };
})();

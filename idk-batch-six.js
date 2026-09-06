(() => {
  'use strict';

  const read = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
  };
  const button = (label, action, className = 'btn tab') => { const item = document.createElement('button'); item.type = 'button'; item.className = className; item.textContent = label; item.onclick = action; return item; };
  const note = text => Object.assign(document.createElement('p'), { className: 'idk-connected-note', textContent: text });
  const media = entry => entry?.type === 'file' && (/^(image|video)\//i.test(entry.mime || '') || /\.(png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v)$/i.test(entry.name || ''));

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
    const grid = document.createElement('div'); grid.className = 'idk-control-grid'; const status = note('Checking desktop state…');
    const refresh = async () => { const health = await window.IDKDataLayer?.health?.().catch?.(() => ({})) || {}; const apps = health.apps || {}; status.textContent = `${health.online ? 'Online' : 'Offline'} - ${health.account ? 'Account connected' : 'Local profile'} - ${apps.files || 0} Files items - ${apps.activeTasks || 0} active tasks`; };
    const density = () => { const values = ['compact', 'normal', 'large']; const current = localStorage.getItem('iconSize') || 'normal'; localStorage.setItem('iconSize', values[(values.indexOf(current) + 1) % values.length]); location.reload(); };
    const action = (title, detail, run) => { const item = document.createElement('button'); item.className = 'idk-control-card'; item.type = 'button'; item.append(Object.assign(document.createElement('strong'), { textContent: title }), Object.assign(document.createElement('small'), { textContent: detail })); item.onclick = run; return item; };
    grid.append(action('Cloud Sync', 'Account and provider sync', () => window.IDKDataLayer?.openSyncCenter?.()), action('Profiles', 'Switch local workspaces', () => window.IDKAccountsDevices?.open?.('profiles') || window.IDKConnectivitySuite?.openProfiles?.()), action('System Monitor', 'Storage and desktop health', () => window.OS?.open?.('system-monitor')), action('Performance', 'Window layouts and performance mode', () => window.IDKWindowManager?.openPerformanceCenter?.()), action('Smart Workspaces', 'Save or activate desktop setups', () => window.IDKOSNext?.workspaceView?.()), action('Activity Center', 'Notifications and recent activity', () => window.OS?.open?.('activity')), action('Share Sheet', 'Send text to IDK apps', () => window.IDKOSNext?.openShareSheet?.()), action('Icon density', 'Cycle compact, normal, and spacious', density));
    root.append(Object.assign(document.createElement('header'), { className: 'idk-connected-header' }), status, grid); const header = root.querySelector('header'); const heading = document.createElement('div'); heading.append(Object.assign(document.createElement('h2'), { textContent: 'Control Center' }), Object.assign(document.createElement('p'), { textContent: 'Desktop settings, workspaces, sync, and privacy in one place.' })); header.append(heading, button('Refresh', refresh, 'btn')); refresh(); return root;
  }

  window.IDKBatchSix = { gallery, contacts, controlCenter };
})();

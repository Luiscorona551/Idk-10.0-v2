(() => {
  'use strict';
  if (window.IDKBatchEight) return;

  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const formatBytes = size => { if (!Number.isFinite(size)) return 'Unknown size'; if (size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`; return `${(size / (1024 * 1024)).toFixed(1)} MB`; };
  const formatDate = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown date';
  const files = () => window.SYSTEM_APPS?.getFiles?.() || read('idkFileSystem', []);
  const downloadsFolder = () => files().find(item => item.type === 'folder' && item.parent === '' && item.name.toLowerCase() === 'downloads');
  const downloads = () => { const folder = downloadsFolder(); return files().filter(item => item.type === 'file' && item.parent === folder?.id); };

  function saveDownload(blob, name) {
    if (!blob) return notify('Downloads', 'That file is no longer available.', 'warning');
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1200);
  }

  async function downloadEntry(entry) {
    try { const blob = await window.SYSTEM_APPS?.readBlob?.(entry); if (!blob) throw new Error('That file is no longer available.'); saveDownload(blob, entry.name); notify('Downloads', `${entry.name} is ready.`, 'success'); }
    catch (error) { notify('Downloads', error.message || 'Download failed.', 'warning'); }
  }

  function openFiles() {
    window.OS?.open?.('files');
    setTimeout(() => window.IDKFiles?.openLocation?.('Downloads'), 80);
  }

  function downloadsApp() {
    const root = document.createElement('div');
    root.className = 'app idk-downloads-app';
    root.innerHTML = '<header class="idk-downloads-head"><div><h2>Downloads Manager</h2><p>Review files saved into your local Downloads folder.</p></div><span class="idk-downloads-mark">LOCAL VFS</span></header><div class="idk-downloads-stats" data-stats></div><div class="idk-downloads-toolbar"><input class="field" type="search" data-search placeholder="Search downloads…" aria-label="Search downloads"><button class="btn tab" type="button" data-sort>Sort: newest</button><button class="btn tab" type="button" data-files>Open Files</button><button class="btn tab" type="button" data-import>Import here</button><button class="btn tab" type="button" data-clear>Clear Downloads</button><input type="file" multiple hidden data-input></div><div class="idk-downloads-list" data-list></div>';
    const stats = root.querySelector('[data-stats]'), list = root.querySelector('[data-list]'), search = root.querySelector('[data-search]'), sort = root.querySelector('[data-sort]'), input = root.querySelector('[data-input]');
    let sortNewest = true;
    const render = () => {
      const items = downloads().filter(item => !search.value.trim() || item.name.toLowerCase().includes(search.value.trim().toLowerCase())).sort((a, b) => sortNewest ? Number(b.updated || 0) - Number(a.updated || 0) : a.name.localeCompare(b.name));
      const all = downloads();
      const total = all.reduce((sum, item) => sum + Number(item.size || item.content?.length || 0), 0);
      stats.innerHTML = `<article class="idk-downloads-stat"><strong>${all.length}</strong><small>download${all.length === 1 ? '' : 's'}</small></article><article class="idk-downloads-stat"><strong>${formatBytes(total)}</strong><small>local storage used</small></article><article class="idk-downloads-stat"><strong>${navigator.onLine ? 'Online' : 'Offline'}</strong><small>connection status</small></article>`;
      list.replaceChildren();
      if (!items.length) { list.innerHTML = '<div class="idk-download-empty">No downloads match this view. Import a file or save one from Browser.</div>'; return; }
      items.forEach(entry => {
        const row = document.createElement('article'); row.className = 'idk-download-item';
        row.innerHTML = `<span class="idk-download-icon">${entry.mime?.startsWith('image/') ? '▧' : '↓'}</span><div class="idk-download-info"><strong>${esc(entry.name)}</strong><small>${esc(entry.mime || 'File')} · ${formatBytes(Number(entry.size || entry.content?.length || 0))} · ${esc(formatDate(entry.updated))}</small></div><div class="idk-download-actions"></div>`;
        const actions = row.querySelector('.idk-download-actions');
        const action = (text, handler, className = 'btn tab') => { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = text; button.onclick = handler; actions.append(button); };
        action('Download', () => downloadEntry(entry), 'btn');
        action('Open in Files', openFiles);
        action('Delete', async () => { if (!confirm(`Delete ${entry.name}?`)) return; await window.IDKFiles?.removeEntries?.([entry]); notify('Downloads', `${entry.name} deleted.`, 'success'); render(); });
        list.append(row);
      });
    };
    search.oninput = render;
    sort.onclick = () => { sortNewest = !sortNewest; sort.textContent = sortNewest ? 'Sort: newest' : 'Sort: name'; render(); };
    root.querySelector('[data-files]').onclick = openFiles;
    root.querySelector('[data-import]').onclick = () => input.click();
    input.onchange = async () => { const folder = downloadsFolder(); const selected = input.files; if (!folder || !selected?.length) return; try { await window.SYSTEM_APPS?.importFiles?.(selected, folder.id); notify('Downloads', `${selected.length} file${selected.length === 1 ? '' : 's'} imported.`, 'success'); } catch (error) { notify('Downloads', error.message || 'Import failed.', 'warning'); } input.value = ''; render(); };
    root.querySelector('[data-clear]').onclick = async () => { const items = downloads(); if (!items.length || !confirm(`Delete all ${items.length} downloads?`)) return; await window.IDKFiles?.removeEntries?.(items); notify('Downloads', 'Downloads cleared.', 'success'); render(); };
    const refresh = () => render();
    window.addEventListener('idk-data-changed', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    root.cleanup = () => { window.removeEventListener('idk-data-changed', refresh); window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); };
    render();
    return root;
  }

  function profileState() {
    const profiles = read('idkUserProfiles', []);
    const activeId = localStorage.getItem('idkActiveUserProfile');
    return Array.isArray(profiles) && profiles.length ? profiles.find(item => item.id === activeId) || profiles[0] : { name: 'Guest', role: 'local' };
  }

  function handoffChecks() {
    const profile = profileState();
    const fileList = files();
    const workspace = read('idkWorkspace', []);
    return [
      { label: 'Profile', value: profile.name || 'Guest', detail: `${profile.role || 'local'} profile is ready`, state: 'good', glyph: '◉' },
      { label: 'Account', value: window.IDKAccount?.user?.username || (localStorage.getItem('idkAccountSession') ? 'Signed in' : 'Guest mode'), detail: window.IDKAccount?.user ? 'Cloud account available' : 'Local data remains available', state: window.IDKAccount?.user ? 'good' : 'neutral', glyph: '◎' },
      { label: 'Files', value: `${fileList.filter(item => item.type === 'file').length} files`, detail: `${fileList.filter(item => item.type === 'folder').length} folders available`, state: 'good', glyph: '▤' },
      { label: 'Workspace', value: `${Array.isArray(workspace) ? workspace.length : 0} windows`, detail: Array.isArray(workspace) && workspace.length ? 'Saved layout can be restored' : 'No saved layout yet', state: Array.isArray(workspace) && workspace.length ? 'good' : 'neutral', glyph: '▦' },
      { label: 'Connection', value: navigator.onLine ? 'Online' : 'Offline', detail: navigator.onLine ? 'Sync and imports are available' : 'Local changes stay on this device', state: navigator.onLine ? 'good' : 'warn', glyph: navigator.onLine ? '↗' : '⊘' }
    ];
  }

  function handoffMarkup(checks) { return checks.map(item => `<article class="idk-handoff-card ${item.state}"><span>${item.glyph}</span><div><strong>${esc(item.value)}</strong><small>${esc(item.label)} · ${esc(item.detail)}</small></div></article>`).join(''); }

  function handoffApp() {
    const root = document.createElement('div'); root.className = 'app idk-handoff-app';
    const render = () => { root.innerHTML = `<header class="idk-handoff-head"><div><h2>Device Handoff</h2><p>Confirm that your profile, account, Files, and saved workspace are ready on this device.</p></div><span class="idk-downloads-mark">STARTUP CHECK</span></header><p class="idk-handoff-status">${navigator.onLine ? 'Ready to continue.' : 'Offline mode: local data is still available.'}</p><div class="idk-handoff-grid">${handoffMarkup(handoffChecks())}</div><div class="idk-handoff-note">Workspace restoration opens the apps and window positions saved by IDK. It does not overwrite Files or account data.</div><div class="idk-handoff-actions"><button class="btn" type="button" data-restore>Restore workspace</button><button class="btn tab" type="button" data-accounts>Accounts & Devices</button><button class="btn tab" type="button" data-files>Open Files</button></div>`; root.querySelector('[data-restore]').onclick = async () => { const count = await window.OS?.restoreWorkspace?.() || 0; notify('Device Handoff', count ? `${count} saved window${count === 1 ? '' : 's'} restored.` : 'No saved workspace was found.'); render(); }; root.querySelector('[data-accounts]').onclick = () => window.IDKAccountsDevices?.open?.(); root.querySelector('[data-files]').onclick = openFiles; };
    render();
    return root;
  }

  function showStartupCheck() {
    if (sessionStorage.getItem('idkHandoffShown')) return;
    sessionStorage.setItem('idkHandoffShown', '1');
    const checks = handoffChecks();
    const root = document.createElement('section'); root.id = 'idk-handoff-check'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<div class="idk-handoff-dialog"><header><div><h2>Device Handoff</h2><p>IDK checked the data this device can restore.</p></div><button type="button" data-close aria-label="Close">×</button></header><div class="idk-handoff-grid">${handoffMarkup(checks)}</div><div class="idk-handoff-actions"><button class="btn" type="button" data-restore>Restore workspace</button><button class="btn tab" type="button" data-open>Open handoff</button><button class="btn tab" type="button" data-close>Continue</button></div></div>`;
    const close = () => root.remove(); root.querySelectorAll('[data-close]').forEach(button => { button.onclick = close; });
    root.querySelector('[data-restore]').onclick = async () => { close(); const count = await window.OS?.restoreWorkspace?.() || 0; notify('Device Handoff', count ? `${count} saved window${count === 1 ? '' : 's'} restored.` : 'No saved workspace was found.'); };
    root.querySelector('[data-open]').onclick = () => { close(); window.OS?.open?.('handoff'); };
    document.body.append(root);
  }

  function installReliability() {
    const key = 'idkCrashLog';
    const record = (message, source = 'client') => { const entries = read(key, []); const value = { message: String(message || 'Unknown client error').slice(0, 300), source, at: Date.now() }; if (entries[entries.length - 1]?.message === value.message) return; try { localStorage.setItem(key, JSON.stringify([...entries, value].slice(-40))); } catch {} if (!installReliability.lastNotice || Date.now() - installReliability.lastNotice > 15000) { installReliability.lastNotice = Date.now(); notify('IDK Reliability', 'A client error was recorded. Open Reliability Center for diagnostics.', 'warning'); } };
    window.addEventListener('error', event => record(event.error?.message || event.message, event.filename || 'window'));
    window.addEventListener('unhandledrejection', event => record(event.reason?.message || event.reason, 'promise'));
    window.addEventListener('online', () => notify('Connection', 'Back online. Queued work can retry.', 'success'));
    window.addEventListener('offline', () => notify('Connection', 'Offline mode enabled. Local changes remain available.', 'warning'));
  }

  function bootNextBatch() {
    if (window.IDKBatchNine || document.querySelector('script[src="idk-batch-nine.js"]')) return;
    const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = 'idk-batch-nine.css'; document.head.append(stylesheet);
    const script = document.createElement('script'); script.src = 'idk-batch-nine.js'; script.async = false; document.body.append(script);
  }

  function install() {
    bootNextBatch();
    if (typeof APPS !== 'undefined') {
      APPS.downloads = { title: 'Downloads Manager', glyph: '⬇️', desktop: false, dock: false, width: 780, height: 600, render: downloadsApp };
      APPS.handoff = { title: 'Device Handoff', glyph: '⇄', desktop: false, dock: false, width: 700, height: 580, render: handoffApp };
    }
    installReliability();
    setTimeout(showStartupCheck, 650);
  }

  window.IDKBatchEight = { downloads: downloadsApp, handoff: handoffApp, checks: handoffChecks };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

(() => {
  'use strict';
  if (window.IDKBatchThirteen) return;

  const MODE_KEY = 'idkAiMode';
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const open = app => window.OS?.open?.(app);
  const mode = () => read(MODE_KEY, 'cloud');
  const modeLabel = value => ({ cloud: 'Cloud AI', local: 'Local AI', offline: 'Offline AI' }[value] || 'Cloud AI');
  const button = (label, action, className = 'btn') => { const node = document.createElement('button'); node.type = 'button'; node.className = className; node.textContent = label; node.onclick = action; return node; };

  function setMode(value) {
    const next = ['cloud', 'local', 'offline'].includes(value) ? value : 'cloud';
    write(MODE_KEY, next);
    window.dispatchEvent(new CustomEvent('idk-ai-mode-changed', { detail: { mode: next } }));
    notify('AI mode', `${modeLabel(next)} is now selected.`, 'success');
  }

  async function cloudStatus() {
    try {
      const response = await fetch('/api/ai/status', { cache: 'no-store' });
      const data = await response.json();
      return data.configured ? `Ready: ${data.model || 'configured model'}${data.provider ? ` via ${data.provider}` : ''}.` : 'Cloud AI is not configured on this server.';
    } catch {
      return 'The cloud AI status route is unavailable. IDK can still run locally.';
    }
  }

  function aiModesApp() {
    const root = document.createElement('div'); root.className = 'app idk-ai-modes';
    root.innerHTML = '<header class="idk-control-head"><div><span class="idk-flow-kicker">IDK AI CONTROL</span><h2>Choose how AI works</h2><p>Pick the path that matches your privacy, cost, and connection needs. You can change this at any time.</p></div><span class="idk-control-badge" data-current></span></header><div class="idk-mode-grid" data-modes></div><section class="idk-control-card"><strong>Privacy at a glance</strong><p data-privacy></p><p class="idk-control-status" data-status>Checking cloud availability...</p></section><div class="idk-flow-actions"><button class="btn" data-open>Open selected mode</button><button class="btn tab" data-privacy-app>Privacy Center</button></div>';
    const list = root.querySelector('[data-modes]'), current = root.querySelector('[data-current]'), privacy = root.querySelector('[data-privacy]'), status = root.querySelector('[data-status]');
    const modes = [
      { id: 'cloud', title: 'Cloud AI', glyph: 'CLOUD', copy: 'Use IDK Echo through the configured server model. No user API key is needed.', privacy: 'Prompts are sent to the IDK server and its configured AI provider. Usage may consume the project quota.' },
      { id: 'local', title: 'Local AI', glyph: 'LOCAL', copy: 'Use Ollama or LM Studio on this device. The prompt stays between the browser and local runtime.', privacy: 'Prompts are sent only to the local endpoint you configure. This mode needs Ollama or LM Studio.' },
      { id: 'offline', title: 'Offline AI', glyph: 'OFFLINE', copy: 'Use IDK knowledge and local workspace context without a model or network request.', privacy: 'Prompts stay in this browser. Offline AI is intentionally limited to IDK help and suggestions.' }
    ];
    const render = () => {
      const selected = mode(); current.textContent = `${modeLabel(selected)} selected`;
      privacy.textContent = modes.find(item => item.id === selected)?.privacy || modes[0].privacy;
      list.replaceChildren(...modes.map(item => { const card = document.createElement('button'); card.type = 'button'; card.className = `idk-mode-card${item.id === selected ? ' selected' : ''}`; card.innerHTML = `<span class="idk-mode-glyph">${item.glyph}</span><strong>${esc(item.title)}</strong><small>${esc(item.copy)}</small>`; card.onclick = () => { setMode(item.id); render(); }; return card; }));
    };
    root.querySelector('[data-open]').onclick = () => { const selected = mode(); if (selected === 'local') open('localAgent'); else if (selected === 'offline') window.IDKEcosystem?.open?.(); else open('ai'); };
    root.querySelector('[data-privacy-app]').onclick = () => open('privacy');
    window.addEventListener('idk-ai-mode-changed', render);
    render(); cloudStatus().then(value => { status.textContent = value; });
    root.cleanup = () => window.removeEventListener('idk-ai-mode-changed', render);
    return root;
  }

  function privacyApp() {
    const root = document.createElement('div'); root.className = 'app idk-privacy-app';
    const permissions = typeof APPS === 'object' ? Object.entries(APPS).filter(([id]) => !['panic', 'player'].includes(id)).slice(0, 40) : [];
    root.innerHTML = '<header class="idk-control-head"><div><span class="idk-flow-kicker">IDK PRIVACY</span><h2>Privacy Center</h2><p>See where data goes and manage the controls that protect this browser.</p></div><span class="idk-control-badge">LOCAL FIRST</span></header><div class="idk-privacy-grid"><article class="idk-control-card"><strong>Current AI path</strong><p data-ai></p><button class="btn tab" data-ai-control>Change AI mode</button></article><article class="idk-control-card"><strong>Storage</strong><p>Notes, tasks, settings, Files metadata, and offline queues stay in this browser unless you sync or export them.</p><button class="btn tab" data-backup>Open Backup & Restore</button></article><article class="idk-control-card"><strong>Browser permissions</strong><p>Camera, microphone, USB, Bluetooth, notifications, and location are opt-in browser permissions.</p><button class="btn tab" data-permissions>Open App Permissions</button></article><article class="idk-control-card"><strong>Network</strong><p data-network></p><button class="btn tab" data-sync>Open Sync Center</button></article></div><section class="idk-control-card"><strong>Built-in app access</strong><div class="idk-privacy-list" data-list></div></section><div class="idk-flow-actions"><button class="btn" data-report>Download privacy report</button><button class="btn tab" data-clear>Clear local AI mode choice</button></div>';
    root.querySelector('[data-ai]').textContent = `${modeLabel(mode())}: ${mode() === 'cloud' ? 'prompts can leave this device through the IDK server' : 'prompts stay in this browser or local runtime'}.`;
    root.querySelector('[data-network]').textContent = navigator.onLine ? 'This browser is online. Cloud sync and cloud AI are available when configured.' : 'This browser is offline. Local data remains available and changes may queue for later.';
    root.querySelector('[data-list]').replaceChildren(...permissions.map(([id, app]) => { const row = document.createElement('div'); const state = window.IDKPermissions?.get?.(id) || {}; row.innerHTML = `<span>${esc(app.title)}</span><small>${state.open === false ? 'Blocked' : 'Allowed'} to open</small>`; return row; }));
    root.querySelector('[data-ai-control]').onclick = () => open('aiModes');
    root.querySelector('[data-backup]').onclick = () => window.IDKBackup?.open?.();
    root.querySelector('[data-permissions]').onclick = () => open('permissions');
    root.querySelector('[data-sync]').onclick = () => open('syncCenter');
    root.querySelector('[data-report]').onclick = () => { const report = { format: 'idk-privacy-report', createdAt: new Date().toISOString(), aiMode: mode(), online: navigator.onLine, storageItems: localStorage.length, permissions: read('idkAppPermissions', {}), localAgent: Boolean(window.IDKLocalAgent), indexedDB: Boolean(window.indexedDB) }; const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })); link.download = `idk-privacy-report-${Date.now()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); notify('Privacy Center', 'Privacy report downloaded.', 'success'); };
    root.querySelector('[data-clear]').onclick = () => { localStorage.removeItem(MODE_KEY); notify('Privacy Center', 'AI mode choice cleared. Cloud AI is the default.'); root.querySelector('[data-ai]').textContent = 'Cloud AI: prompts can leave this device through the IDK server.'; };
    return root;
  }

  async function syncHealth() { return window.IDKDataLayer?.health?.() || { online: navigator.onLine, pending: 0, syncState: 'idle', files: 0, account: false }; }
  function syncCenterApp() {
    const root = document.createElement('div'); root.className = 'app idk-sync-center';
    root.innerHTML = '<header class="idk-control-head"><div><span class="idk-flow-kicker">IDK SYNC</span><h2>Sync Center</h2><p>See what is waiting, retry safely, and open the provider controls without guessing.</p></div><span class="idk-control-badge" data-state>Checking</span></header><div class="idk-sync-stats" data-stats></div><section class="idk-control-card"><strong>Pending work</strong><div class="idk-sync-queue" data-queue></div><p class="idk-control-status" data-status></p></section><div class="idk-flow-actions"><button class="btn" data-refresh>Refresh</button><button class="btn" data-sync>Sync now</button><button class="btn tab" data-provider>Provider settings</button><button class="btn tab" data-backup>Download backup</button></div>';
    const render = async () => { const health = await syncHealth(); const pending = Number(health.pending || 0); root.querySelector('[data-state]').textContent = health.online ? (pending ? `${pending} pending` : 'Ready') : 'Offline'; root.querySelector('[data-stats]').innerHTML = `<article><strong>${health.files || 0}</strong><small>Files items</small></article><article><strong>${pending}</strong><small>Queued changes</small></article><article><strong>${health.account ? 'ON' : 'OFF'}</strong><small>Account sync</small></article><article><strong>${health.syncState || 'idle'}</strong><small>Sync state</small></article>`; const queue = [...(Array.isArray(read('idkOfflineQueue', [])) ? read('idkOfflineQueue', []) : []), ...(Array.isArray(read('idkCloudSyncQueue', [])) ? read('idkCloudSyncQueue', []) : [])].slice(-12).reverse(); root.querySelector('[data-queue]').innerHTML = queue.length ? queue.map(item => `<div><strong>${esc(item.type || 'queued change')}</strong><small>${item.at ? new Date(item.at).toLocaleString() : 'Waiting for connection'}</small></div>`).join('') : '<p class="idk-control-status">Nothing is waiting.</p>'; root.querySelector('[data-status]').textContent = health.online ? (pending ? 'Changes are safe locally and will retry.' : 'Everything is up to date locally.') : 'Offline mode is active. Changes will remain on this device.'; };
    root.querySelector('[data-refresh]').onclick = render;
    root.querySelector('[data-sync]').onclick = async () => { root.querySelector('[data-status]').textContent = 'Retrying queued work...'; await window.IDKOffline?.flush?.(); await window.IDKDataLayer?.syncNow?.(); await render(); };
    root.querySelector('[data-provider]').onclick = () => window.IDKDataLayer?.openSyncCenter?.();
    root.querySelector('[data-backup]').onclick = async () => { try { const data = await window.IDKBackup?.export?.(); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })); link.download = `idk-sync-backup-${Date.now()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); } catch { notify('Sync Center', 'The backup could not be created.', 'warning'); } };
    window.addEventListener('online', render); window.addEventListener('offline', render); window.addEventListener('idk-sync-status', render); render(); root.cleanup = () => { window.removeEventListener('online', render); window.removeEventListener('offline', render); window.removeEventListener('idk-sync-status', render); }; return root;
  }

  function recoveryApp() {
    const root = document.createElement('div'); root.className = 'app idk-recovery-center';
    root.innerHTML = '<header class="idk-control-head"><div><span class="idk-flow-kicker">IDK RECOVERY</span><h2>Backup & Recovery</h2><p>Protect local work before changing devices, profiles, or app settings.</p></div><span class="idk-control-badge">RESTORE READY</span></header><div class="idk-recovery-grid"><article class="idk-control-card"><strong>Full backup</strong><p>Includes local settings, Files metadata, installed app data, and IndexedDB content. Account sessions stay out.</p><button class="btn" data-backup>Open Backup & Restore</button></article><article class="idk-control-card"><strong>Conflict snapshots</strong><p>Before account restoration, IDK saves a local snapshot so you can recover from an unexpected overwrite.</p><button class="btn tab" data-safety>Open Safety Center</button></article><article class="idk-control-card"><strong>Workspace sharing</strong><p>Share a small desktop layout bundle or move a full backup between devices.</p><button class="btn tab" data-workspace>Share workspace</button></article></div><p class="idk-control-status" data-status>Local recovery tools are ready.</p>';
    root.querySelector('[data-backup]').onclick = () => window.IDKBackup?.open?.();
    root.querySelector('[data-safety]').onclick = () => window.IDKPlatformNext?.openSafetyCenter?.();
    root.querySelector('[data-workspace]').onclick = () => window.IDKDataLayer?.shareWorkspace?.();
    return root;
  }

  function commandItems() {
    const tools = [
      { title: 'Choose AI mode', detail: 'Cloud, Local, Offline', run: () => open('aiModes') },
      { title: 'Open Privacy Center', detail: 'Privacy', run: () => open('privacy') },
      { title: 'Open Sync Center', detail: 'Offline and cloud queues', run: () => open('syncCenter') },
      { title: 'Open Backup & Recovery', detail: 'Data safety', run: () => open('recoveryCenter') },
      { title: 'Open Full Backup & Restore', detail: 'Data safety', run: () => window.IDKBackup?.open?.() },
      { title: 'Open Safety Center', detail: 'Permissions', run: () => window.IDKPlatformNext?.openSafetyCenter?.() }
    ];
    const apps = [];
    if (typeof APPS === 'object') Object.entries(APPS).filter(([id, app]) => id !== 'player' && app?.title).forEach(([id, app]) => apps.push({ title: `Open ${app.title}`, detail: 'App', run: () => open(id) }));
    return [...tools, ...apps];
  }

  function openCommandPalette() {
    document.getElementById('idk-command-palette')?.remove();
    const root = document.createElement('section'); root.id = 'idk-command-palette'; root.className = 'idk-command-palette'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.innerHTML = '<div class="idk-command-card"><header><div><span class="idk-flow-kicker">IDK COMMANDS</span><h2>What do you want to do?</h2></div><button type="button" data-close aria-label="Close">×</button></header><input class="field" data-query placeholder="Search apps and actions..." autocomplete="off"><div class="idk-command-list" data-list></div><small class="idk-command-help">Arrow keys to move · Enter to open · Escape to close</small></div>';
    const query = root.querySelector('[data-query]'), list = root.querySelector('[data-list]'); let selected = 0;
    const render = () => { const value = query.value.toLowerCase().trim(); const matches = commandItems().filter(item => !value || `${item.title} ${item.detail}`.toLowerCase().includes(value)).slice(0, 24); selected = Math.min(selected, Math.max(0, matches.length - 1)); list.replaceChildren(...matches.map((item, index) => { const node = document.createElement('button'); node.type = 'button'; node.className = `idk-command-row${index === selected ? ' selected' : ''}`; node.innerHTML = `<strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small>`; node.onclick = () => { root.remove(); item.run(); }; return node; })); root._matches = matches; };
    query.oninput = () => { selected = 0; render(); }; query.onkeydown = event => { if (event.key === 'ArrowDown') { event.preventDefault(); selected += 1; render(); } else if (event.key === 'ArrowUp') { event.preventDefault(); selected = Math.max(0, selected - 1); render(); } else if (event.key === 'Enter') { event.preventDefault(); root._matches?.[selected]?.run(); root.remove(); } else if (event.key === 'Escape') root.remove(); };
    root.querySelector('[data-close]').onclick = () => root.remove(); root.addEventListener('click', event => { if (event.target === root) root.remove(); }); document.body.append(root); render(); query.focus();
  }

  function install() {
    if (typeof APPS !== 'undefined') {
      APPS.aiModes ||= { title: 'AI Modes', glyph: '◈', desktop: true, dock: false, width: 820, height: 620, render: aiModesApp };
      APPS.privacy ||= { title: 'Privacy Center', glyph: '🛡', desktop: false, dock: false, width: 820, height: 640, render: privacyApp };
      APPS.syncCenter ||= { title: 'Sync Center', glyph: '⇄', desktop: false, dock: false, width: 820, height: 620, render: syncCenterApp };
      APPS.recoveryCenter ||= { title: 'Backup & Recovery', glyph: '↺', desktop: false, dock: false, width: 820, height: 620, render: recoveryApp };
    }
    document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyP' || event.altKey && event.code === 'Space') { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return; event.preventDefault(); event.stopPropagation(); openCommandPalette(); } }, true);
    if (!document.getElementById('idk-batch-thirteen-launcher')) { const launcher = button('⌘', openCommandPalette); launcher.id = 'idk-batch-thirteen-launcher'; launcher.title = 'Command palette (Ctrl/Cmd + Shift + P)'; launcher.setAttribute('aria-label', launcher.title); document.body.append(launcher); }
  }

  window.IDKAIControls = { getMode: mode, setMode, modeLabel, open: () => open('aiModes'), openSelected: () => { const selected = mode(); if (selected === 'local') open('localAgent'); else if (selected === 'offline') window.IDKEcosystem?.open?.(); else open('ai'); } };
  window.IDKCommandPalette = { open: openCommandPalette };
  window.IDKBatchThirteen = { aiModesApp, privacyApp, syncCenterApp, recoveryApp, openCommandPalette };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

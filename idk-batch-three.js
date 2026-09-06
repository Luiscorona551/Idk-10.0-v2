(() => {
  'use strict';

  const META_KEY = 'idkDataSyncMeta';
  const CONFLICT_KEY = 'idkDataConflictSnapshots';
  const SAFE_KEYS = [
    'theme', 'idkCustomTheme', 'wallpaper', 'iconSize', 'dockPosition', 'motion',
    'idkGridDensity', 'desktopOrder', 'idkDesktopFavorites', 'idkWidgetConfig',
    'idkDesktopWidgets', 'idkVirtualDesktops', 'idkActiveVirtualDesktop',
    'idkSmartWorkspaces', 'idkNextState', 'idkFocusMode', 'idkCollaborationRoom'
  ];
  const IGNORED_KEYS = new Set([META_KEY, CONFLICT_KEY, 'idkSyncStatus', 'idkOfflineQueue', 'idkCloudSyncQueue']);
  let originalSet = null;
  let originalRemove = null;
  let dirtyTimer = 0;
  let pill = null;

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);

  function base64Url(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromBase64Url(value) {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
  }

  function workspaceBundle() {
    const values = {};
    SAFE_KEYS.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) values[key] = value;
      } catch {}
    });
    return { format: 'idk-workspace-share', version: 1, createdAt: new Date().toISOString(), values };
  }

  function applyWorkspaceBundle(bundle) {
    if (!bundle || bundle.format !== 'idk-workspace-share' || !bundle.values || typeof bundle.values !== 'object') throw new Error('That is not an IDK workspace share.');
    Object.entries(bundle.values).forEach(([key, value]) => {
      if (!SAFE_KEYS.includes(key) || typeof value !== 'string' || value.length > 250000) return;
      localStorage.setItem(key, value);
    });
    write(META_KEY, { ...read(META_KEY, {}), importedAt: Date.now(), dirtyAt: Date.now() });
  }

  async function shareWorkspace() {
    const bundle = workspaceBundle();
    const encoded = base64Url(JSON.stringify(bundle));
    const link = `${location.origin}${location.pathname}#workspace=${encoded}`;
    if (link.length > 7000) {
      downloadJSON(`idk-workspace-${new Date().toISOString().slice(0, 10)}.json`, bundle);
      notify('Workspace', 'This workspace was too large for a link, so a file was downloaded.', 'warning');
      return;
    }
    try {
      if (navigator.share) await navigator.share({ title: 'IDK workspace', text: 'Open this IDK workspace.', url: link });
      else await navigator.clipboard.writeText(link);
      notify('Workspace', 'Workspace link copied or shared.', 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      window.prompt('Copy this workspace link', link);
    }
  }

  function downloadJSON(name, value) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function importWorkspaceHash() {
    const match = location.hash.match(/^#workspace=([^&]+)/);
    if (!match) return;
    try {
      applyWorkspaceBundle(JSON.parse(fromBase64Url(match[1])));
      history.replaceState(null, '', `${location.pathname}${location.search}`);
      notify('Workspace', 'Shared workspace imported. Reloading the desktop.', 'success');
      setTimeout(() => location.reload(), 350);
    } catch (error) {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
      notify('Workspace', error.message || 'That workspace link could not be imported.', 'warning');
    }
  }

  async function storageHealth() {
    const estimate = await navigator.storage?.estimate?.().catch?.(() => ({})) || {};
    const files = read('idkFileSystem', []);
    const offline = read('idkOfflineQueue', []);
    const cloud = read('idkCloudSyncQueue', []);
    const sync = read('idkSyncStatus', { state: 'idle', pending: false });
    return {
      online: navigator.onLine,
      account: Boolean(window.IDKAccount?.user),
      indexedDB: Boolean(window.indexedDB),
      files: Array.isArray(files) ? files.length : 0,
      blobFiles: Array.isArray(files) ? files.filter(file => file?.storage === 'indexeddb').length : 0,
      usage: Number(estimate.usage || 0),
      quota: Number(estimate.quota || 0),
      pending: (Array.isArray(offline) ? offline.length : 0) + (Array.isArray(cloud) ? cloud.length : 0),
      syncState: sync.state || 'idle',
      dirtyAt: Number(read(META_KEY, {}).dirtyAt || 0)
    };
  }

  function rememberDirty(key) {
    if (!key || IGNORED_KEYS.has(String(key))) return;
    const meta = read(META_KEY, {});
    write(META_KEY, { ...meta, dirtyAt: Date.now(), key: String(key), revision: Number(meta.revision || 0) + 1 });
    clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(refreshPill, 120);
  }

  function wrapStorage() {
    if (originalSet || !localStorage) return;
    originalSet = localStorage.setItem.bind(localStorage);
    originalRemove = localStorage.removeItem.bind(localStorage);
    try {
      localStorage.setItem = (key, value) => { originalSet(key, value); rememberDirty(key); };
      localStorage.removeItem = key => { originalRemove(key); rememberDirty(key); };
    } catch {}
  }

  function statusText(health) {
    if (!health.online) return 'Offline';
    if (health.pending) return `${health.pending} pending`;
    if (health.syncState === 'syncing') return 'Syncing';
    if (health.account) return health.dirtyAt ? 'Sync ready' : 'Cloud ready';
    return 'Local only';
  }

  async function refreshPill() {
    if (!pill) return;
    const health = await storageHealth();
    const label = statusText(health);
    pill.textContent = `⇄ ${label}`;
    pill.dataset.state = health.online ? (health.pending || health.syncState === 'syncing' ? 'pending' : 'ready') : 'offline';
    pill.title = `${health.account ? 'Account sync available' : 'Local browser storage'} · ${health.files} Files item${health.files === 1 ? '' : 's'} · click for sync controls`;
    pill.setAttribute('aria-label', pill.title);
  }

  async function syncNow() {
    const health = await storageHealth();
    if (!health.online) {
      notify('Cloud Sync', 'You are offline. Changes will be queued automatically.', 'warning');
      refreshPill();
      return false;
    }
    if (!health.account) {
      window.IDKAccountsDevices?.open?.('sync');
      return false;
    }
    notify('Cloud Sync', 'Syncing your desktop and Files…');
    const result = await window.IDKAccount?.sync?.().catch?.(() => false);
    write(META_KEY, { ...read(META_KEY, {}), lastSyncAt: Date.now(), dirtyAt: result ? 0 : Number(read(META_KEY, {}).dirtyAt || Date.now()) });
    notify('Cloud Sync', result ? 'Your desktop is up to date.' : 'Sync could not finish. Your local changes are safe.', result ? 'success' : 'warning');
    refreshPill();
    return Boolean(result);
  }

  function openSyncCenter() {
    if (window.IDKAccountsDevices?.open) return window.IDKAccountsDevices.open('sync');
    window.IDKNext?.open?.('recovery');
  }

  function saveConflictSnapshot() {
    const bundle = workspaceBundle();
    const list = read(CONFLICT_KEY, []);
    const next = [{ ...bundle, id: `conflict-${Date.now()}`, createdAt: Date.now() }, ...(Array.isArray(list) ? list : [])].slice(0, 4);
    write(CONFLICT_KEY, next);
    return next[0];
  }

  function installPill() {
    const bar = document.getElementById('idk-next-bar') || document.getElementById('desktop');
    if (!bar || document.getElementById('idk-data-sync-pill')) return;
    pill = document.createElement('button');
    pill.id = 'idk-data-sync-pill';
    pill.className = document.getElementById('idk-next-bar') ? 'idk-next-launcher' : 'idk-data-sync-pill';
    pill.type = 'button';
    pill.addEventListener('click', openSyncCenter);
    bar.append(pill);
    refreshPill();
  }

  function install() {
    wrapStorage();
    installPill();
    importWorkspaceHash();
    window.addEventListener('online', () => { refreshPill(); window.IDKOffline?.flush?.(); if (window.IDKAccount?.user) setTimeout(() => syncNow(), 500); });
    window.addEventListener('offline', refreshPill);
    window.addEventListener('idk-sync-status', refreshPill);
    window.addEventListener('idk-account-before-restore', () => { saveConflictSnapshot(); refreshPill(); });
    window.addEventListener('idk-account-restored', refreshPill);
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyS' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        shareWorkspace();
      }
    });
    setInterval(refreshPill, 15000);
  }

  window.IDKDataLayer = { health: storageHealth, shareWorkspace, importWorkspace: applyWorkspaceBundle, syncNow, openSyncCenter, saveConflictSnapshot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

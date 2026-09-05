(() => {
  'use strict';
  const STORAGE_KEYS = ['theme', 'idkCustomTheme', 'wallpaper', 'iconSize', 'dockPosition', 'motion', 'idkDesktopWidgets', 'idkWidgetConfig', 'idkFileSystem', 'idkDropzone', 'idkInstalledPrograms', 'idkProgramSafety', 'idkProgramVersions', 'idkPendingAppUpdates', 'idkEchoAutomations', 'idkRecoverySnapshots', 'idkDesktopProfiles', 'idkProgramTrust', 'idkOfflineQueue', 'idkLocale', 'idkMailMessages', 'idkMessengerProfile', 'idkTodos', 'idkCalendarEvents', 'idkRichNotes', 'idkAudioSettings', 'idkAccessibility', 'idkSmartWorkspaces', 'idkClipboardHistory', 'idkSystemTimeline'];
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const notify = (title, message) => window.OS?.notify?.(title, message);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function blobDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB is unavailable.'));
      const request = indexedDB.open('idkFileBlobs', 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('files')) request.result.createObjectStore('files'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open file storage.'));
    });
  }
  const blobBase64 = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
  const base64Blob = (value, type) => { const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0)); return new Blob([bytes], { type: type || 'application/octet-stream' }); };
  async function readBlobs() {
    const db = await blobDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly'), objectStore = tx.objectStore('files'), values = objectStore.getAll(), keys = objectStore.getAllKeys();
      tx.oncomplete = async () => { try { resolve(await Promise.all(values.result.map((value, index) => blobBase64(value).then(base64 => ({ id: keys.result[index], type: value.type, base64 }))))); } catch (error) { reject(error); } };
      tx.onerror = () => reject(tx.error);
    });
  }
  async function restoreBlobs(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    const db = await blobDatabase();
    await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); rows.forEach(row => tx.objectStore('files').put(base64Blob(row.base64, row.type), row.id)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  }
  async function makeBackup() {
    const state = Object.fromEntries(STORAGE_KEYS.map(key => [key, localStorage.getItem(key)]).filter(([, value]) => value !== null));
    return { format: 'idk-backup', version: 1, exportedAt: new Date().toISOString(), state, blobs: await readBlobs().catch(() => []) };
  }
  function downloadJSON(name, value) { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
  function openBackup() {
    document.getElementById('idk-files-backup-modal')?.remove();
    const root = document.createElement('section'); root.id = 'idk-files-backup-modal'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.innerHTML = '<div class="idk-quality-card"><header><strong>Files Backup & Restore</strong><button type="button" data-close aria-label="Close">×</button></header><p>Export IDK settings, local file metadata, Mail, widgets, and stored file bytes to one backup file.</p><div class="idk-quality-actions"><button class="btn" type="button" data-export>Download backup</button><button class="btn tab" type="button" data-import>Restore backup</button><input type="file" accept="application/json" hidden data-file></div><p class="idk-quality-status" data-status>Backups stay on your device unless you choose to share them.</p></div>';
    const status = root.querySelector('[data-status]'), file = root.querySelector('[data-file]');
    root.querySelector('[data-close]').onclick = () => root.remove();
    root.querySelector('[data-export]').onclick = async () => { status.textContent = 'Preparing backup…'; try { downloadJSON(`idk-backup-${new Date().toISOString().slice(0, 10)}.json`, await makeBackup()); status.textContent = 'Backup downloaded.'; } catch (error) { status.textContent = error.message; } };
    root.querySelector('[data-import]').onclick = () => file.click();
    file.onchange = async () => { try { const backup = JSON.parse(await file.files[0].text()); if (backup.format !== 'idk-backup') throw new Error('That is not an IDK backup.'); Object.entries(backup.state || {}).forEach(([key, value]) => localStorage.setItem(key, value)); await restoreBlobs(backup.blobs); status.textContent = 'Backup restored. Reloading IDK…'; setTimeout(() => location.reload(), 500); } catch (error) { status.textContent = error.message || 'Could not restore backup.'; } };
    document.body.append(root);
  }

  function attachBackupButtons() {
    document.querySelectorAll('.files-app,.idk-file-home').forEach(root => {
      if (root.dataset.backupAttached) return;
      const toolbar = root.querySelector('.system-toolbar,.idk-file-command') || root;
      if (!toolbar) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn tab idk-backup-button'; button.textContent = 'Backup & Restore'; button.onclick = openBackup; toolbar.append(button); root.dataset.backupAttached = 'true';
    });
  }

  function openAccessibility() {
    document.getElementById('idk-accessibility-modal')?.remove();
    const state = { highContrast: false, reduceMotion: false, largeText: false, ...read('idkAccessibility', {}) };
    const root = document.createElement('section'); root.id = 'idk-accessibility-modal'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<div class="idk-quality-card"><header><strong>Accessibility</strong><button type="button" data-close aria-label="Close">×</button></header><p>These settings apply on this device.</p><label><input type="checkbox" data-key="highContrast" ${state.highContrast ? 'checked' : ''}> High contrast</label><label><input type="checkbox" data-key="reduceMotion" ${state.reduceMotion ? 'checked' : ''}> Reduce motion</label><label><input type="checkbox" data-key="largeText" ${state.largeText ? 'checked' : ''}> Larger text</label><div class="idk-quality-actions"><button class="btn" type="button" data-save>Apply</button></div></div>`;
    root.querySelector('[data-close]').onclick = () => root.remove();
    root.querySelector('[data-save]').onclick = () => { root.querySelectorAll('[data-key]').forEach(input => { state[input.dataset.key] = input.checked; }); write('idkAccessibility', state); applyAccessibility(); root.remove(); };
    document.body.append(root);
  }
  function applyAccessibility() {
    const state = { highContrast: false, reduceMotion: false, largeText: false, ...read('idkAccessibility', {}) };
    document.body.classList.toggle('idk-high-contrast', state.highContrast); document.body.classList.toggle('idk-reduce-motion', state.reduceMotion); document.body.classList.toggle('idk-large-text', state.largeText);
    document.getElementById('desktop')?.setAttribute('role', 'application'); document.getElementById('desktop')?.setAttribute('aria-label', 'IDK 10.0 desktop');
  }
  function installAccessibility() { applyAccessibility(); if (!document.getElementById('idk-accessibility-toggle')) { const button = document.createElement('button'); button.id = 'idk-accessibility-toggle'; button.type = 'button'; button.textContent = 'Aa'; button.title = 'Accessibility settings'; button.setAttribute('aria-label', 'Accessibility settings'); button.onclick = openAccessibility; document.body.append(button); } }

  function installNotificationFilter() {
    const panel = document.getElementById('notifications-panel'), list = document.getElementById('notification-list');
    if (!panel || !list || panel.querySelector('[data-notification-filter]')) return;
    const filter = document.createElement('select'); filter.className = 'idk-notification-filter'; filter.dataset.notificationFilter = 'true'; filter.setAttribute('aria-label', 'Filter notifications'); filter.innerHTML = '<option value="all">All</option><option value="info">Info</option><option value="success">Success</option><option value="warning">Warnings</option><option value="danger">Errors</option>'; panel.querySelector('.notification-panel-heading')?.append(filter);
    filter.onchange = () => list.querySelectorAll('.notification-center-item').forEach(item => { item.hidden = filter.value !== 'all' && !item.classList.contains(filter.value); });
    new MutationObserver(() => filter.onchange()).observe(list, { childList: true });
  }

  async function selfTestApp() {
    const root = document.createElement('div'); root.className = 'idk-self-test'; root.innerHTML = '<div class="idk-self-test-heading"><strong>IDK System Self-Test</strong><small>Checks local storage and connected services without changing your data.</small></div><div class="idk-self-test-list"></div><p class="idk-quality-status" data-status>Running checks…</p>';
    const list = root.querySelector('.idk-self-test-list'), status = root.querySelector('[data-status]');
    const checks = [
      ['Local storage', () => { const key = '__idk_test'; localStorage.setItem(key, 'ok'); const valid = localStorage.getItem(key) === 'ok'; localStorage.removeItem(key); return valid; }],
      ['IndexedDB file storage', async () => Boolean(await blobDatabase())],
      ['Desktop widgets', () => Boolean(window.IDKDesktopWidgets)],
      ['Mail workspace', () => typeof APPS !== 'undefined' && Boolean(APPS.mail)],
      ['Account and database service', async () => { const response = await fetch('/api/account/status', { cache: 'no-store' }); return response.ok; }],
      ['Server health', async () => { const response = await fetch('/healthz', { cache: 'no-store' }); return response.ok; }],
      ['Browser proxy route', async () => { const response = await fetch('/api/browser/scope', { cache: 'no-store' }); return response.ok; }],
      ['Public App Store', async () => { const response = await fetch('/api/store/programs', { cache: 'no-store' }); return response.ok; }]
    ];
    for (const [name, check] of checks) { const row = document.createElement('div'); row.className = 'idk-self-test-row'; row.innerHTML = `<strong>${esc(name)}</strong><span>Checking…</span>`; list.append(row); try { const result = await check(); row.classList.add(result ? 'pass' : 'warn'); row.querySelector('span').textContent = result ? 'Pass' : 'Unavailable'; } catch { row.classList.add('warn'); row.querySelector('span').textContent = 'Unavailable'; } }
    const warnings = list.querySelectorAll('.warn').length; status.textContent = warnings ? `${warnings} service${warnings === 1 ? '' : 's'} unavailable. Local IDK features remain usable.` : 'All checks passed.';
    return root;
  }
  function installSelfTest() {
    if (typeof APPS === 'undefined') return;
    APPS.selftest = { title: 'System Self-Test', glyph: '✓', desktop: false, dock: false, width: 560, height: 560, render: selfTestApp };
    const icons = document.getElementById('icons'); if (icons && !icons.querySelector('[data-final-app="selftest"]')) { const icon = document.createElement('button'); icon.type = 'button'; icon.className = 'idk-final-desktop-icon'; icon.dataset.finalApp = 'selftest'; icon.innerHTML = '<span>✓</span><label>System Self-Test</label>'; icon.onclick = () => window.OS?.open?.('selftest'); icons.append(icon); }
    window.IDKSelfTest = { open: () => window.OS?.open?.('selftest') };
  }

  function install() {
    attachBackupButtons(); installAccessibility(); installNotificationFilter(); installSelfTest();
    new MutationObserver(() => { attachBackupButtons(); installNotificationFilter(); }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', event => { if (event.ctrlKey && event.altKey && event.shiftKey && event.key.toLowerCase() === 't') { event.preventDefault(); window.IDKSelfTest?.open?.(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

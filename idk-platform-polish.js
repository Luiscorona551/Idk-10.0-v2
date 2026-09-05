(() => {
  'use strict';
  if (window.IDKPlatformPolish) return;

  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const SNAPSHOT_KEY = 'idkRecoverySnapshots';
  const PROFILE_KEY = 'idkDesktopProfiles';
  const TRUST_KEY = 'idkProgramTrust';
  const QUEUE_KEY = 'idkOfflineQueue';
  const LOCALE_KEY = 'idkLocale';
  let installPrompt = null;

  function modal(idValue, title, subtitle = 'IDK Platform') {
    document.getElementById(idValue)?.remove();
    const root = document.createElement('section');
    root.id = idValue;
    root.className = 'idk-next-modal idk-polish-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<div class="idk-next-card"><header class="idk-next-head"><div><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></div><button type="button" data-close aria-label="Close">×</button></header><div class="idk-next-body"></div></div>`;
    root.querySelector('[data-close]').onclick = () => root.remove();
    document.body.append(root);
    return root;
  }

  function download(name, data, type = 'application/json') {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function localState() {
    const state = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && !['idkAccountSession', SNAPSHOT_KEY, QUEUE_KEY, PROFILE_KEY, TRUST_KEY].includes(key)) state[key] = localStorage.getItem(key);
    }
    return state;
  }

  function snapshotState(reason = 'Manual snapshot') {
    const snapshots = read(SNAPSHOT_KEY, []);
    snapshots.unshift({ id: id(), reason, createdAt: Date.now(), state: localState() });
    write(SNAPSHOT_KEY, snapshots.slice(0, 8));
    notify('Recovery', 'A local recovery snapshot was saved.', 'success');
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot?.state || !confirm(`Restore the snapshot from ${new Date(snapshot.createdAt).toLocaleString()}? Current local settings will be replaced.`)) return;
    snapshotState('Before restore');
    Object.keys(localState()).forEach(key => localStorage.removeItem(key));
    Object.entries(snapshot.state).forEach(([key, value]) => localStorage.setItem(key, value));
    location.reload();
  }

  async function storageInfo() {
    try { const estimate = await navigator.storage?.estimate?.(); return `${Math.round((estimate?.usage || 0) / 1024)} KB used · ${Math.round((estimate?.quota || 0) / 1024 / 1024)} MB available`; } catch { return 'Browser storage estimate unavailable.'; }
  }

  function openSecurityCenter() {
    const root = modal('idk-security-center', 'Security & Privacy', 'Account safety, local data, and privacy controls');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<p class="idk-next-note">IDK keeps account credentials in secure cookies. Desktop settings and recovery snapshots stay in this browser unless you export or sync them.</p><div class="idk-platform-list" data-summary></div><div class="idk-platform-actions"><button class="btn" type="button" data-export>Export account data</button><button class="btn tab" type="button" data-local>Download local data</button><button class="btn tab" type="button" data-permissions>Permissions</button><button class="btn tab" type="button" data-signout>Sign out here</button></div><div class="idk-platform-risk" data-danger><strong>Account removal</strong><p>This permanently deletes your account data, installed cloud programs, and synced files.</p><button class="btn tab" type="button" data-delete>Delete my account</button></div><h3>Privacy audit</h3><div class="idk-platform-list" data-audit></div>';
    const summary = body.querySelector('[data-summary]');
    const user = window.IDKAccount?.user;
    summary.innerHTML = `<article class="idk-platform-card"><div><strong>${esc(user?.username || 'Guest desktop')}</strong><small>${user ? 'Signed in with cloud sync enabled' : 'Guest mode · local storage only'}</small></div><span class="idk-platform-badge">${user ? 'Account' : 'Local'}</span></article><article class="idk-platform-card"><div><strong>Current browser session</strong><small>${esc(navigator.userAgent.slice(0, 130))}</small></div><span class="idk-platform-badge">Active</span></article>`;
    const audit = body.querySelector('[data-audit]');
    const groups = { Appearance: /theme|wallpaper|iconSize|dockPosition|motion/i, Apps: /Program|App|Workspace|Clipboard|Timeline|Automation/i, Files: /File|Dropzone|Notes|Mail/i, Accessibility: /Accessibility|Audio/i, Other: /.*/ };
    const keys = Object.keys(localState());
    audit.innerHTML = keys.length ? keys.map(key => { const group = Object.entries(groups).find(([, pattern]) => pattern.test(key))?.[0] || 'Other'; return `<article class="idk-platform-card"><div><strong>${esc(key)}</strong><small>${group} · ${String(localStorage.getItem(key) || '').length} characters</small></div></article>`; }).join('') : '<p class="idk-next-empty">No local settings have been saved.</p>';
    body.querySelector('[data-export]').onclick = async () => { const response = await fetch('/api/account/export', { credentials: 'same-origin' }).catch(() => null); if (!response?.ok) return notify('Security', 'Account export requires a signed-in server account. Use local data export instead.'); const data = await response.json(); download(`idk-account-export-${new Date().toISOString().slice(0, 10)}.json`, data); notify('Security', 'Account export downloaded.', 'success'); };
    body.querySelector('[data-local]').onclick = () => download(`idk-local-data-${new Date().toISOString().slice(0, 10)}.json`, { format: 'idk-local-export', version: 1, exportedAt: new Date().toISOString(), state: localState() });
    body.querySelector('[data-permissions]').onclick = () => { root.remove(); window.IDKPlatformNext?.openSafetyCenter?.(); };
    body.querySelector('[data-signout]').onclick = async () => { await fetch('/api/account/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {}); localStorage.removeItem('idkAccountSession'); location.reload(); };
    body.querySelector('[data-delete]').onclick = async () => { if (!confirm('Delete your IDK account and all synced data permanently? Download an export first if you need a copy.')) return; const response = await fetch('/api/account', { method: 'DELETE', credentials: 'same-origin' }).catch(() => null); if (!response?.ok) return notify('Security', 'Account deletion could not be completed.'); localStorage.clear(); location.reload(); };
    return root;
  }

  function openRecoveryCenter() {
    const root = modal('idk-recovery-center', 'Data & Recovery', 'Snapshots, imports, storage, and offline recovery');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<p class="idk-next-note">Snapshots save desktop settings and app data in this browser. Create one before importing, switching profiles, or testing a new app.</p><div class="idk-platform-actions"><button class="btn" type="button" data-snapshot>Save snapshot</button><button class="btn tab" type="button" data-export>Download local data</button><button class="btn tab" type="button" data-import>Import local data</button><button class="btn tab" type="button" data-backup>Full backup with files</button><input type="file" data-file accept="application/json,.json" hidden></div><p class="idk-platform-status" data-storage>Checking storage…</p><h3>Recovery snapshots</h3><div class="idk-platform-list" data-list></div><h3>Import a text or CSV file</h3><form class="idk-import-form"><input class="field" name="file" type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" required><input class="field" name="name" placeholder="Optional file name"><button class="btn tab" type="submit">Add to Files</button></form>';
    const list = body.querySelector('[data-list]');
    const render = () => { const snapshots = read(SNAPSHOT_KEY, []); list.replaceChildren(); if (!snapshots.length) { list.innerHTML = '<p class="idk-next-empty">No snapshots yet.</p>'; return; } snapshots.forEach(snapshot => { const card = document.createElement('article'); card.className = 'idk-platform-card'; card.innerHTML = `<div><strong>${esc(snapshot.reason)}</strong><small>${new Date(snapshot.createdAt).toLocaleString()} · ${Object.keys(snapshot.state || {}).length} settings</small></div><div class="idk-platform-actions"></div>`; const restore = document.createElement('button'); restore.type = 'button'; restore.className = 'btn tab'; restore.textContent = 'Restore'; restore.onclick = () => restoreSnapshot(snapshot); card.querySelector('.idk-platform-actions').append(restore); list.append(card); }); };
    body.querySelector('[data-snapshot]').onclick = () => { snapshotState(); render(); };
    body.querySelector('[data-export]').onclick = () => download(`idk-local-data-${new Date().toISOString().slice(0, 10)}.json`, { format: 'idk-local-export', version: 1, exportedAt: new Date().toISOString(), state: localState() });
    const fileInput = body.querySelector('[data-file]');
    body.querySelector('[data-import]').onclick = () => fileInput.click();
    fileInput.onchange = async () => { const file = fileInput.files?.[0]; if (!file) return; try { const value = JSON.parse(await file.text()); if (value.format !== 'idk-local-export' || !value.state) throw new Error('That is not an IDK local export.'); snapshotState('Before local import'); Object.entries(value.state).forEach(([key, data]) => localStorage.setItem(key, data)); notify('Recovery', 'Local data imported. Reloading IDK…', 'success'); setTimeout(() => location.reload(), 500); } catch (error) { notify('Recovery', error.message); } };
    body.querySelector('[data-backup]').onclick = () => window.IDKBackup?.open?.();
    body.querySelector('.idk-import-form').onsubmit = async event => { event.preventDefault(); const form = event.currentTarget; const file = form.file.files?.[0]; if (!file) return; const content = await file.text(); const name = form.name.value.trim() || file.name; const files = read('idkFileSystem', []); files.unshift({ id: id(), name, type: 'file', parent: '', updated: Date.now(), size: file.size, mime: file.type || 'text/plain', text: content, storage: 'local' }); write('idkFileSystem', files.slice(0, 500)); notify('Files', `${name} was added to local Files.`, 'success'); form.reset(); };
    storageInfo().then(value => { body.querySelector('[data-storage]').textContent = value; });
    render();
    return root;
  }

  function manifestFromHtml(html, fallback = {}) {
    try {
      const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
      const node = doc.querySelector('script[type="application/idk-manifest+json"]');
      const parsed = node ? JSON.parse(node.textContent || '{}') : {};
      const manifest = { ...fallback, ...parsed };
      doc.querySelectorAll('meta[name^="idk-app-"]').forEach(meta => { manifest[meta.name.replace('idk-app-', '')] = meta.content; });
      return manifest;
    } catch { return { ...fallback }; }
  }

  async function sha256(text) {
    if (!window.crypto?.subtle) return '';
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
    return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function refreshTrust() {
    const trust = read(TRUST_KEY, {});
    const programs = read('idkInstalledPrograms', []);
    for (const program of programs) {
      if (!program.html) continue;
      const hash = await sha256(program.html);
      trust[program.id] = { hash, manifest: manifestFromHtml(program.html, { name: program.name, version: program.version || 'local' }), checkedAt: Date.now(), verified: Boolean(program.verified) };
    }
    write(TRUST_KEY, trust);
    return trust;
  }

  function openDeveloperConsole() {
    const root = modal('idk-developer-console', 'Developer Console', 'Manifests, trust fingerprints, and app tools');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<p class="idk-next-note">IDK app manifests declare identity, version, category, and permissions. Add this JSON as <code>application/idk-manifest+json</code> in an HTML app.</p><form class="idk-manifest-form"><div class="idk-developer-grid"><input class="field" name="id" required placeholder="App ID, e.g. com.example.notes"><input class="field" name="name" required placeholder="App name"><input class="field" name="version" required value="1.0.0" placeholder="Version"><input class="field" name="category" value="Productivity" placeholder="Category"></div><label class="idk-platform-check"><input type="checkbox" name="network"> Request network access</label><label class="idk-platform-check"><input type="checkbox" name="storage" checked> Request saved data</label><label class="idk-platform-check"><input type="checkbox" name="notifications"> Request notifications</label><textarea class="field idk-manifest-output" name="output" readonly spellcheck="false"></textarea><div class="idk-platform-actions"><button class="btn" type="submit">Generate manifest</button><button class="btn tab" type="button" data-copy>Copy JSON</button><button class="btn tab" type="button" data-download>Download manifest</button><button class="btn tab" type="button" data-creator>Creator Studio</button></div></form><h3>Installed app trust</h3><div class="idk-platform-list" data-trust><p class="idk-next-empty">Checking fingerprints…</p></div>';
    const form = body.querySelector('form'), output = form.output, trustList = body.querySelector('[data-trust]');
    const generate = event => { event?.preventDefault?.(); const data = { id: form.id.value.trim(), name: form.name.value.trim(), version: form.version.value.trim(), category: form.category.value.trim() || 'Other', permissions: { network: form.network.checked, storage: form.storage.checked, notifications: form.notifications.checked } }; if (!data.id || !data.name || !data.version) return notify('Developer Console', 'App ID, name, and version are required.'); output.value = JSON.stringify(data, null, 2); };
    form.onsubmit = generate;
    body.querySelector('[data-copy]').onclick = async () => { if (!output.value) generate(); try { await navigator.clipboard.writeText(output.value); notify('Developer Console', 'Manifest copied.'); } catch { notify('Developer Console', 'Copy is unavailable.'); } };
    body.querySelector('[data-download]').onclick = () => { if (!output.value) generate(); download(`${form.id.value || 'idk-app'}-manifest.json`, output.value); };
    body.querySelector('[data-creator]').onclick = () => { root.remove(); openCreatorStudio(); };
    refreshTrust().then(trust => { const programs = read('idkInstalledPrograms', []); trustList.replaceChildren(); if (!programs.length) { trustList.innerHTML = '<p class="idk-next-empty">No installed programs.</p>'; return; } programs.forEach(program => { const info = trust[program.id] || {}; const card = document.createElement('article'); card.className = 'idk-platform-card'; card.innerHTML = `<div><strong>${esc(program.name)}</strong><small>${info.hash ? `SHA-256 ${info.hash.slice(0, 18)}…` : 'Fingerprint unavailable'} · ${info.verified ? 'Verified publisher' : 'Local review'}</small></div><span class="idk-platform-badge">${info.verified ? 'Verified' : 'Review'}</span>`; trustList.append(card); }); });
    return root;
  }

  async function openCreatorStudio() {
    const root = modal('idk-creator-studio', 'Creator Studio', 'Manage your published IDK Store apps');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<p class="idk-platform-status" data-status>Loading your published apps…</p><div class="idk-platform-list" data-list></div>';
    const status = body.querySelector('[data-status]'), list = body.querySelector('[data-list]');
    try {
      const response = await fetch('/api/store/creators/me', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Sign in to manage published apps.');
      status.textContent = `${data.programs.length} published app${data.programs.length === 1 ? '' : 's'}.`;
      if (!data.programs.length) { list.innerHTML = '<p class="idk-next-empty">No published apps yet. Use Publish from App Store.</p>'; return root; }
      data.programs.forEach(program => { const card = document.createElement('article'); card.className = 'idk-platform-card'; card.innerHTML = `<div><strong>${esc(program.icon)} ${esc(program.name)}</strong><small>v${esc(program.version)} · ${program.verified ? 'Verified publisher' : 'Publisher review'} · hash ${esc((program.contentHash || '').slice(0, 14))}…</small></div><div class="idk-platform-actions"></div>`; const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn'; edit.textContent = 'Publish update'; edit.onclick = () => editPublishedApp(program, root); card.querySelector('.idk-platform-actions').append(edit); list.append(card); });
    } catch (error) { status.textContent = error.message; }
    return root;
  }

  function editPublishedApp(program, parent) {
    const root = modal('idk-creator-edit', `Update ${program.name}`, 'Publish a new version with a manifest and hash');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = `<form class="idk-publish-form"><label>Version<input class="field" name="version" value="${esc(program.version)}" required></label><label>Description<textarea class="field" name="description">${esc(program.description || '')}</textarea></label><label>Manifest JSON<textarea class="field" name="manifest" spellcheck="false">${esc(JSON.stringify(program.manifest || {}, null, 2))}</textarea></label><label>Complete HTML<textarea class="field" name="content" required spellcheck="false" placeholder="<!doctype html>…"></textarea></label><p class="idk-platform-status" data-status></p><div class="idk-platform-actions"><button class="btn" type="submit">Publish update</button><button class="btn tab" type="button" data-cancel>Cancel</button></div></form>`;
    const form = body.querySelector('form'), status = body.querySelector('[data-status]');
    body.querySelector('[data-cancel]').onclick = () => root.remove();
    form.onsubmit = async event => { event.preventDefault(); status.textContent = 'Publishing…'; const payload = { version: form.version.value.trim(), description: form.description.value.trim(), manifest: form.manifest.value, content: form.content.value }; try { const response = await fetch(`/api/store/programs/${encodeURIComponent(program.id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || 'Update failed.'); status.textContent = `Published with SHA-256 ${data.contentHash.slice(0, 18)}…`; notify('Creator Studio', 'App update published.', 'success'); } catch (error) { status.textContent = error.message; } };
  }

  function applyPreferences() {
    const state = { highContrast: false, reduceMotion: false, largeText: false, ...read('idkAccessibility', {}) };
    document.body.classList.toggle('idk-high-contrast', state.highContrast);
    document.body.classList.toggle('idk-reduce-motion', state.reduceMotion);
    document.body.classList.toggle('idk-large-text', state.largeText);
    document.documentElement.lang = read(LOCALE_KEY, 'en');
    document.body.dataset.locale = document.documentElement.lang;
  }

  function openProfiles() {
    const root = modal('idk-desktop-profiles', 'Desktop Profiles', 'Save separate layouts for work, home, and testing');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<form class="idk-workspace-save"><input class="field" name="name" required maxlength="40" placeholder="Profile name"><button class="btn" type="submit">Save current profile</button></form><div class="idk-platform-list" data-list></div>';
    const list = body.querySelector('[data-list]');
    const render = () => { const profiles = read(PROFILE_KEY, []); list.replaceChildren(); if (!profiles.length) list.innerHTML = '<p class="idk-next-empty">No profiles saved yet.</p>'; profiles.forEach(profile => { const card = document.createElement('article'); card.className = 'idk-platform-card'; card.innerHTML = `<div><strong>${esc(profile.name)}</strong><small>${new Date(profile.updatedAt).toLocaleString()} · ${Object.keys(profile.state || {}).length} settings</small></div><div class="idk-platform-actions"></div>`; const activate = document.createElement('button'); activate.type = 'button'; activate.className = 'btn'; activate.textContent = 'Use profile'; activate.onclick = () => { snapshotState('Before profile switch'); Object.keys(localState()).forEach(key => localStorage.removeItem(key)); Object.entries(profile.state).forEach(([key, value]) => localStorage.setItem(key, value)); location.reload(); }; const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn tab'; remove.textContent = 'Delete'; remove.onclick = () => { write(PROFILE_KEY, profiles.filter(item => item.id !== profile.id)); render(); }; card.querySelector('.idk-platform-actions').append(activate, remove); list.append(card); }); };
    body.querySelector('form').onsubmit = event => { event.preventDefault(); const profiles = read(PROFILE_KEY, []); profiles.unshift({ id: id(), name: event.currentTarget.name.value.trim(), updatedAt: Date.now(), state: localState() }); write(PROFILE_KEY, profiles.slice(0, 8)); event.currentTarget.reset(); render(); };
    render();
    return root;
  }

  function openPreferences() {
    const root = modal('idk-preferences', 'IDK Preferences', 'Accessibility, language, profiles, and install options');
    const body = root.querySelector('.idk-next-body');
    const accessibility = { highContrast: false, reduceMotion: false, largeText: false, ...read('idkAccessibility', {}) };
    body.innerHTML = `<label>Language<select class="field" data-locale><option value="en">English</option><option value="es">Español</option></select></label><label class="idk-platform-check"><input type="checkbox" data-a="highContrast" ${accessibility.highContrast ? 'checked' : ''}> High contrast</label><label class="idk-platform-check"><input type="checkbox" data-a="reduceMotion" ${accessibility.reduceMotion ? 'checked' : ''}> Reduce motion</label><label class="idk-platform-check"><input type="checkbox" data-a="largeText" ${accessibility.largeText ? 'checked' : ''}> Larger text</label><div class="idk-platform-actions"><button class="btn" type="button" data-save>Apply preferences</button><button class="btn tab" type="button" data-profiles>Desktop profiles</button>${installPrompt ? '<button class="btn tab" type="button" data-install>Install IDK</button>' : ''}</div><p class="idk-next-note">Keyboard: Ctrl/Cmd+Shift+P opens the command palette. The desktop also adapts to narrow touch screens.</p>`;
    body.querySelector('[data-locale]').value = read(LOCALE_KEY, 'en');
    body.querySelector('[data-save]').onclick = () => { body.querySelectorAll('[data-a]').forEach(input => { accessibility[input.dataset.a] = input.checked; }); write('idkAccessibility', accessibility); write(LOCALE_KEY, body.querySelector('[data-locale]').value); applyPreferences(); root.remove(); notify('Preferences', 'Preferences applied.', 'success'); };
    body.querySelector('[data-profiles]').onclick = () => { root.remove(); openProfiles(); };
    body.querySelector('[data-install]')?.addEventListener('click', async () => { await installPrompt.prompt(); installPrompt = null; root.remove(); });
    return root;
  }

  function openCommandPalette() {
    const root = modal('idk-command-palette', 'Command Palette', 'Jump anywhere in IDK');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<input class="field" data-query placeholder="Search commands…" autofocus><div class="idk-command-results" data-results></div>';
    const input = body.querySelector('[data-query]'), results = body.querySelector('[data-results]');
    const commands = [
      ['Safety Center', () => window.IDKPlatformNext?.openSafetyCenter?.()], ['App Manager', () => window.IDKPlatformNext?.openAppManager?.()], ['Sync Conflicts', () => window.IDKPlatformNext?.openSyncConflicts?.()], ['Discover Apps', () => window.IDKPlatformNext?.openDiscovery?.()], ['Echo Automations', () => window.IDKPlatformNext?.openAutomationManager?.()], ['Security & Privacy', openSecurityCenter], ['Data & Recovery', openRecoveryCenter], ['Developer Console', openDeveloperConsole], ['Creator Studio', openCreatorStudio], ['Desktop Profiles', openProfiles], ['IDK Preferences', openPreferences], ['Built-in App Permissions', () => window.OS?.open?.('permissions')], ['Full Backup & Restore', () => window.IDKBackup?.open?.()], ['Unified Search', () => window.IDKUnifiedSearch?.open?.()]
    ];
    const render = () => { const query = input.value.trim().toLowerCase(); results.replaceChildren(...commands.filter(([name]) => !query || name.toLowerCase().includes(query)).map(([name, action]) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'idk-command-item'; button.innerHTML = `<strong>${esc(name)}</strong><small>Open IDK tool</small>`; button.onclick = () => { root.remove(); action(); }; return button; })); };
    input.oninput = render; input.onkeydown = event => { if (event.key === 'Escape') root.remove(); }; render(); setTimeout(() => input.focus(), 20);
    return root;
  }

  function wrapOfflineSync() {
    const account = window.IDKAccount;
    if (!account || typeof account.sync !== 'function' || account.sync.__idkPolishWrapped) return;
    const original = account.sync.bind(account);
    const wrapped = async (...args) => { if (!navigator.onLine) { const queue = read(QUEUE_KEY, []); queue.push({ at: Date.now(), type: 'account-sync' }); write(QUEUE_KEY, queue.slice(-20)); return false; } const result = await original(...args); if (result) write(QUEUE_KEY, []); return result; };
    wrapped.__idkPolishWrapped = true;
    account.sync = wrapped;
  }

  function installOfflineState() {
    const badge = document.createElement('button');
    badge.id = 'idk-offline-badge'; badge.type = 'button'; badge.title = 'Offline status';
    badge.onclick = () => notify('Offline mode', navigator.onLine ? 'You are online. Local changes sync normally.' : `${read(QUEUE_KEY, []).length} sync item${read(QUEUE_KEY, []).length === 1 ? '' : 's'} queued until connection returns.`);
    document.body.append(badge);
    const update = () => { badge.textContent = navigator.onLine ? 'Online' : 'Offline'; badge.classList.toggle('offline', !navigator.onLine); document.body.classList.toggle('idk-offline', !navigator.onLine); if (navigator.onLine && read(QUEUE_KEY, []).length) window.IDKAccount?.sync?.(); };
    window.addEventListener('online', update); window.addEventListener('offline', update); update();
  }

  function installTools() {
    const tools = document.getElementById('idk-os-next-tools');
    if (!tools || tools.querySelector('[data-polish-tool]')) return;
    tools.insertAdjacentHTML('beforeend', '<button type="button" data-polish-tool="security" title="Security and Privacy">S<span>Security</span></button><button type="button" data-polish-tool="recovery" title="Data and Recovery">R<span>Recovery</span></button><button type="button" data-polish-tool="developer" title="Developer Console">D<span>Developer</span></button><button type="button" data-polish-tool="preferences" title="IDK Preferences">P<span>Settings</span></button>');
    tools.addEventListener('click', event => { const action = event.target.closest('[data-polish-tool]')?.dataset.polishTool; if (action === 'security') openSecurityCenter(); if (action === 'recovery') openRecoveryCenter(); if (action === 'developer') openDeveloperConsole(); if (action === 'preferences') openPreferences(); });
  }

  function registerServiceWorker() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('idk-offline-sw.js').catch(() => {}); }

  function install() {
    applyPreferences();
    installTools();
    installOfflineState();
    wrapOfflineSync();
    window.addEventListener('beforeunload', () => snapshotState('Automatic exit snapshot'), { once: true });
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
    document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); openCommandPalette(); } });
    registerServiceWorker();
    setTimeout(() => refreshTrust().catch(() => {}), 1200);
  }

  window.IDKPlatformPolish = { openSecurityCenter, openRecoveryCenter, openDeveloperConsole, openCreatorStudio, openProfiles, openPreferences, openCommandPalette, snapshotState, refreshTrust };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

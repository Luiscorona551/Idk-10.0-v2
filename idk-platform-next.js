(() => {
  'use strict';
  if (window.IDKPlatformNext) return;

  const read = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const PERMISSION_KEY = 'idkAppPermissions';
  const SAFETY_KEY = 'idkProgramSafety';
  const HISTORY_KEY = 'idkProgramVersions';
  const AUTOMATIONS_KEY = 'idkEchoAutomations';
  const BASELINE_KEY = 'idkLastSyncedDesktop';

  function modal(idValue, title, subtitle = 'IDK Platform') {
    document.getElementById(idValue)?.remove();
    const root = document.createElement('section');
    root.id = idValue;
    root.className = 'idk-next-modal idk-platform-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<div class="idk-next-card"><header class="idk-next-head"><div><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></div><button type="button" data-close aria-label="Close">×</button></header><div class="idk-next-body"></div></div>`;
    root.querySelector('[data-close]').onclick = () => root.remove();
    document.body.append(root);
    return root;
  }

  function activeApps() {
    try { return typeof APPS === 'object' && APPS ? APPS : {}; } catch { return {}; }
  }

  function appPermissionState(appId) {
    return window.IDKPermissions?.get?.(appId) || { open: true, storage: true, notifications: true, network: true, microphone: false, camera: false };
  }

  function riskScan(program) {
    const html = String(program?.html || '');
    const risks = [];
    if (/<script\b/i.test(html)) risks.push('runs JavaScript');
    if (/(fetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\/)/i.test(html)) risks.push('may use the network');
    if (/(eval\s*\(|new\s+Function|document\.cookie)/i.test(html)) risks.push('uses dynamic browser APIs');
    if (/<iframe\b/i.test(html)) risks.push('embeds another page');
    return risks.length ? risks : ['self-contained HTML'];
  }

  function safetyState() { const value = read(SAFETY_KEY, {}); return value && typeof value === 'object' ? value : {}; }
  function isApproved(program) { return Boolean(safetyState()[program?.id]?.approved); }
  function setApproved(program, allowed) {
    const value = safetyState();
    value[program.id] = { approved: Boolean(allowed), at: Date.now(), risks: riskScan(program) };
    write(SAFETY_KEY, value);
  }

  function openSafetyCenter(focusProgram = null) {
    const root = modal('idk-safety-center', 'Safety Center', 'Permissions, app launch approvals, and recovery');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<div class="idk-platform-tabs"><button type="button" data-tab="apps">Apps</button><button type="button" data-tab="permissions">Permissions</button><button type="button" data-tab="recovery">Recovery</button></div><div data-pane></div>';
    const pane = body.querySelector('[data-pane]');
    const tabs = body.querySelectorAll('[data-tab]');
    const renderApps = () => {
      const programs = read('idkInstalledPrograms', []);
      pane.innerHTML = '<p class="idk-next-note">Installed HTML programs must be approved before they launch. Review the detected capabilities before allowing one.</p><div class="idk-platform-list" data-list></div>';
      const list = pane.querySelector('[data-list]');
      if (!programs.length) list.innerHTML = '<p class="idk-next-empty">No installed HTML programs.</p>';
      programs.forEach(program => {
        const card = document.createElement('article');
        const approved = isApproved(program);
        card.className = 'idk-platform-card';
        card.innerHTML = `<div><strong>${esc(program.icon || '[]')} ${esc(program.name)}</strong><small>v${esc(program.version || 'local')} · ${approved ? 'Launch allowed' : 'Review required'}</small><p>${riskScan(program).map(esc).join(' · ')}</p></div><div class="idk-platform-actions"></div>`;
        const actions = card.querySelector('.idk-platform-actions');
        const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = approved ? 'btn tab' : 'btn'; toggle.textContent = approved ? 'Block launch' : 'Allow launch';
        toggle.onclick = () => { setApproved(program, !approved); renderApps(); };
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn tab'; remove.textContent = 'Remove approval'; remove.disabled = !approved;
        remove.onclick = () => { setApproved(program, false); renderApps(); };
        actions.append(toggle, remove);
        list.append(card);
      });
    };
    const renderPermissions = () => {
      const apps = activeApps();
      pane.innerHTML = '<p class="idk-next-note">Built-in apps use the existing IDK permission controls. Changes stay on this device and can be reset here.</p><div class="idk-platform-permissions" data-list></div><div class="idk-platform-actions"><button class="btn tab" type="button" data-open-permissions>Open detailed permissions</button><button class="btn tab" type="button" data-reset-permissions>Reset permissions</button></div>';
      const list = pane.querySelector('[data-list]');
      Object.entries(apps).filter(([appId]) => !['panic', 'player'].includes(appId)).slice(0, 40).forEach(([appId, app]) => {
        const state = appPermissionState(appId);
        const row = document.createElement('article'); row.className = 'idk-platform-card';
        row.innerHTML = `<div><strong>${esc(app.title)}</strong><small>${Object.entries(state).filter(([, allowed]) => allowed).map(([name]) => name).join(', ') || 'No permissions allowed'}</small></div><span class="idk-platform-badge">${state.open === false ? 'Blocked' : 'Available'}</span>`;
        list.append(row);
      });
      pane.querySelector('[data-open-permissions]').onclick = () => { root.remove(); window.OS?.open?.('permissions'); };
      pane.querySelector('[data-reset-permissions]').onclick = () => { localStorage.removeItem(PERMISSION_KEY); notify('Safety Center', 'Built-in app permissions were reset.'); renderPermissions(); };
    };
    const renderRecovery = () => {
      const updates = read('idkPendingAppUpdates', []);
      pane.innerHTML = `<p class="idk-next-note">Backups protect local settings and stored files. App versions can be managed separately.</p><div class="idk-platform-card"><div><strong>${updates.length} pending app update${updates.length === 1 ? '' : 's'}</strong><small>Review updates before installing them.</small></div></div><div class="idk-platform-actions"><button class="btn" type="button" data-backup>Open Backup & Restore</button><button class="btn tab" type="button" data-manager>Open App Manager</button></div>`;
      pane.querySelector('[data-backup]').onclick = () => window.IDKBackup?.open?.();
      pane.querySelector('[data-manager]').onclick = () => { root.remove(); openAppManager(); };
    };
    const render = tab => { tabs.forEach(button => button.classList.toggle('active', button.dataset.tab === tab)); if (tab === 'permissions') renderPermissions(); else if (tab === 'recovery') renderRecovery(); else renderApps(); };
    tabs.forEach(button => { button.onclick = () => render(button.dataset.tab); });
    render(focusProgram ? 'apps' : 'apps');
    return root;
  }

  function openProgramSafety(program, shortcut) {
    const root = modal('idk-program-safety', `Review ${program.name}`, 'Launch approval required');
    const body = root.querySelector('.idk-next-body');
    const risks = riskScan(program);
    body.innerHTML = `<p class="idk-next-note">This program will open in a separate browser tab. IDK cannot verify code supplied by another person, so review the capabilities before allowing it.</p><div class="idk-platform-risk"><strong>Detected capabilities</strong><ul>${risks.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div><label class="idk-platform-check"><input type="checkbox" data-remember> Remember this approval on this device</label><div class="idk-platform-actions"><button class="btn" type="button" data-once>Launch once</button><button class="btn tab" type="button" data-allow>Allow future launches</button><button class="btn tab" type="button" data-cancel>Cancel</button></div>`;
    const launch = remember => {
      if (remember) setApproved(program, true);
      root.remove();
      if (shortcut) { shortcut.dataset.idkSafetyBypass = 'true'; setTimeout(() => { shortcut.click(); delete shortcut.dataset.idkSafetyBypass; }, 0); }
    };
    body.querySelector('[data-once]').onclick = () => launch(false);
    body.querySelector('[data-allow]').onclick = () => launch(true);
    body.querySelector('[data-cancel]').onclick = () => root.remove();
    return root;
  }

  function guardProgramLaunch() {
    document.addEventListener('click', event => {
      const shortcut = event.target.closest?.('[data-installer-program]');
      if (!shortcut || shortcut.dataset.idkSafetyBypass === 'true') return;
      const program = read('idkInstalledPrograms', []).find(item => String(item.id) === shortcut.dataset.installerProgram);
      if (!program || isApproved(program)) return;
      event.preventDefault();
      event.stopPropagation();
      openProgramSafety(program, shortcut);
    }, true);
  }

  function versions() { const value = read(HISTORY_KEY, {}); return value && typeof value === 'object' ? value : {}; }
  function compareVersion(a, b) {
    const left = String(a || '0').split('.').map(part => Number(part.replace(/\D.*$/, '')) || 0);
    const right = String(b || '0').split('.').map(part => Number(part.replace(/\D.*$/, '')) || 0);
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) { if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) - (right[index] || 0); }
    return 0;
  }

  function openProgramDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB is unavailable.'));
      const request = indexedDB.open('idkInstalledProgramsDB', 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('programs')) request.result.createObjectStore('programs'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Program storage unavailable.'));
    });
  }

  async function saveProgramBlob(programId, html) {
    const db = await openProgramDB();
    try { await new Promise((resolve, reject) => { const tx = db.transaction('programs', 'readwrite'); tx.objectStore('programs').put(new Blob([html], { type: 'text/html' }), programId); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
  }

  async function launchPublicProgram(program) {
    const db = await openProgramDB();
    const blob = await new Promise((resolve, reject) => { const request = db.transaction('programs', 'readonly').objectStore('programs').get(program.id); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); });
    db.close();
    if (!blob) throw new Error('The saved program file could not be found.');
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) notify('App Manager', 'Allow pop-ups for IDK 10.0 to launch this program.');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function addPublicShortcut(program) {
    const layer = document.getElementById('icons');
    if (!layer || !program?.id || layer.querySelector(`[data-installer-program="${CSS.escape(program.id)}"]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'idk-installed-shortcut';
    button.dataset.installerProgram = program.id;
    button.title = `Open ${program.name}`;
    button.innerHTML = `<span class="idk-installed-shortcut-icon">${esc(program.icon || '[]')}</span><span>${esc(program.name)}</span>`;
    button.onclick = async event => { event.preventDefault(); event.stopPropagation(); try { await launchPublicProgram(read('idkInstalledPrograms', []).find(item => item.id === program.id) || program); } catch (error) { notify('App Manager', error.message); } };
    layer.append(button);
  }

  async function catalog() {
    const response = await fetch('/api/store/programs', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'App Store is unavailable.');
    return Array.isArray(data.programs) ? data.programs : [];
  }

  async function updatePendingUpdates(remotePrograms) {
    const installed = read('idkInstalledPrograms', []);
    const pending = installed.map(local => {
      const remote = remotePrograms.find(item => item.id === local.id);
      return remote && compareVersion(remote.version, local.version) > 0 ? { id: local.id, name: local.name, from: local.version || 'local', to: remote.version } : null;
    }).filter(Boolean);
    write('idkPendingAppUpdates', pending);
    if (pending.length) notify('App Store', `${pending.length} app update${pending.length === 1 ? '' : 's'} available.`);
    return pending;
  }

  async function installOrUpdate(program, button = null) {
    if (button) button.disabled = true;
    try {
      const html = await fetch(program.contentUrl, { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error('Program content is unavailable.'); return response.text(); });
      const installed = read('idkInstalledPrograms', []);
      const current = installed.find(item => item.id === program.id);
      const history = versions();
      if (current && current.html) history[program.id] = [{ version: current.version || 'local', html: current.html, savedAt: Date.now() }, ...(history[program.id] || [])].slice(0, 10);
      write(HISTORY_KEY, history);
      const next = { id: program.id, name: program.name, icon: program.icon, version: program.version, fileName: `${program.name}.html`, html, installedAt: current?.installedAt || Date.now(), updatedAt: Date.now(), source: 'public-store', author: program.author, category: program.category };
      write('idkInstalledPrograms', [next, ...installed.filter(item => item.id !== program.id)]);
      await saveProgramBlob(program.id, html);
      addPublicShortcut(next);
      setApproved(next, false);
      write('idkPendingAppUpdates', read('idkPendingAppUpdates', []).filter(item => item.id !== program.id));
      notify('App Store', `${program.name} ${current ? 'updated' : 'installed'} successfully.`, 'success');
      if (button) button.textContent = current ? 'Updated' : 'Installed';
      return next;
    } catch (error) {
      notify('App Store', error.message || 'The program could not be installed.');
      if (button) button.disabled = false;
      return null;
    }
  }

  function rollbackProgram(program, version, root) {
    const history = versions();
    const entry = (history[program.id] || []).find(item => item.version === version && item.html);
    if (!entry) return;
    const current = read('idkInstalledPrograms', []).find(item => item.id === program.id);
    const nextHistory = { ...history, [program.id]: [{ version: current?.version || 'current', html: current?.html || '', savedAt: Date.now() }, ...(history[program.id] || []).filter(item => item !== entry)].filter(item => item.html).slice(0, 10) };
    const next = { ...program, version: entry.version, html: entry.html, updatedAt: Date.now() };
    write(HISTORY_KEY, nextHistory);
    write('idkInstalledPrograms', [next, ...read('idkInstalledPrograms', []).filter(item => item.id !== program.id)]);
    saveProgramBlob(program.id, entry.html).then(() => { notify('App Manager', `${program.name} rolled back to ${entry.version}.`, 'success'); root.remove(); openAppManager(); }).catch(error => notify('App Manager', error.message));
  }

  function openAppManager() {
    const root = modal('idk-app-manager', 'App Manager', 'Versions, updates, rollback, and launch safety');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<p class="idk-next-note">Check the public catalog for newer versions. Previous public versions are kept locally so you can roll back without losing your current app.</p><div class="idk-platform-actions"><button class="btn" type="button" data-check>Check for updates</button><button class="btn tab" type="button" data-safety>Safety Center</button><button class="btn tab" type="button" data-discover>Discover apps</button></div><p class="idk-platform-status" data-status>Not checked yet.</p><div class="idk-platform-list" data-list></div>';
    const list = body.querySelector('[data-list]'), status = body.querySelector('[data-status]');
    let remotePrograms = [];
    const render = () => {
      const installed = read('idkInstalledPrograms', []);
      list.replaceChildren();
      if (!installed.length) { list.innerHTML = '<p class="idk-next-empty">No installed programs yet.</p>'; return; }
      installed.forEach(program => {
        const remote = remotePrograms.find(item => item.id === program.id);
        const available = remote && compareVersion(remote.version, program.version) > 0;
        const card = document.createElement('article'); card.className = 'idk-platform-card';
        card.innerHTML = `<div><strong>${esc(program.icon || '[]')} ${esc(program.name)}</strong><small>Installed v${esc(program.version || 'local')}${available ? ` · update v${esc(remote.version)} available` : ''}</small><p>${(versions()[program.id] || []).length} rollback point${(versions()[program.id] || []).length === 1 ? '' : 's'}</p></div><div class="idk-platform-actions"></div>`;
        const actions = card.querySelector('.idk-platform-actions');
        if (available) { const update = document.createElement('button'); update.type = 'button'; update.className = 'btn'; update.textContent = 'Update'; update.onclick = () => installOrUpdate(remote, update).then(render); actions.append(update); }
        (versions()[program.id] || []).filter(item => item.html).slice(0, 3).forEach(entry => { const rollback = document.createElement('button'); rollback.type = 'button'; rollback.className = 'btn tab'; rollback.textContent = `Rollback ${entry.version}`; rollback.onclick = () => rollbackProgram(program, entry.version, root); actions.append(rollback); });
        const safety = document.createElement('button'); safety.type = 'button'; safety.className = 'btn tab'; safety.textContent = isApproved(program) ? 'Launch allowed' : 'Review safety'; safety.onclick = () => openSafetyCenter(program); actions.append(safety);
        list.append(card);
      });
    };
    body.querySelector('[data-check]').onclick = async () => { status.textContent = 'Checking App Store…'; try { remotePrograms = await catalog(); const pending = await updatePendingUpdates(remotePrograms); status.textContent = pending.length ? `${pending.length} update${pending.length === 1 ? '' : 's'} available.` : 'All installed apps are current.'; render(); } catch (error) { status.textContent = error.message; } };
    body.querySelector('[data-safety]').onclick = () => openSafetyCenter();
    body.querySelector('[data-discover]').onclick = () => { root.remove(); openDiscovery(); };
    render();
    return root;
  }

  function openDiscovery() {
    const root = modal('idk-app-discovery', 'App Store Discovery', 'Featured apps, categories, creators, and ratings');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<div class="idk-discovery-toolbar"><input class="field" data-query type="search" placeholder="Search apps, creators, or categories"><select class="field" data-category><option value="all">All categories</option></select><select class="field" data-sort><option value="featured">Featured</option><option value="newest">Newest</option><option value="rating">Highest rated</option></select></div><p class="idk-platform-status" data-status>Loading catalog…</p><div class="idk-discovery-grid" data-grid></div>';
    const query = body.querySelector('[data-query]'), category = body.querySelector('[data-category]'), sort = body.querySelector('[data-sort]'), status = body.querySelector('[data-status]'), grid = body.querySelector('[data-grid]');
    let programs = [];
    const render = () => {
      const q = query.value.trim().toLowerCase();
      const selected = category.value;
      let items = programs.filter(item => (selected === 'all' || item.category === selected) && (!q || `${item.name} ${item.author} ${item.category}`.toLowerCase().includes(q)));
      if (sort.value === 'rating') items.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.ratingCount || 0) - (a.ratingCount || 0));
      else if (sort.value === 'newest') items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      else items.sort((a, b) => ((b.rating || 0) * Math.min(1, (b.ratingCount || 0) / 5)) - ((a.rating || 0) * Math.min(1, (a.ratingCount || 0) / 5)) || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      grid.replaceChildren();
      if (!items.length) { grid.innerHTML = '<p class="idk-next-empty">No matching apps in the public catalog.</p>'; return; }
      items.forEach(program => {
        const installed = read('idkInstalledPrograms', []).find(item => item.id === program.id);
        const card = document.createElement('article'); card.className = 'idk-discovery-card';
        card.innerHTML = `${program.screenshot ? `<img src="${esc(program.screenshot)}" alt="" loading="lazy">` : '<div class="idk-discovery-art">IDK</div>'}<strong>${esc(program.icon || '[]')} ${esc(program.name)}</strong><small>${esc(program.category)} · v${esc(program.version || '1.0.0')}</small><button type="button" class="idk-discovery-author">by ${esc(program.author || 'IDK creator')}</button><small>${program.ratingCount ? `${Number(program.rating || 0).toFixed(1)} / 5 · ${program.ratingCount} rating${program.ratingCount === 1 ? '' : 's'}` : 'No ratings yet'}</small><div class="idk-platform-actions"></div>`;
        const actions = card.querySelector('.idk-platform-actions');
        const open = document.createElement('a'); open.className = 'btn tab'; open.href = program.contentUrl; open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'Open'; actions.append(open);
        const install = document.createElement('button'); install.type = 'button'; install.className = 'btn'; install.textContent = installed ? (compareVersion(program.version, installed.version) > 0 ? 'Update' : 'Installed') : 'Install'; install.disabled = install.textContent === 'Installed'; install.onclick = () => installOrUpdate(program, install).then(render); actions.append(install);
        const rate = document.createElement('button'); rate.type = 'button'; rate.className = 'btn tab'; rate.textContent = 'Rate'; rate.onclick = async () => { const value = Number(prompt('Rate this app from 1 to 5', '5')); if (!Number.isInteger(value) || value < 1 || value > 5) return; const response = await fetch(`/api/store/programs/${encodeURIComponent(program.id)}/rating`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating: value }) }).catch(() => null); notify('App Store', response?.ok ? 'Rating submitted.' : 'Rating service unavailable.'); };
        actions.append(rate);
        card.querySelector('.idk-discovery-author').onclick = () => { query.value = program.author || ''; render(); };
        grid.append(card);
      });
    };
    query.oninput = render; category.onchange = render; sort.onchange = render;
    catalog().then(value => { programs = value; [...new Set(value.map(item => item.category).filter(Boolean))].sort().forEach(item => category.append(new Option(item, item))); status.textContent = `${value.length} public app${value.length === 1 ? '' : 's'} available.`; updatePendingUpdates(value); render(); }).catch(error => { status.textContent = error.message; grid.replaceChildren(); });
    return root;
  }

  function workspacePresets() {
    return {
      Work: { theme: 'ocean', apps: ['calendar', 'todo', 'notes', 'mail'] },
      School: { theme: 'forest', apps: ['calendar', 'todo', 'notes', 'files'] },
      Gaming: { theme: 'neon', apps: ['games', 'music', 'chat'] },
      Personal: { theme: 'sunset', apps: ['calendar', 'mail', 'files', 'notes'] }
    };
  }

  function presetWorkspace(name) {
    const preset = workspacePresets()[name];
    if (!preset) return;
    const apps = activeApps();
    const windows = preset.apps.filter(appId => apps[appId]).map((appId, index) => ({ appId, left: `${80 + (index % 3) * 44}px`, top: `${92 + Math.floor(index / 3) * 36}px`, width: `${apps[appId].width || 560}px`, height: `${apps[appId].height || 440}px`, classes: [] }));
    const item = { id: `preset-${name.toLowerCase()}`, name, createdAt: Date.now(), updatedAt: Date.now(), windows, widgets: [], theme: preset.theme, wallpaper: null, iconSize: 'normal', dockPosition: 'bottom', preset: true };
    const current = read('idkSmartWorkspaces', []).filter(value => value.id !== item.id);
    write('idkSmartWorkspaces', [item, ...current].slice(0, 12));
    if (item.theme) localStorage.setItem('theme', item.theme);
    write('idkDesktopWidgets', []);
    write('idkWorkspace', []);
    write('idkSmartWorkspacePending', item);
    notify('Smart Workspaces', `${name} preset is ready. Restarting the desktop…`);
    setTimeout(() => location.reload(), 350);
  }

  function enhanceWorkspaceModal(root) {
    if (!root || root.dataset.idkPlatformPresets) return;
    root.dataset.idkPlatformPresets = 'true';
    const body = root.querySelector('.idk-next-body');
    const panel = document.createElement('div'); panel.className = 'idk-platform-preset-panel'; panel.innerHTML = '<strong>Start from a preset</strong><small>Apply a focused desktop layout, then customize and save it.</small><div class="idk-platform-actions"></div>';
    const actions = panel.querySelector('.idk-platform-actions');
    Object.keys(workspacePresets()).forEach(name => { const button = document.createElement('button'); button.type = 'button'; button.className = 'btn tab'; button.textContent = name; button.onclick = () => presetWorkspace(name); actions.append(button); });
    body.insertBefore(panel, body.querySelector('.idk-workspace-list'));
  }

  function automations() { const value = read(AUTOMATIONS_KEY, []); return Array.isArray(value) ? value : []; }
  function saveAutomations(value) { write(AUTOMATIONS_KEY, value.slice(0, 30)); }
  function runAutomation(routine) {
    if (!routine) return;
    if (routine.action === 'organize') { const message = window.IDKEcho?.organizeFiles?.() || 'Files organized.'; notify('Echo Automation', message, 'success'); }
    else if (routine.action === 'backup') window.IDKBackup?.open?.();
    else if (routine.action === 'workspace') { const item = read('idkSmartWorkspaces', []).find(value => value.name === routine.workspace); if (item) { localStorage.setItem('theme', item.theme || 'midnight'); write('idkDesktopWidgets', item.widgets || []); write('idkWorkspace', []); write('idkSmartWorkspacePending', item); location.reload(); } else notify('Echo Automation', 'Save that workspace before running this routine.'); }
    else notify('Echo Automation', routine.message || 'Routine completed.');
  }

  function openAutomationManager() {
    const root = modal('idk-echo-automations', 'Echo Automations', 'Small routines that stay on this device');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<p class="idk-next-note">Create simple local routines. Startup routines run once after IDK loads; all other routines run only when you press Run.</p><form class="idk-automation-form"><input class="field" name="name" required maxlength="48" placeholder="Routine name"><select class="field" name="trigger"><option value="manual">Manual</option><option value="startup">On startup</option></select><select class="field" name="action"><option value="organize">Organize Files</option><option value="backup">Open Backup & Restore</option><option value="workspace">Open a workspace preset</option><option value="message">Show a reminder</option></select><input class="field" name="workspace" maxlength="48" placeholder="Workspace name (for workspace action)"><input class="field" name="message" maxlength="120" placeholder="Reminder text (for message action)"><button class="btn" type="submit">Add routine</button></form><div class="idk-platform-list" data-list></div>';
    const list = body.querySelector('[data-list]');
    const render = () => { list.replaceChildren(); const rows = automations(); if (!rows.length) list.innerHTML = '<p class="idk-next-empty">No routines yet.</p>'; rows.forEach(routine => { const card = document.createElement('article'); card.className = 'idk-platform-card'; card.innerHTML = `<div><strong>${esc(routine.name)}</strong><small>${esc(routine.trigger)} · ${esc(routine.action)}</small></div><div class="idk-platform-actions"></div>`; const actions = card.querySelector('.idk-platform-actions'); const run = document.createElement('button'); run.type = 'button'; run.className = 'btn'; run.textContent = 'Run'; run.onclick = () => runAutomation(routine); const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'btn tab'; toggle.textContent = routine.enabled === false ? 'Enable' : 'Disable'; toggle.onclick = () => { routine.enabled = routine.enabled === false; saveAutomations(rows); render(); }; const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn tab'; remove.textContent = 'Delete'; remove.onclick = () => { saveAutomations(rows.filter(value => value.id !== routine.id)); render(); }; actions.append(run, toggle, remove); list.append(card); }); };
    body.querySelector('form').onsubmit = event => { event.preventDefault(); const data = new FormData(event.currentTarget); const rows = automations(); rows.unshift({ id: id(), name: data.get('name'), trigger: data.get('trigger'), action: data.get('action'), workspace: data.get('workspace'), message: data.get('message'), enabled: true, createdAt: Date.now() }); saveAutomations(rows); event.currentTarget.reset(); render(); };
    render();
    return root;
  }

  async function openSyncConflicts() {
    const root = modal('idk-sync-conflicts', 'Sync Conflict Manager', 'Review local and cloud changes before choosing a side');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<p class="idk-platform-status" data-status>Checking account sync…</p><div class="idk-platform-list" data-list></div>';
    const status = body.querySelector('[data-status]'), list = body.querySelector('[data-list]');
    if (!window.IDKAccount?.user) { status.textContent = 'Sign in to compare this desktop with cloud data.'; return root; }
    try {
      const response = await fetch('/api/account/state', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error('Cloud state is unavailable.');
      const remote = data.state?.desktop?.localStorage || {};
      const local = {}; for (let index = 0; index < localStorage.length; index += 1) { const key = localStorage.key(index); if (key && key !== 'idkAccountSession') local[key] = localStorage.getItem(key); }
      const baseline = read(BASELINE_KEY, {});
      const keys = [...new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(baseline)])];
      const conflicts = keys.filter(key => local[key] !== remote[key] && local[key] !== baseline[key] && remote[key] !== baseline[key]);
      status.textContent = conflicts.length ? `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} need a decision.` : 'No two-sided conflicts found.';
      if (!conflicts.length) { list.innerHTML = '<p class="idk-next-empty">Local and cloud data are aligned, or only one side has changed.</p>'; return root; }
      conflicts.forEach(key => { const card = document.createElement('article'); card.className = 'idk-platform-card'; card.innerHTML = `<div><strong>${esc(key)}</strong><small>Local: ${esc(String(local[key] ?? 'missing').slice(0, 100))}</small><small>Cloud: ${esc(String(remote[key] ?? 'missing').slice(0, 100))}</small></div><div class="idk-platform-actions"></div>`; const actions = card.querySelector('.idk-platform-actions'); const keepLocal = document.createElement('button'); keepLocal.type = 'button'; keepLocal.className = 'btn'; keepLocal.textContent = 'Keep local'; keepLocal.onclick = async () => { await window.IDKAccount.sync(); write(BASELINE_KEY, local); card.remove(); notify('Sync', `${key} kept locally.`, 'success'); }; const useCloud = document.createElement('button'); useCloud.type = 'button'; useCloud.className = 'btn tab'; useCloud.textContent = 'Use cloud'; useCloud.onclick = async () => { await window.IDKAccount.restore(); location.reload(); }; actions.append(keepLocal, useCloud); list.append(card); });
    } catch (error) { status.textContent = error.message; }
    return root;
  }

  function recordBaseline(event) { const state = event.detail?.state?.desktop?.localStorage; if (state && typeof state === 'object') write(BASELINE_KEY, state); }
  function enhanceEcho(root) {
    if (!root || root.dataset.idkPlatformEcho) return;
    root.dataset.idkPlatformEcho = 'true';
    const actions = root.querySelector('.idk-echo-actions');
    if (actions && !actions.querySelector('[data-platform-echo]')) { const button = document.createElement('button'); button.type = 'button'; button.dataset.platformEcho = 'true'; button.textContent = 'Automations'; button.onclick = openAutomationManager; actions.append(button); }
    const form = root.querySelector('form');
    form?.addEventListener('submit', event => { const input = form.querySelector('input'); if (/autom|routine|sync conflict/i.test(input?.value || '')) { event.preventDefault(); event.stopImmediatePropagation(); input.value = ''; openAutomationManager(); } }, true);
  }

  function installTools() {
    const tools = document.getElementById('idk-os-next-tools');
    if (!tools || tools.querySelector('[data-platform-tool]')) return;
    tools.insertAdjacentHTML('beforeend', '<button type="button" data-platform-tool="safety" title="Safety Center">!<span>Safety</span></button><button type="button" data-platform-tool="manager" title="App Manager">↑<span>Apps</span></button><button type="button" data-platform-tool="sync" title="Sync Conflicts">⇄<span>Sync</span></button><button type="button" data-platform-tool="discover" title="Discover Apps">+<span>Store</span></button>');
    tools.addEventListener('click', event => { const action = event.target.closest('[data-platform-tool]')?.dataset.platformTool; if (action === 'safety') openSafetyCenter(); if (action === 'manager') openAppManager(); if (action === 'sync') openSyncConflicts(); if (action === 'discover') openDiscovery(); });
  }

  function installWorkspaceObserver() {
    const observer = new MutationObserver(() => { document.querySelectorAll('#idk-smart-workspaces').forEach(enhanceWorkspaceModal); document.querySelectorAll('#idk-echo-popout').forEach(enhanceEcho); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function runStartupAutomations() {
    automations().filter(item => item.enabled !== false && item.trigger === 'startup').forEach(runAutomation);
  }

  function install() {
    installTools();
    guardProgramLaunch();
    installWorkspaceObserver();
    window.addEventListener('idk-account-restored', recordBaseline);
    document.querySelectorAll('#idk-smart-workspaces').forEach(enhanceWorkspaceModal);
    document.querySelectorAll('#idk-echo-popout').forEach(enhanceEcho);
    setTimeout(runStartupAutomations, 1400);
  }

  window.IDKPlatformNext = { openSafetyCenter, openAppManager, openDiscovery, openAutomationManager, openSyncConflicts, applyWorkspacePreset: presetWorkspace, checkForUpdates: async () => updatePendingUpdates(await catalog()) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

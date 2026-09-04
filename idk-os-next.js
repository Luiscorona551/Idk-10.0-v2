(() => {
  'use strict';
  if (window.IDKOSNext) return;

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const WORKSPACES_KEY = 'idkSmartWorkspaces';
  const CLIPBOARD_KEY = 'idkClipboardHistory';
  const TIMELINE_KEY = 'idkSystemTimeline';
  let modalRoot;

  function openModal(idValue, title, className = '') {
    document.getElementById(idValue)?.remove();
    const root = document.createElement('section');
    root.id = idValue;
    root.className = `idk-next-modal ${className}`;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<div class="idk-next-card"><header class="idk-next-head"><div><strong>${esc(title)}</strong><small>IDK OS tools</small></div><button type="button" data-close aria-label="Close">×</button></header><div class="idk-next-body"></div></div>`;
    root.querySelector('[data-close]').onclick = () => root.remove();
    document.body.append(root);
    modalRoot = root;
    return root;
  }

  function timeline(title, message, kind = 'system') {
    const items = read(TIMELINE_KEY, []);
    items.unshift({ id: id(), title, message, kind, at: Date.now() });
    write(TIMELINE_KEY, items.slice(0, 120));
    window.dispatchEvent(new CustomEvent('idk-timeline', { detail: { title, message, kind } }));
  }

  function normalizeTimeline() {
    const saved = read(TIMELINE_KEY, []);
    const activity = read('idkActivityHistory', []);
    const combined = [
      ...(Array.isArray(saved) ? saved : []),
      ...(Array.isArray(activity) ? activity.map(item => ({ ...item, message: item.message, kind: item.kind || 'system' })) : [])
    ];
    const seen = new Set();
    return combined.filter(item => {
      const key = `${item.title}|${item.message}|${item.at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return item.title && item.message;
    }).sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
  }

  function timelineView() {
    const root = document.createElement('div');
    root.className = 'idk-timeline-app';
    root.innerHTML = '<div class="idk-timeline-toolbar"><input class="field" data-search type="search" placeholder="Search activity…" aria-label="Search activity"><select class="field" data-filter aria-label="Filter timeline"><option value="all">All activity</option><option value="system">System</option><option value="workspace">Workspaces</option><option value="clipboard">Clipboard</option><option value="files">Files</option><option value="apps">Apps</option></select><button class="btn tab" type="button" data-export>Export</button><button class="btn tab" type="button" data-clear>Clear</button></div><div class="idk-timeline-list" data-list></div>';
    const list = root.querySelector('[data-list]');
    const render = () => {
      const query = root.querySelector('[data-search]').value.trim().toLowerCase();
      const filter = root.querySelector('[data-filter]').value;
      const items = normalizeTimeline().filter(item => {
        const matchesFilter = filter === 'all' || item.kind === filter;
        const matchesQuery = !query || `${item.title} ${item.message}`.toLowerCase().includes(query);
        return matchesFilter && matchesQuery;
      });
      list.replaceChildren();
      if (!items.length) {
        list.append(Object.assign(document.createElement('p'), { className: 'idk-timeline-empty', textContent: 'No matching activity yet.' }));
        return;
      }
      items.forEach(item => {
        const entry = document.createElement('article');
        entry.className = `idk-timeline-entry ${esc(item.kind || 'system')}`;
        entry.innerHTML = `<span class="idk-timeline-dot" aria-hidden="true"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.message)}</p><time>${new Date(item.at || Date.now()).toLocaleString()}</time></div>`;
        list.append(entry);
      });
    };
    root.querySelector('[data-search]').oninput = render;
    root.querySelector('[data-filter]').onchange = render;
    root.querySelector('[data-clear]').onclick = () => {
      if (!confirm('Clear the saved system timeline?')) return;
      write(TIMELINE_KEY, []);
      window.OS?.clearActivity?.();
      render();
      notify('System Timeline', 'Timeline cleared.');
    };
    root.querySelector('[data-export]').onclick = () => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(normalizeTimeline(), null, 2)], { type: 'application/json' }));
      link.download = `idk-timeline-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    };
    window.addEventListener('idk-activity', render);
    window.addEventListener('idk-timeline', render);
    render();
    return root;
  }

  function windowSnapshot() {
    return [...document.querySelectorAll('#windows .window')].map(win => ({
      appId: win.dataset.app,
      title: win.querySelector('.title')?.textContent || '',
      left: win.style.left,
      top: win.style.top,
      width: win.style.width,
      height: win.style.height,
      classes: ['minimized', 'maximized', 'snapped-left', 'snapped-right'].filter(name => win.classList.contains(name))
    })).filter(item => item.appId);
  }

  function captureWorkspace(name, existing = null) {
    return {
      id: existing?.id || id(),
      name: name.trim() || existing?.name || 'My workspace',
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      windows: windowSnapshot(),
      widgets: read('idkDesktopWidgets', []),
      theme: localStorage.getItem('theme'),
      wallpaper: localStorage.getItem('wallpaper'),
      iconSize: localStorage.getItem('iconSize'),
      dockPosition: localStorage.getItem('dockPosition')
    };
  }

  function workspaces() {
    const value = read(WORKSPACES_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveWorkspace(name, existing = null) {
    const next = captureWorkspace(name, existing);
    const all = workspaces().filter(item => item.id !== next.id);
    all.unshift(next);
    write(WORKSPACES_KEY, all.slice(0, 12));
    timeline('Workspace saved', `${next.name} saved with ${next.windows.length} open app${next.windows.length === 1 ? '' : 's'}.`, 'workspace');
    notify('Smart Workspaces', `${next.name} is ready to restore.`);
  }

  function applyWorkspace(item) {
    if (!item) return;
    ['theme', 'wallpaper', 'iconSize', 'dockPosition'].forEach(key => {
      if (item[key] !== null && item[key] !== undefined) localStorage.setItem(key, item[key]);
    });
    write('idkDesktopWidgets', Array.isArray(item.widgets) ? item.widgets : []);
    write('idkWorkspace', []);
    write('idkSmartWorkspacePending', item);
    timeline('Workspace activated', `${item.name} will reopen on the next desktop start.`, 'workspace');
    location.reload();
  }

  async function restorePendingWorkspace() {
    const item = read('idkSmartWorkspacePending', null);
    if (!item) return;
    localStorage.removeItem('idkSmartWorkspacePending');
    document.querySelectorAll('#windows .window .close').forEach(button => button.click());
    const states = Array.isArray(item.windows) ? item.windows : [];
    const restored = [];
    for (const state of states) {
      if (!state.appId || !window.APPS?.[state.appId]) continue;
      await window.OS?.open?.(state.appId);
      const win = [...document.querySelectorAll('#windows .window')].find(value => value.dataset.app === state.appId);
      if (!win) continue;
      ['left', 'top', 'width', 'height'].forEach(key => { if (state[key]) win.style[key] = state[key]; });
      (state.classes || []).forEach(className => win.classList.add(className));
      restored.push(state);
    }
    write('idkWorkspace', restored);
    notify('Smart Workspaces', `${item.name} restored.`);
  }

  function workspaceView() {
    const root = openModal('idk-smart-workspaces', 'Smart Workspaces', 'idk-workspace-modal');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<p class="idk-next-note">Save a complete IDK setup: open apps, window positions, widgets, theme, wallpaper, and dock settings.</p><form class="idk-workspace-save"><input class="field" name="name" required maxlength="48" placeholder="Workspace name, e.g. Work or Gaming"><button class="btn" type="submit">Save current desktop</button></form><div class="idk-workspace-list" data-list></div>';
    const list = body.querySelector('[data-list]');
    const render = () => {
      list.replaceChildren();
      const all = workspaces();
      if (!all.length) list.append(Object.assign(document.createElement('p'), { className: 'idk-next-empty', textContent: 'No saved workspaces yet.' }));
      all.forEach(item => {
        const card = document.createElement('article');
        card.className = 'idk-workspace-card';
        card.innerHTML = `<div><strong>${esc(item.name)}</strong><small>${item.windows.length} apps · ${item.widgets.length} widgets · updated ${new Date(item.updatedAt).toLocaleString()}</small></div><div class="idk-next-actions"></div>`;
        const actions = card.querySelector('.idk-next-actions');
        const activate = document.createElement('button'); activate.className = 'btn'; activate.type = 'button'; activate.textContent = 'Activate'; activate.onclick = () => applyWorkspace(item);
        const update = document.createElement('button'); update.className = 'btn tab'; update.type = 'button'; update.textContent = 'Update'; update.onclick = () => { saveWorkspace(item.name, item); render(); };
        const rename = document.createElement('button'); rename.className = 'btn tab'; rename.type = 'button'; rename.textContent = 'Rename'; rename.onclick = () => { const name = prompt('Workspace name', item.name); if (name?.trim()) { saveWorkspace(name, item); render(); } };
        const remove = document.createElement('button'); remove.className = 'btn tab'; remove.type = 'button'; remove.textContent = 'Delete'; remove.onclick = () => { write(WORKSPACES_KEY, workspaces().filter(value => value.id !== item.id)); timeline('Workspace deleted', item.name, 'workspace'); render(); };
        actions.append(activate, update, rename, remove);
        list.append(card);
      });
    };
    body.querySelector('form').onsubmit = event => { event.preventDefault(); const form = event.currentTarget; saveWorkspace(form.name.value); form.reset(); render(); };
    render();
    return root;
  }

  function clipboardItems() {
    const value = read(CLIPBOARD_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function recordClipboard(text, source = 'copy') {
    const value = String(text || '').trim();
    if (!value) return;
    const next = [{ id: id(), text: value, source, at: Date.now() }, ...clipboardItems().filter(item => item.text !== value)].slice(0, 24);
    write(CLIPBOARD_KEY, next);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); recordClipboard(text, 'copy'); notify('Clipboard', 'Copied to the universal clipboard.'); }
    catch { window.prompt('Copy this text', text); }
  }

  function openShareSheet(seed = '') {
    const root = openModal('idk-share-sheet', 'Universal Clipboard', 'idk-share-modal');
    const body = root.querySelector('.idk-next-body');
    body.innerHTML = '<p class="idk-next-note">Keep recent text close, then send it to an IDK app without opening a full workflow first.</p><textarea class="field idk-share-text" data-text placeholder="Type or paste something to share…"></textarea><div class="idk-next-actions idk-share-actions"><button class="btn" type="button" data-copy>Copy</button><button class="btn tab" type="button" data-paste>Paste from clipboard</button><button class="btn tab" type="button" data-messenger>Share to Messenger</button><button class="btn tab" type="button" data-mail>Share to Mail</button><button class="btn tab" type="button" data-note>Save as note</button></div><h3>Recent clipboard</h3><div class="idk-clipboard-list" data-list></div>';
    const textarea = body.querySelector('[data-text]');
    textarea.value = seed || clipboardItems()[0]?.text || '';
    const current = () => textarea.value.trim();
    const list = body.querySelector('[data-list]');
    const render = () => {
      list.replaceChildren();
      clipboardItems().forEach(item => {
        const button = document.createElement('button');
        button.className = 'idk-clipboard-item'; button.type = 'button';
        button.innerHTML = `<strong>${esc(item.text.slice(0, 110))}</strong><small>${esc(item.source)} · ${new Date(item.at).toLocaleString()}</small>`;
        button.onclick = () => { textarea.value = item.text; };
        list.append(button);
      });
      if (!list.children.length) list.append(Object.assign(document.createElement('small'), { className: 'idk-next-empty', textContent: 'Nothing copied yet.' }));
    };
    body.querySelector('[data-copy]').onclick = () => { const value = current(); if (value) copyText(value); };
    body.querySelector('[data-paste]').onclick = async () => { try { textarea.value = await navigator.clipboard.readText(); recordClipboard(textarea.value, 'paste'); render(); } catch { notify('Clipboard', 'Paste permission is unavailable.'); } };
    body.querySelector('[data-messenger]').onclick = () => { const value = current(); if (!value) return; write('idkShareDraft', { type: 'text', text: value, at: Date.now() }); timeline('Shared to Messenger', 'A clipboard item was prepared for Messenger.', 'clipboard'); root.remove(); window.OS?.open?.('chat'); };
    body.querySelector('[data-mail]').onclick = () => { const value = current(); if (!value) return; write('idkMailDraft', { body: value, at: Date.now() }); timeline('Shared to Mail', 'A clipboard item was prepared for Mail.', 'clipboard'); root.remove(); window.OS?.open?.('mail'); };
    body.querySelector('[data-note]').onclick = () => { const value = current(); if (!value) return; const notes = read('idkRichNotes', []); notes.unshift({ id: id(), title: 'Clipboard note', text: value, tags: 'clipboard', updated: Date.now() }); write('idkRichNotes', notes.slice(0, 100)); timeline('Saved clipboard note', 'Clipboard text was saved to Notes.', 'clipboard'); notify('Clipboard', 'Saved as a note.'); };
    render();
    textarea.focus();
    return root;
  }

  function captureClipboard() {
    document.addEventListener('copy', () => setTimeout(() => recordClipboard(window.getSelection?.()?.toString(), 'copy'), 0), true);
    document.addEventListener('cut', () => setTimeout(() => recordClipboard(window.getSelection?.()?.toString(), 'cut'), 0), true);
    try {
      const clipboard = navigator.clipboard;
      if (clipboard?.writeText && !clipboard.writeText.__idkWrapped) {
        const original = clipboard.writeText.bind(clipboard);
        const wrapped = text => { recordClipboard(text, 'copy'); return original(text); };
        wrapped.__idkWrapped = true;
        clipboard.writeText = wrapped;
      }
    } catch {}
  }

  const FILES = [
    ['Home', '⌂', '#79a7ff'], ['Gallery', '▧', '#ff9ad5'], ['Desktop', '▣', '#87e6a8'],
    ['Downloads', '↓', '#ffd166'], ['Documents', '▤', '#9cc7ff'], ['Pictures', '▧', '#ffb86b'],
    ['Music', '♫', '#c8a2ff'], ['Videos', '▶', '#ff8c8c']
  ];

  function enhanceFiles(home) {
    if (!home || home.dataset.idkOsNextFiles) return;
    home.dataset.idkOsNextFiles = 'true';
    const sidebar = home.querySelector('.idk-file-sidebar');
    const drop = home.querySelector('#idk-dropzone');
    FILES.forEach(([name, icon, color]) => {
      let button = [...(sidebar?.querySelectorAll(':scope > button') || [])].find(value => value.textContent.trim() === name);
      if (!button && sidebar) { button = document.createElement('button'); button.type = 'button'; sidebar.insertBefore(button, drop); }
      if (!button) return;
      button.classList.add('idk-primary-shortcut');
      button.style.setProperty('--shortcut-color', color);
      button.innerHTML = `<span class="idk-shortcut-icon">${icon}</span><span>${esc(name)}</span><small>Stored locally</small><i aria-hidden="true">▸</i>`;
      button.title = `${name} · Stored locally`;
    });
    const grid = home.querySelector('.idk-folder-grid');
    if (grid) {
      FILES.forEach(([name, icon, color]) => {
        let card = grid.querySelector(`[data-folder="${CSS.escape(name)}"]`);
        if (!card) { card = document.createElement('button'); card.type = 'button'; card.dataset.folder = name; grid.prepend(card); }
        card.classList.add('idk-primary-folder');
        card.style.setProperty('--folder-color', color);
        card.innerHTML = `<span class="idk-folder-icon">${icon}</span><strong>${esc(name)}</strong><small>Stored locally</small><i aria-label="Pinned">▸</i>`;
        if (!card.dataset.idkFolderBound) {
          card.dataset.idkFolderBound = 'true';
          card.onclick = () => notify('Files', `${name} is available in the IDK local file system.`);
        }
      });
    }
    if (drop) {
      drop.classList.add('idk-dropzone-next');
      drop.querySelector('span')?.replaceChildren(document.createTextNode('Drag files here to stash them temporarily for later use.'));
      if (!drop.querySelector('.idk-dropzone-label')) drop.append(Object.assign(document.createElement('small'), { className: 'idk-dropzone-label', textContent: 'Temporary stash · local only' }));
    }
  }

  function enhanceLegacyFiles(root) {
    if (!root || root.dataset.idkOsNextLegacyFiles) return;
    const fileList = root.querySelector('.file-list');
    if (!fileList) return;
    root.dataset.idkOsNextLegacyFiles = 'true';
    const drop = root.querySelector('.idk-legacy-dropzone');
    const layout = document.createElement('div');
    layout.className = 'idk-files-legacy-layout';
    const sidebar = document.createElement('aside');
    sidebar.className = 'idk-files-legacy-sidebar';
    sidebar.innerHTML = '<strong>Quick Navigation</strong>';
    const main = document.createElement('main');
    main.className = 'idk-files-legacy-main';
    layout.append(sidebar, main);
    root.append(layout);
    main.append(fileList);
    if (drop) sidebar.append(drop);
    FILES.forEach(([name, icon, color]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'idk-primary-shortcut';
      button.style.setProperty('--shortcut-color', color);
      button.innerHTML = `<span class="idk-shortcut-icon">${icon}</span><span>${esc(name)}</span><small>Stored locally</small><i aria-hidden="true">▸</i>`;
      button.title = `${name} · Stored locally`;
      button.onclick = () => notify('Files', `${name} is available in the IDK local file system.`);
      sidebar.append(button);
    });
    if (drop) {
      drop.classList.add('idk-dropzone-next');
      drop.querySelector('small')?.replaceChildren(document.createTextNode('Drag files here to stash them temporarily for later use.'));
      if (!drop.querySelector('.idk-dropzone-label')) drop.append(Object.assign(document.createElement('small'), { className: 'idk-dropzone-label', textContent: 'Temporary stash · local only' }));
    }
  }

  function enhanceEcho(root) {
    if (!root || root.dataset.idkOsNextEcho) return;
    root.dataset.idkOsNextEcho = 'true';
    const head = root.querySelector('.idk-echo-head');
    const button = document.createElement('button');
    button.className = 'idk-echo-mini-toggle'; button.type = 'button'; button.textContent = '−'; button.title = 'Show only Echo image'; button.setAttribute('aria-label', 'Show only Echo image');
    button.onclick = () => { root.classList.toggle('idk-echo-mini'); button.textContent = root.classList.contains('idk-echo-mini') ? '+' : '−'; button.title = root.classList.contains('idk-echo-mini') ? 'Open Echo agent' : 'Show only Echo image'; };
    head?.insertBefore(button, head.querySelector('.idk-echo-close'));
  }

  function enhanceWidgetTray(root) {
    if (!root || root.dataset.idkOsNextWidgets) return;
    root.dataset.idkOsNextWidgets = 'true';
    const note = root.querySelector('p');
    if (note) note.textContent = 'Drag any widget onto any place on the desktop. Resize it from the lower-right corner.';
    root.querySelectorAll('[data-widget-type]').forEach(button => { button.title = `Drag ${button.querySelector('strong')?.textContent || 'widget'} onto the desktop`; });
  }

  function enhancePublisher(root) {
    if (!root || root.dataset.idkOsNextPublisher) return;
    root.dataset.idkOsNextPublisher = 'true';
    const note = root.querySelector('.idk-publish-note');
    if (note) note.textContent = 'Publish a self-contained HTML app or game. IDK gives it a friendly public page and runs it in a sandbox for every desktop.';
  }

  function registerApps() {
    if (typeof APPS === 'undefined') return;
    APPS.timeline = { title: 'System Timeline', glyph: '◷', desktop: false, dock: false, width: 760, height: 590, render: timelineView };
    const icons = document.getElementById('icons');
    if (icons && !icons.querySelector('[data-final-app="timeline"]')) {
      const icon = document.createElement('button'); icon.type = 'button'; icon.className = 'idk-final-desktop-icon'; icon.dataset.finalApp = 'timeline'; icon.innerHTML = '<span>◷</span><label>System Timeline</label>'; icon.onclick = () => window.OS?.open?.('timeline'); icons.append(icon);
    }
  }

  function installTools() {
    const desktop = document.getElementById('desktop');
    if (!desktop || document.getElementById('idk-os-next-tools')) return;
    const tools = document.createElement('nav');
    tools.id = 'idk-os-next-tools';
    tools.setAttribute('aria-label', 'IDK OS tools');
    tools.innerHTML = '<button type="button" data-tool="workspace" title="Smart Workspaces">▦<span>Workspaces</span></button><button type="button" data-tool="clipboard" title="Universal Clipboard">⧉<span>Clipboard</span></button><button type="button" data-tool="timeline" title="System Timeline">◷<span>Timeline</span></button>';
    tools.onclick = event => {
      const action = event.target.closest('[data-tool]')?.dataset.tool;
      if (action === 'workspace') workspaceView();
      if (action === 'clipboard') openShareSheet();
      if (action === 'timeline') window.OS?.open?.('timeline');
    };
    desktop.append(tools);
  }

  function install() {
    registerApps();
    installTools();
    captureClipboard();
    const scan = () => {
      document.querySelectorAll('.idk-file-home').forEach(enhanceFiles);
      document.querySelectorAll('.files-app').forEach(enhanceLegacyFiles);
      document.querySelectorAll('#idk-echo-popout').forEach(enhanceEcho);
      document.querySelectorAll('#idk-widget-tray').forEach(enhanceWidgetTray);
      document.querySelectorAll('#idk-public-publisher').forEach(enhancePublisher);
    };
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v') { event.preventDefault(); openShareSheet(); }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'w') { event.preventDefault(); workspaceView(); }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'y') { event.preventDefault(); window.OS?.open?.('timeline'); }
    });
    setTimeout(restorePendingWorkspace, 900);
  }

  window.IDKOSNext = { workspaceView, openShareSheet, openTimeline: () => window.OS?.open?.('timeline'), timeline, recordClipboard };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

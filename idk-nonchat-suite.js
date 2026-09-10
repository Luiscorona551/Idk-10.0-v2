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
      app('apps', 'App Store', '▦', 'Open built-in apps and installed programs.'),
      app('settings', 'Settings', '⚙', 'Appearance, accessibility, sync, and devices.'),
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

  window.IDKNonChatSuite = { open: () => open('workspaceCenter'), snapshot };
  registerApps();
})();

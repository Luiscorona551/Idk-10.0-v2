(() => {
  'use strict';
  if (window.IDKAdvancedPolish) return;

  const read = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);

  function installTray() {
    const clock = document.getElementById('clock');
    if (!clock || document.getElementById('idk-system-tray')) return;
    const tray = document.createElement('nav');
    tray.id = 'idk-system-tray';
    tray.setAttribute('aria-label', 'System tray');
    tray.innerHTML = '<button type="button" data-network title="Network status">Online</button><button type="button" data-battery title="Battery status">Battery: —</button><button type="button" data-theme title="Toggle theme">Theme</button><button type="button" data-notify title="Open notifications">Alerts</button>';
    const network = tray.querySelector('[data-network]');
    const battery = tray.querySelector('[data-battery]');
    const updateNetwork = () => { network.textContent = navigator.onLine ? 'Online' : 'Offline'; network.dataset.state = navigator.onLine ? 'online' : 'offline'; };
    const updateBattery = value => { battery.textContent = value ? `${Math.round(value.level * 100)}%${value.charging ? ' ⚡' : ''}` : 'Battery: —'; };
    updateNetwork();
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    if (navigator.getBattery) navigator.getBattery().then(value => { updateBattery(value); value.addEventListener('levelchange', () => updateBattery(value)); value.addEventListener('chargingchange', () => updateBattery(value)); }).catch(() => {});
    tray.querySelector('[data-theme]').onclick = () => {
      const next = localStorage.getItem('theme') === 'neon' ? 'midnight' : 'neon';
      localStorage.setItem('theme', JSON.stringify(next));
      location.reload();
    };
    tray.querySelector('[data-notify]').onclick = () => document.getElementById('notification-toggle')?.click();
    clock.append(tray);
  }

  function createEntry(type) {
    const name = window.prompt(type === 'folder' ? 'Folder name' : 'Text file name', type === 'folder' ? 'New folder' : 'New file.txt');
    if (!name?.trim()) return;
    const files = read('idkFileSystem', []);
    const clean = name.trim();
    if (files.some(item => item.parent === '' && item.name.toLowerCase() === clean.toLowerCase())) return notify('Files', `${clean} already exists.`);
    files.push({ id: `${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`, name: clean, type, parent: '', updated: Date.now(), ...(type === 'file' ? { mime: 'text/plain', text: true, content: '', size: 0 } : {}) });
    write('idkFileSystem', files);
    notify('Files', `${clean} was created.`);
  }

  function saveRichNote(root) {
    const area = root.querySelector('.rich-note-area');
    const title = root.querySelector('.rich-note-toolbar input');
    if (!area) return;
    const name = `${(title?.value || 'Untitled note').trim() || 'Untitled note'}.txt`;
    const files = read('idkFileSystem', []);
    const existing = files.find(item => item.type === 'file' && item.parent === '' && item.name === name);
    const entry = existing || { id: `note-${Date.now()}`, name, type: 'file', parent: '', mime: 'text/plain', text: true, content: '' };
    entry.content = area.value;
    entry.size = new Blob([entry.content]).size;
    entry.updated = Date.now();
    if (!existing) files.push(entry);
    write('idkFileSystem', files);
    notify('Notes', `${name} saved to Files.`);
  }

  function enhanceRichNotes(root) {
    if (!root || root.dataset.idkAdvancedNotes) return;
    root.dataset.idkAdvancedNotes = 'true';
    root.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveRichNote(root);
      }
    }, true);
    const toolbar = root.querySelector('.rich-note-toolbar');
    if (toolbar && !toolbar.querySelector('[data-advanced-save]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn tab';
      button.dataset.advancedSave = 'true';
      button.textContent = 'Save to Files';
      button.onclick = () => saveRichNote(root);
      toolbar.append(button);
    }
  }

  function showContextMenu(event) {
    const target = event.target.closest('#desktop');
    if (!target || event.target.closest('#windows,#dock,#start-menu,#clock,#notification-toggle,.window,#idk-upgrade-context,#idk-final-quick')) return;
    if (event.target.closest('#icons .desktop-icon,#icons .idk-installed-shortcut,#icons .idk-final-desktop-icon')) return;
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('idk-advanced-context')?.remove();
    const menu = document.createElement('menu');
    menu.id = 'idk-advanced-context';
    [['Open Files', () => window.OS?.open('files')], ['New folder', () => { createEntry('folder'); window.OS?.open('files'); }], ['New text file', () => { createEntry('file'); window.OS?.open('files'); }], ['Open Settings', () => window.OS?.open('settings')], ['Refresh desktop', () => location.reload()]].forEach(([label, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.onclick = () => { menu.remove(); action(); };
      menu.append(button);
    });
    menu.style.left = `${Math.min(event.clientX, innerWidth - 205)}px`;
    menu.style.top = `${Math.min(event.clientY, innerHeight - 230)}px`;
    document.body.append(menu);
    setTimeout(() => document.addEventListener('pointerdown', () => menu.remove(), { once: true }), 0);
  }

  function activeWindow() {
    return [...document.querySelectorAll('#windows .window:not(.minimized)')]
      .sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0];
  }

  function snapWindow(side) {
    const win = activeWindow();
    if (!win) return;
    win.classList.remove('maximized', 'snapped-left', 'snapped-right');
    if (side === 'left') win.classList.add('snapped-left');
    if (side === 'right') win.classList.add('snapped-right');
    if (side === 'max') win.classList.add('maximized');
    win.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  }

  function shortcuts(event) {
    if (event.ctrlKey && event.altKey && !event.shiftKey && event.key.toLowerCase() === 't') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.OS?.open('terminal');
      return;
    }
    if (event.key === 'Meta' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      document.getElementById('start-toggle')?.click();
      return;
    }
    if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    snapWindow(event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : event.key === 'ArrowUp' ? 'max' : 'free');
  }

  async function openFile(entry) {
    const blob = await window.SYSTEM_APPS?.readBlob?.(entry);
    if (!blob) return false;
    const mediaType = entry.mime || (/[.]mp4|webm|mov$/i.test(entry.name) ? 'video/*' : 'audio/*');
    const url = URL.createObjectURL(blob);
    window.OS?.open('player', { title: entry.name, src: url, mediaType });
    return true;
  }

  function install() {
    installTray();
    document.addEventListener('contextmenu', showContextMenu, true);
    document.addEventListener('keydown', shortcuts, true);
    document.addEventListener('pointerdown', event => { if (!event.target.closest('#idk-advanced-context')) document.getElementById('idk-advanced-context')?.remove(); });
    const scan = () => document.querySelectorAll('.rich-notes-app').forEach(enhanceRichNotes);
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  window.IDKAdvancedPolish = { openFile, createEntry };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

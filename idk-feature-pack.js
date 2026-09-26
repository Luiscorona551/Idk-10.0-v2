(() => {
  'use strict';
  if (window.IDKFeaturePack) return;

  const KEY = 'idkFeaturePackState';
  const defaults = {
    space: 1,
    theme: 'midnight',
    brightness: 100,
    volume: 70,
    guest: false,
    pinHash: '',
    note: '',
    bookmarks: [],
    customTheme: { accent: '#5986da', panel: '#0c1226', panelSolid: '#0d1226', text: '#eaf0ff' }
  };
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  };
  const state = { ...defaults, ...read() };
  const savedTheme = store.get('theme', null);
  if (savedTheme) state.theme = savedTheme;
  state.customTheme = { ...defaults.customTheme, ...(state.customTheme || {}), ...store.get('idkCustomTheme', {}) };
  state.bookmarks = Array.isArray(state.bookmarks) ? state.bookmarks : [];
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  };
  const one = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function notify(title, message) {
    window.OS?.notify?.(title, message);
  }

  function openApp(id) {
    window.OS?.open?.(id);
  }

  function download(name, value, type = 'application/json') {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([value], { type }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function saveScreenshot() {
    const loadLibrary = window.html2canvas
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    loadLibrary.then(() => window.html2canvas(document.getElementById('desktop'), { useCORS: true }))
      .then(canvas => canvas.toBlob(blob => {
        if (!blob) return notify('Screenshot', 'The desktop could not be captured.');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'idk-desktop.png';
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }))
      .catch(() => notify('Screenshot', 'Screenshot tool is unavailable offline.'));
  }

  async function hash(value) {
    if (!crypto.subtle) return value;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function applyTheme() {
    const themes = ['midnight', 'neon', 'sunset', 'mono', 'ocean', 'forest', 'candy'];
    const theme = store.get('theme', state.theme);
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    if (theme === 'custom') {
      desktop.setAttribute('data-theme', 'custom');
      desktop.style.setProperty('--accent', state.customTheme.accent);
      desktop.style.setProperty('--panel', state.customTheme.panel);
      desktop.style.setProperty('--panel-solid', state.customTheme.panelSolid);
      desktop.style.setProperty('--text', state.customTheme.text);
      desktop.style.setProperty('--muted', `color-mix(in srgb, ${state.customTheme.text} 62%, transparent)`);
      return;
    }
    ['--accent', '--panel', '--panel-solid', '--text', '--muted'].forEach(property => desktop.style.removeProperty(property));
    desktop.setAttribute('data-theme', themes.includes(theme) ? theme : 'midnight');
  }

  function applyDeviceSettings() {
    const brightness = Math.max(20, Math.min(100, Number(state.brightness) || 100));
    let shade = document.getElementById('idk-pack-brightness');
    if (!shade) {
      shade = document.createElement('div');
      shade.id = 'idk-pack-brightness';
      document.body.append(shade);
    }
    shade.style.opacity = String((100 - brightness) / 100);
    document.querySelectorAll('audio, video').forEach(media => { media.volume = Number(state.volume) / 100; });
  }

  function syncWindows() {
    const windows = [...document.querySelectorAll('#windows .window')];
    windows.forEach(win => {
      if (!win.dataset.idkSpace) win.dataset.idkSpace = '1';
      win.classList.toggle('idk-space-hidden', Number(win.dataset.idkSpace) !== state.space);
    });
    renderTaskbar();
  }

  function switchSpace(space) {
    state.space = Math.max(1, Math.min(3, Number(space) || 1));
    save();
    syncWindows();
    renderTaskbar();
  }

  function moveFocusedWindow(space) {
    const windows = [...document.querySelectorAll('#windows .window')]
      .filter(win => !win.classList.contains('idk-space-hidden'))
      .sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0));
    if (!windows[0]) return notify('Workspaces', 'There is no open window to move.');
    windows[0].dataset.idkSpace = String(space);
    syncWindows();
    notify('Workspaces', `Window moved to Desktop ${space}.`);
  }

  function renderTaskbar() {
    let bar = document.getElementById('idk-pack-taskbar');
    if (!bar) {
      bar = document.createElement('nav');
      bar.id = 'idk-pack-taskbar';
      bar.setAttribute('aria-label', 'IDK taskbar');
      document.body.append(bar);
    }
    bar.replaceChildren();
    [1, 2, 3].forEach(space => {
      const button = document.createElement('button');
      button.className = `idk-pack-space${state.space === space ? ' active' : ''}`;
      button.type = 'button';
      button.textContent = `Desk ${space}`;
      button.title = `Switch to Desktop ${space}`;
      button.onclick = () => switchSpace(space);
      bar.append(button);
    });
    [...document.querySelectorAll('#windows .window')]
      .filter(win => Number(win.dataset.idkSpace || 1) === state.space)
      .forEach(win => {
        const button = document.createElement('button');
        button.className = 'idk-pack-window';
        button.type = 'button';
        button.textContent = win.querySelector('.title')?.textContent || 'Window';
        button.onclick = () => {
          win.classList.remove('minimized');
          win.classList.add('focused');
          win.style.zIndex = String(Date.now());
        };
        bar.append(button);
      });
  }

  function toggleWidgets() {
    let widgets = document.getElementById('idk-pack-widgets');
    if (widgets) { widgets.remove(); return; }
    widgets = document.createElement('aside');
    widgets.id = 'idk-pack-widgets';
    widgets.innerHTML = `<section class="idk-pack-widget"><h3>Today</h3><p id="idk-pack-widget-date"></p></section>
      <section class="idk-pack-widget"><h3>Quick note</h3><textarea id="idk-pack-widget-note" placeholder="Write something to remember…"></textarea></section>
      <section class="idk-pack-widget"><h3>Connection</h3><p id="idk-pack-widget-status">Checking system status…</p></section>`;
    document.body.append(widgets);
    const note = one('#idk-pack-widget-note');
    note.value = state.note;
    note.oninput = () => { state.note = note.value; save(); };
    one('#idk-pack-widget-date').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    one('#idk-pack-widget-status').textContent = navigator.onLine ? 'Online · local storage ready' : 'Offline · local apps still available';
  }

  async function systemStatus(target) {
    if (!target) return;
    const details = [`Network: ${navigator.onLine ? 'Online' : 'Offline'}`];
    if (navigator.getBattery) {
      try {
        const battery = await navigator.getBattery();
        details.push(`Battery: ${Math.round(battery.level * 100)}%${battery.charging ? ' · Charging' : ''}`);
      } catch { details.push('Battery: unavailable'); }
    }
    if (navigator.storage?.estimate) {
      try {
        const usage = await navigator.storage.estimate();
        const used = Math.round((usage.usage || 0) / 1024 / 1024);
        details.push(`Browser storage used: ${used} MB`);
      } catch {}
    }
    try {
      const response = await fetch('/healthz', { cache: 'no-store' });
      details.push(`Server: ${response.ok ? 'Online' : 'Unavailable'}`);
    } catch { details.push('Server: unavailable'); }
    target.textContent = details.join(' · ');
  }

  function renderBookmarks(root) {
    const list = root.querySelector('.idk-pack-bookmarks');
    list.replaceChildren();
    if (!state.bookmarks.length) {
      list.append(Object.assign(document.createElement('p'), { textContent: 'No bookmarks saved yet.' }));
      return;
    }
    state.bookmarks.forEach((bookmark, index) => {
      const row = document.createElement('div');
      row.className = 'idk-pack-bookmark';
      row.innerHTML = `<button type="button" data-open>${esc(bookmark.title)}</button><span class="idk-pack-bookmark-actions"><button type="button" data-qr>QR</button><button type="button" data-remove aria-label="Remove bookmark">×</button></span>`;
      row.querySelector('[data-open]').onclick = () => window.open(bookmark.url, '_blank', 'noopener,noreferrer');
      row.querySelector('[data-qr]').onclick = () => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(bookmark.url)}`, '_blank', 'noopener,noreferrer');
      row.querySelector('[data-remove]').onclick = () => { state.bookmarks.splice(index, 1); save(); renderBookmarks(root); };
      list.append(row);
    });
  }


  function lockScreen() {
    if (document.getElementById('idk-pack-lock')) return;
    state.locked = true;
    save();
    const lock = document.createElement('section');
    lock.id = 'idk-pack-lock';
    lock.innerHTML = `<div class="idk-pack-lock-card"><h2>IDK is locked</h2><p>Enter your PIN to return to the desktop.</p><input class="idk-pack-input" id="idk-pack-unlock-pin" type="password" inputmode="numeric" placeholder="PIN"><button class="idk-pack-btn" id="idk-pack-unlock">Unlock</button><p class="idk-pack-status" id="idk-pack-lock-status"></p></div>`;
    document.body.append(lock);
    const unlock = async () => { const value = one('#idk-pack-unlock-pin').value; if (!state.pinHash || await hash(value) === state.pinHash) { state.locked = false; save(); lock.remove(); } else one('#idk-pack-lock-status').textContent = 'That PIN is not correct.'; };
    one('#idk-pack-unlock').onclick = unlock;
    one('#idk-pack-unlock-pin').onkeydown = event => { if (event.key === 'Enter') unlock(); };
    one('#idk-pack-unlock-pin').focus();
  }

  function init() {
    applyTheme();
    applyDeviceSettings();
    document.body.classList.toggle('idk-guest-mode', state.guest);
    renderTaskbar();
    const windows = document.getElementById('windows');
    if (windows) new MutationObserver(syncWindows).observe(windows, { childList: true });
    document.addEventListener('keydown', event => {
      if (event.ctrlKey && event.altKey && /^[123]$/.test(event.key)) { event.preventDefault(); switchSpace(event.key); }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'l') { event.preventDefault(); lockScreen(); }
    });
    if (state.locked) lockScreen();
    window.IDKFeaturePack = {
      switchSpace, toggleWidgets, lockScreen, saveScreenshot, systemStatus,
      getState: () => ({ ...state, bookmarks: state.bookmarks.map(item => ({ ...item })), customTheme: { ...state.customTheme } }),
      setBrightness(value) { state.brightness = Math.max(20, Math.min(100, Number(value) || 100)); save(); applyDeviceSettings(); },
      setVolume(value) { state.volume = Math.max(0, Math.min(100, Number(value) || 0)); save(); applyDeviceSettings(); },
      setGuest(enabled) { state.guest = Boolean(enabled); save(); document.body.classList.toggle('idk-guest-mode', state.guest); },
      async setPIN(value) { state.pinHash = value ? await hash(String(value)) : ''; save(); return Boolean(value); },
      clearPIN() { state.pinHash = ''; save(); },
      clearNote() { state.note = ''; save(); },
      getBookmarks: () => state.bookmarks.map(item => ({ ...item })),
      addBookmark(title, url) { if (!title || !/^https?:\/\//i.test(url)) return false; state.bookmarks.push({ title, url }); save(); return true; },
      removeBookmark(index) { if (index < 0 || index >= state.bookmarks.length) return false; state.bookmarks.splice(index, 1); save(); return true; },
      moveFocusedWindow
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

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
    renderPane('desktop');
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

  function renderPane(name) {
    const pane = one('#idk-pack-pane');
    if (!pane) return;
    document.querySelectorAll('.idk-pack-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.pane === name));
    if (name === 'desktop') {
       pane.innerHTML = `<section class="idk-pack-card"><h3>Virtual desktops</h3><p>Keep school, games, and personal windows separate.</p><div class="idk-pack-space-list">${[1, 2, 3].map(space => `<button class="idk-pack-space${state.space === space ? ' active' : ''}" data-space="${space}">Desktop ${space}</button>`).join('')}</div><div class="idk-pack-actions"><button class="idk-pack-btn" data-action="move">Move active window</button><button class="idk-pack-btn" data-action="widgets">Show widgets</button><button class="idk-pack-btn" data-action="screenshot">Save screenshot</button></div></section>
         <section class="idk-pack-card"><h3>Appearance</h3><label class="idk-pack-label"><strong>Theme</strong><select class="idk-pack-select" id="idk-pack-theme">${['midnight', 'neon', 'sunset', 'mono', 'ocean', 'forest', 'candy', 'custom'].map(theme => `<option value="${theme}">${theme[0].toUpperCase() + theme.slice(1)}</option>`).join('')}</select></label><div class="idk-pack-custom-theme" id="idk-pack-custom-theme"><label class="idk-pack-label"><strong>Accent</strong><input class="idk-pack-color" data-color="accent" type="color" value="${state.customTheme.accent}"></label><label class="idk-pack-label"><strong>Panel</strong><input class="idk-pack-color" data-color="panel" type="color" value="${state.customTheme.panel}"></label><label class="idk-pack-label"><strong>Window panel</strong><input class="idk-pack-color" data-color="panelSolid" type="color" value="${state.customTheme.panelSolid}"></label><label class="idk-pack-label"><strong>Text</strong><input class="idk-pack-color" data-color="text" type="color" value="${state.customTheme.text}"></label></div></section>`;
       one('#idk-pack-theme').value = state.theme;
       const customTheme = one('#idk-pack-custom-theme');
       const syncCustomTheme = () => {
         customTheme.hidden = one('#idk-pack-theme').value !== 'custom';
         if (!customTheme.hidden) applyTheme();
       };
       customTheme.querySelectorAll('[data-color]').forEach(input => input.oninput = () => {
         state.customTheme[input.dataset.color] = input.value;
         store.set('idkCustomTheme', state.customTheme);
         save();
         syncCustomTheme();
       });
       pane.querySelectorAll('[data-space]').forEach(button => { button.onclick = () => switchSpace(button.dataset.space); });
      pane.querySelector('[data-action="move"]').onclick = () => moveFocusedWindow(state.space === 3 ? 1 : state.space + 1);
      pane.querySelector('[data-action="widgets"]').onclick = toggleWidgets;
      pane.querySelector('[data-action="screenshot"]').onclick = saveScreenshot;
       one('#idk-pack-theme').onchange = event => { state.theme = event.target.value; store.set('theme', state.theme); save(); syncCustomTheme(); applyTheme(); };
       syncCustomTheme();
       return;
    }
    if (name === 'system') {
      pane.innerHTML = `<section class="idk-pack-card"><h3>System health</h3><p class="idk-pack-status" id="idk-pack-health">Checking system status…</p><button class="idk-pack-btn" id="idk-pack-refresh-health">Refresh status</button></section><section class="idk-pack-card"><h3>Device controls</h3><label class="idk-pack-label"><strong>Brightness</strong><input class="idk-pack-range" id="idk-pack-brightness-range" type="range" min="20" max="100" value="${state.brightness}"></label><label class="idk-pack-label"><strong>Volume</strong><input class="idk-pack-range" id="idk-pack-volume-range" type="range" min="0" max="100" value="${state.volume}"></label></section><section class="idk-pack-card"><h3>Open a built-in app</h3><div class="idk-pack-actions"><button class="idk-pack-btn" data-app="files">Files</button><button class="idk-pack-btn" data-app="proxy">Browser</button><button class="idk-pack-btn" data-app="chat">Messenger</button><button class="idk-pack-btn" data-app="games">Games</button><button class="idk-pack-btn" data-app="music">Music</button></div></section>`;
      const health = one('#idk-pack-health');
      systemStatus(health);
      one('#idk-pack-refresh-health').onclick = () => systemStatus(health);
      one('#idk-pack-brightness-range').oninput = event => { state.brightness = Number(event.target.value); save(); applyDeviceSettings(); };
      one('#idk-pack-volume-range').oninput = event => { state.volume = Number(event.target.value); save(); applyDeviceSettings(); };
      pane.querySelectorAll('[data-app]').forEach(button => { button.onclick = () => openApp(button.dataset.app); });
      return;
    }
    if (name === 'apps') {
      pane.innerHTML = `<section class="idk-pack-card"><h3>App launcher</h3><p>Files, proxy browsing, games, music, Messenger, and the existing App Store are available here.</p><div class="idk-pack-actions"><button class="idk-pack-btn" data-app="apps">Open Apps</button><button class="idk-pack-btn" data-app="search">Search everything</button></div></section><section class="idk-pack-card"><h3>Bookmarks</h3><label class="idk-pack-label"><strong>Name</strong><input class="idk-pack-input" id="idk-bookmark-title" placeholder="My favorite site"></label><label class="idk-pack-label"><strong>Web address</strong><input class="idk-pack-input" id="idk-bookmark-url" type="url" placeholder="https://example.com"></label><div class="idk-pack-actions"><button class="idk-pack-btn" id="idk-bookmark-add">Save bookmark</button></div><div class="idk-pack-bookmarks"></div></section>`;
      renderBookmarks(pane);
      pane.querySelectorAll('[data-app]').forEach(button => { button.onclick = () => openApp(button.dataset.app); });
      one('#idk-bookmark-add').onclick = () => { const title = one('#idk-bookmark-title').value.trim(); const url = one('#idk-bookmark-url').value.trim(); if (!title || !/^https?:\/\//i.test(url)) return notify('Bookmarks', 'Enter a name and a full web address.'); state.bookmarks.push({ title, url }); save(); renderBookmarks(pane); };
      return;
    }
    if (name === 'privacy') {
      pane.innerHTML = `<section class="idk-pack-card"><h3>Privacy</h3><p>Guest mode keeps this browser session separate from your saved profile.</p><div class="idk-pack-row"><span>Guest mode</span><input id="idk-pack-guest" type="checkbox" ${state.guest ? 'checked' : ''}></div><div class="idk-pack-actions"><button class="idk-pack-btn" data-action="lock">Lock screen</button></div></section><section class="idk-pack-card"><h3>Optional lock PIN</h3><p>Set a PIN for this browser profile. It is stored locally and is not a replacement for your account password.</p><input class="idk-pack-input" id="idk-pack-pin" type="password" inputmode="numeric" maxlength="12" placeholder="New PIN"><div class="idk-pack-actions"><button class="idk-pack-btn" id="idk-pack-save-pin">Save PIN</button><button class="idk-pack-btn danger" id="idk-pack-clear-pin">Clear PIN</button></div></section>`;
      one('#idk-pack-guest').onchange = event => { state.guest = event.target.checked; save(); document.body.classList.toggle('idk-guest-mode', state.guest); };
      pane.querySelector('[data-action="lock"]').onclick = lockScreen;
      one('#idk-pack-save-pin').onclick = async () => { const pin = one('#idk-pack-pin').value.trim(); state.pinHash = pin ? await hash(pin) : ''; save(); notify('Privacy', pin ? 'Lock PIN saved.' : 'Lock PIN cleared.'); };
      one('#idk-pack-clear-pin').onclick = () => { state.pinHash = ''; save(); notify('Privacy', 'Lock PIN cleared.'); };
      return;
    }
    pane.innerHTML = `<section class="idk-pack-card"><h3>Backup and restore</h3><p>Save your browser OS settings, notes, bookmarks, and local app data in one file.</p><div class="idk-pack-actions"><button class="idk-pack-btn" id="idk-pack-export">Export backup</button><label class="idk-pack-btn">Import backup<input id="idk-pack-import" type="file" accept="application/json" hidden></label></div><p class="idk-pack-status" id="idk-pack-backup-status"></p></section><section class="idk-pack-card"><h3>Built-in tools</h3><div class="idk-pack-actions"><button class="idk-pack-btn" data-app="settings">Desktop settings</button><button class="idk-pack-btn" data-action="clear-note">Clear quick note</button></div></section>`;
    one('#idk-pack-export').onclick = () => download('idk-10-backup.json', JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])), null, 2));
    one('#idk-pack-import').onchange = async event => { const file = event.target.files?.[0]; if (!file) return; try { const values = JSON.parse(await file.text()); Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value)); one('#idk-pack-backup-status').textContent = 'Backup imported. Reloading…'; setTimeout(() => location.reload(), 700); } catch { one('#idk-pack-backup-status').textContent = 'That backup file could not be read.'; } };
    pane.querySelector('[data-action="clear-note"]').onclick = () => { state.note = ''; save(); notify('Quick note', 'Note cleared.'); };
    pane.querySelectorAll('[data-app]').forEach(button => { button.onclick = () => openApp(button.dataset.app); });
  }

  function openCenter(tab = 'desktop') {
    const existing = document.getElementById('idk-pack-center');
    if (existing) { existing.hidden = !existing.hidden; if (!existing.hidden) renderPane(tab); return; }
    const center = document.createElement('section');
    center.id = 'idk-pack-center';
    center.innerHTML = `<div class="idk-pack-head"><h2>IDK Control Center</h2><button class="idk-pack-close" type="button" aria-label="Close">×</button></div><div class="idk-pack-tabs">${[['desktop', 'Desktop'], ['system', 'System'], ['apps', 'Apps'], ['privacy', 'Privacy'], ['backup', 'Backup']].map(([id, label]) => `<button class="idk-pack-tab" type="button" data-pane="${id}">${label}</button>`).join('')}</div><div id="idk-pack-pane" class="idk-pack-pane"></div>`;
    document.body.append(center);
    center.querySelector('.idk-pack-close').onclick = () => { center.hidden = true; };
    center.querySelectorAll('.idk-pack-tab').forEach(button => { button.onclick = () => renderPane(button.dataset.pane); });
    renderPane(tab);
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
    const control = document.createElement('button');
    control.id = 'idk-pack-control';
    control.type = 'button';
    control.title = 'Open IDK Control Center';
    control.setAttribute('aria-label', 'Open IDK Control Center');
    control.textContent = '☷';
    control.onclick = () => openCenter();
    document.body.append(control);
    renderTaskbar();
    const windows = document.getElementById('windows');
    if (windows) new MutationObserver(syncWindows).observe(windows, { childList: true });
    document.addEventListener('keydown', event => {
      if (event.ctrlKey && event.altKey && /^[123]$/.test(event.key)) { event.preventDefault(); switchSpace(event.key); }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'l') { event.preventDefault(); lockScreen(); }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); openCenter(); }
    });
    if (state.locked) lockScreen();
    window.IDKFeaturePack = { openCenter, switchSpace, toggleWidgets, lockScreen };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

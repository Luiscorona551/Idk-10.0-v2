(() => {
  'use strict';
  if (window.IDKBatchTwentyOne) return;

  const APP_ID = 'desktopCenter';
  let launcherRoot = null;
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const makeButton = (text, action, className = 'btn') => { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = text; button.onclick = action; return button; };
  const appRegistry = () => typeof APPS !== 'undefined' ? APPS : {};
  const apps = () => Object.entries(appRegistry()).filter(([id, app]) => id !== 'player' && id !== APP_ID && app?.title && !app.hidden).sort((left, right) => left[1].title.localeCompare(right[1].title));
  const openApp = id => window.OS?.open?.(id);
  const closeLauncher = () => { launcherRoot?.remove(); launcherRoot = null; };

  function windows() { return [...document.querySelectorAll('#windows .window')].filter(win => win.dataset.app); }
  function activeWindow() { return windows().sort((left, right) => Number(right.style.zIndex || 0) - Number(left.style.zIndex || 0))[0] || null; }
  function profileLabel() { return window.IDKConnectivitySuite?.activeProfile?.()?.name || (window.IDKAccount?.user ? window.IDKAccount.user.username : 'Local profile'); }
  function statusStats() {
    const open = windows();
    return { online: navigator.onLine, open: open.length, visible: open.filter(win => !win.classList.contains('minimized')).length, profile: profileLabel(), mode: read('idkPerformanceMode', 'balanced'), theme: read('theme', 'midnight') };
  }
  function runAction(action) { closeLauncher(); action?.(); }

  function renderOverview(pane) {
    const state = statusStats();
    pane.innerHTML = '<section class="idk-dc-hero"><div><span class="idk-dc-kicker">DESKTOP CONTROL CENTER</span><h2>Everything in one place</h2><p>Launch apps, arrange windows, restore your workspace, and tune the shell without hunting through separate panels.</p></div><span class="idk-dc-live" data-live></span></section><div class="idk-dc-stats" data-stats></div><section class="idk-dc-section"><header><div><h3>Quick actions</h3><p>Common desktop actions, one click away.</p></div></header><div class="idk-dc-actions" data-actions></div></section><section class="idk-dc-section idk-dc-shortcuts"><header><div><h3>Keyboard shortcuts</h3><p>Use the desktop like a fast workspace.</p></div></header><div class="idk-dc-shortcut-grid"><span><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>L</kbd><small>Open launcher</small></span><span><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>←</kbd><small>Split windows</small></span><span><kbd>Alt</kbd><kbd>Tab</kbd><small>Cycle windows</small></span><span><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>R</kbd><small>Restore workspace</small></span></div></section>';
    pane.querySelector('[data-live]').textContent = state.online ? 'Online' : 'Offline';
    pane.querySelector('[data-live]').classList.toggle('offline', !state.online);
    pane.querySelector('[data-stats]').innerHTML = `<article><strong>${state.open}</strong><small>Open windows</small></article><article><strong>${state.visible}</strong><small>Visible now</small></article><article><strong>${esc(state.mode)}</strong><small>Performance mode</small></article><article><strong>${esc(state.theme)}</strong><small>Theme</small></article><article><strong>${esc(state.profile)}</strong><small>Active profile</small></article>`;
    const actions = pane.querySelector('[data-actions]');
    [['Open launcher', () => openLauncher(), 'btn'], ['Split layout', () => window.IDKWindowManager?.tileLayout?.('split'), 'btn tab'], ['Grid layout', () => window.IDKWindowManager?.tileLayout?.('grid'), 'btn tab'], ['Performance', () => window.IDKWindowManager?.openPerformanceCenter?.(), 'btn tab'], ['Settings', () => openApp('settings'), 'btn tab'], ['Security Center', () => window.IDKBatchNineteen?.open?.(), 'btn tab'], ['Restore workspace', () => window.OS?.restoreWorkspace?.(), 'btn tab']].forEach(([label, action, style]) => actions.append(makeButton(label, action, style)));
  }

  function renderLaunch(pane) {
    pane.innerHTML = '<section class="idk-dc-section idk-dc-launch"><header><div><h3>Launch anything</h3><p>Built-in apps and installed programs, ordered for quick access.</p></div><button class="btn tab" type="button" data-search>Search everything</button></header><input class="field" type="search" data-query placeholder="Filter apps…" autocomplete="off"><div class="idk-dc-app-grid" data-list></div></section>';
    const query = pane.querySelector('[data-query]'), list = pane.querySelector('[data-list]');
    pane.querySelector('[data-search]').onclick = () => window.IDKConnectivitySuite?.openSearch?.() || window.IDKUnifiedSearch?.open?.();
    const render = () => { const value = query.value.trim().toLowerCase(); const recent = read('recentApps', []); const items = apps().sort(([left], [right]) => (recent.indexOf(left) < 0 ? 99 : recent.indexOf(left)) - (recent.indexOf(right) < 0 ? 99 : recent.indexOf(right))).filter(([, app]) => !value || `${app.title} ${app.category || 'App'}`.toLowerCase().includes(value)); list.replaceChildren(...items.map(([id, app]) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'idk-dc-app-card'; button.onclick = () => openApp(id); const glyph = document.createElement('span'); glyph.className = 'idk-dc-app-glyph'; glyph.innerHTML = app.glyph || '•'; const copy = document.createElement('span'); copy.innerHTML = `<strong>${esc(app.title)}</strong><small>${esc(app.category || (recent.includes(id) ? 'Recent app' : 'Built-in app'))}</small>`; button.append(glyph, copy); return button; })); if (!items.length) list.append(Object.assign(document.createElement('p'), { className: 'empty-state', textContent: 'No matching apps.' })); };
    query.oninput = render; render();
  }

  function renderWindows(pane) {
    pane.innerHTML = '<section class="idk-dc-section"><header><div><h3>Window workspace</h3><p>Arrange the current session or restore it after a restart.</p></div><div class="idk-dc-actions"><button class="btn tab" data-save>Save workspace</button><button class="btn tab" data-restore>Restore workspace</button></div></header><div class="idk-dc-actions idk-dc-layout-actions"><button class="btn" data-split>Split</button><button class="btn tab" data-grid>Grid</button><button class="btn tab" data-focus>Focus</button><button class="btn tab" data-free>Free layout</button><button class="btn tab" data-minimize>Minimize all</button><button class="btn tab" data-restore-all>Restore all</button></div><div class="idk-dc-window-list" data-list></div></section>';
    const list = pane.querySelector('[data-list]');
    const manager = window.IDKWindowManager;
    const render = () => { const items = windows(); list.replaceChildren(...items.map(win => { const row = document.createElement('article'); row.className = 'idk-dc-window-row'; const title = win.querySelector('.title')?.textContent || win.dataset.app; const copy = document.createElement('div'); copy.innerHTML = `<strong>${esc(title)}</strong><small>${win.classList.contains('minimized') ? 'Minimized' : win.classList.contains('maximized') ? 'Maximized' : 'Open'}</small>`; const actions = document.createElement('div'); actions.className = 'idk-dc-actions'; actions.append(makeButton('Focus', () => window.OS?.focus?.(win), 'btn tab'), makeButton(win.classList.contains('minimized') ? 'Restore' : 'Minimize', () => { win.classList.toggle('minimized'); manager?.saveSession?.(); render(); }, 'btn tab'), makeButton('Close', () => { win.querySelector('.close')?.click(); render(); }, 'btn tab')); row.append(copy, actions); return row; })); if (!items.length) list.append(Object.assign(document.createElement('p'), { className: 'empty-state', textContent: 'No windows are open.' })); };
    pane.querySelector('[data-save]').onclick = () => { window.OS?.saveWorkspace?.(); notify('Workspace', 'Current workspace saved.', 'success'); };
    pane.querySelector('[data-restore]').onclick = () => { window.OS?.restoreWorkspace?.(); setTimeout(render, 250); };
    pane.querySelector('[data-split]').onclick = () => manager?.tileLayout?.('split');
    pane.querySelector('[data-grid]').onclick = () => manager?.tileLayout?.('grid');
    pane.querySelector('[data-focus]').onclick = () => manager?.tileLayout?.('focus');
    pane.querySelector('[data-free]').onclick = () => manager?.restoreGeometry?.();
    pane.querySelector('[data-minimize]').onclick = () => manager?.minimizeAll?.();
    pane.querySelector('[data-restore-all]').onclick = () => manager?.restoreAll?.();
    render();
  }

  function renderPersonalize(pane) {
    const themes = ['midnight', 'neon', 'sunset', 'mono', 'ocean', 'forest', 'candy', 'custom'];
    const presets = typeof WALLPAPER_PRESETS !== 'undefined' ? WALLPAPER_PRESETS : [];
    pane.innerHTML = `<section class="idk-dc-section"><header><div><h3>Personalize the shell</h3><p>These settings are local to the active browser profile.</p></div></header><div class="idk-dc-form"><label>Theme<select class="field" data-theme>${themes.map(name => `<option value="${name}">${name[0].toUpperCase()}${name.slice(1)}</option>`).join('')}</select></label><label>Wallpaper preset<select class="field" data-wallpaper><option value="">Current wallpaper</option>${presets.map(item => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('')}</select></label><label>Icon size<select class="field" data-icons><option value="compact">Compact</option><option value="normal">Normal</option><option value="large">Large</option></select></label><label>Dock position<select class="field" data-dock><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></label><label>Motion<select class="field" data-motion><option value="on">On</option><option value="off">Reduced</option></select></label></div><div class="idk-dc-actions" data-actions></div></section><section class="idk-dc-section"><header><div><h3>Startup and recovery</h3><p>Reset only the part of the shell you choose.</p></div></header><div class="idk-dc-actions" data-recovery></div></section>`;
    const theme = pane.querySelector('[data-theme]'), wallpaper = pane.querySelector('[data-wallpaper]'), icons = pane.querySelector('[data-icons]'), dock = pane.querySelector('[data-dock]'), motion = pane.querySelector('[data-motion]');
    theme.value = read('theme', 'midnight'); icons.value = read('iconSize', 'normal'); dock.value = read('dockPosition', 'bottom'); motion.value = read('motion', 'on');
    pane.querySelector('[data-actions]').append(makeButton('Apply appearance', () => { write('theme', theme.value); write('iconSize', icons.value); write('dockPosition', dock.value); write('motion', motion.value); if (wallpaper.value) write('wallpaper', wallpaper.value); if (typeof applyTheme === 'function') applyTheme(theme.value); if (typeof applyIconSize === 'function') applyIconSize(icons.value); if (typeof applyDockPosition === 'function') applyDockPosition(dock.value); if (typeof applyMotion === 'function') applyMotion(motion.value); if (wallpaper.value && typeof applyWallpaper === 'function') applyWallpaper(wallpaper.value); notify('Desktop', 'Appearance updated.', 'success'); }, 'btn'), makeButton('Audio Center', () => window.IDKProductFeatures?.audioCenter?.(), 'btn tab'), makeButton('Account & profiles', () => window.IDKAccountsDevices?.open?.('profiles') || window.IDKConnectivitySuite?.openProfiles?.(), 'btn tab'));
    pane.querySelector('[data-recovery]').append(makeButton('Reopen welcome tour', () => { localStorage.removeItem('idkOnboardingComplete'); window.IDKProductFeatures?.welcome?.(); }, 'btn tab'), makeButton('Clear saved workspace', () => { window.OS?.clearWorkspace?.(); notify('Workspace', 'Saved workspace cleared.', 'success'); }, 'btn tab'), makeButton('Open updates', () => window.IDKProductFeatures?.updateCenter?.(), 'btn tab'));
  }

  function desktopCenter() {
    const root = document.createElement('div'); root.className = 'app idk-desktop-center'; root.innerHTML = '<header class="idk-dc-header"><div><span class="idk-dc-kicker">IDK 10.0 · BATCH 21</span><h2>Desktop Center</h2><p>One calm control surface for the shell.</p></div><button class="btn tab" type="button" data-launcher>⌘ Launcher</button></header><nav class="idk-dc-tabs" role="tablist"><button type="button" data-tab="overview" class="active">Overview</button><button type="button" data-tab="launch">Launch</button><button type="button" data-tab="windows">Windows</button><button type="button" data-tab="personalize">Personalize</button></nav><main data-pane></main>';
    const pane = root.querySelector('[data-pane]');
    const render = tab => { root.querySelectorAll('[data-tab]').forEach(item => { item.classList.toggle('active', item.dataset.tab === tab); item.setAttribute('aria-selected', String(item.dataset.tab === tab)); }); if (tab === 'launch') renderLaunch(pane); else if (tab === 'windows') renderWindows(pane); else if (tab === 'personalize') renderPersonalize(pane); else renderOverview(pane); };
    root.querySelectorAll('[data-tab]').forEach(tab => tab.onclick = () => render(tab.dataset.tab));
    root.querySelector('[data-launcher]').onclick = () => openLauncher();
    render('overview');
    return root;
  }

  function launcherItems(query) {
    const value = query.trim().toLowerCase();
    const commands = [{ title: 'Desktop Center', type: 'System', glyph: '⌘', run: () => openApp(APP_ID) }, { title: 'Search everything', type: 'System', glyph: '⌕', run: () => window.IDKConnectivitySuite?.openSearch?.() || window.IDKUnifiedSearch?.open?.() }, { title: 'Performance Center', type: 'System', glyph: '◒', run: () => window.IDKWindowManager?.openPerformanceCenter?.() }];
    const appItems = apps().map(([id, app]) => ({ title: app.title, type: app.category || 'App', glyph: app.glyph || '•', run: () => openApp(id) }));
    return [...commands, ...appItems].filter(item => !value || `${item.title} ${item.type}`.toLowerCase().includes(value)).slice(0, 30);
  }

  function openLauncher(seed = '') {
    closeLauncher();
    const root = document.createElement('section'); root.id = 'idk-desktop-launcher'; root.className = 'idk-desktop-launcher'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.innerHTML = '<div class="idk-desktop-launcher-card"><header><div><span class="idk-dc-kicker">QUICK LAUNCHER</span><strong>Find an app or command</strong></div><button type="button" data-close aria-label="Close launcher">×</button></header><input class="idk-desktop-launcher-input" data-query placeholder="Type to search…" autocomplete="off"><div class="idk-desktop-launcher-list" data-list></div><footer><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span><span><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>L</kbd> launcher</span></footer></div>';
    document.body.append(root); launcherRoot = root;
    const input = root.querySelector('[data-query]'), list = root.querySelector('[data-list]');
    const render = () => { const items = launcherItems(input.value); list.replaceChildren(...items.map((item, index) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'idk-desktop-launcher-item'; button.innerHTML = `<span>${item.glyph}</span><strong>${esc(item.title)}</strong><small>${esc(item.type)}</small>`; button.onclick = () => runAction(item.run); button.onfocus = () => list.querySelectorAll('.selected').forEach(selected => selected.classList.remove('selected')); if (index === 0) button.classList.add('selected'); return button; })); if (!items.length) list.append(Object.assign(document.createElement('div'), { className: 'empty-state', textContent: 'No matching commands.' })); };
    input.value = seed; input.oninput = render; input.onkeydown = event => { const items = [...list.querySelectorAll('button')]; const selected = list.querySelector('.selected'); const index = items.indexOf(selected); if (event.key === 'ArrowDown' && items.length) { event.preventDefault(); items[(index + 1) % items.length]?.focus(); } if (event.key === 'ArrowUp' && items.length) { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); } if (event.key === 'Escape') closeLauncher(); if (event.key === 'Enter') items[index >= 0 ? index : 0]?.click(); }; root.querySelector('[data-close]').onclick = closeLauncher; root.addEventListener('click', event => { if (event.target === root) closeLauncher(); }); render(); setTimeout(() => input.focus(), 20); return root;
  }

  function installShellControls() {
    const startMenu = document.getElementById('start-menu');
    if (startMenu && !startMenu.querySelector('[data-desktop-launcher]')) { const button = makeButton('⌘ Open Launcher', () => { startMenu.hidden = true; openLauncher(); }, 'idk-dc-start-launcher'); button.dataset.desktopLauncher = 'true'; startMenu.querySelector('.start-heading')?.append(button); }
    const status = document.getElementById('idk-perfect-status');
    if (status && !status.querySelector('[data-desktop-center]')) { const button = makeButton('Desktop', () => openApp(APP_ID), 'idk-dc-status-button'); button.dataset.desktopCenter = 'true'; status.append(button); }
    const tools = document.getElementById('idk-os-next-tools');
    if (tools && !tools.querySelector('[data-desktop-center]')) { const button = makeButton('Desktop', () => openApp(APP_ID), 'idk-dc-tool'); button.dataset.desktopCenter = 'true'; tools.append(button); }
  }

  function install() {
    if (typeof APPS !== 'undefined') APPS[APP_ID] ||= { title: 'Desktop Center', glyph: '⌘', category: 'System', desktop: false, dock: false, width: 980, height: 700, render: desktopCenter };
    installShellControls();
    document.documentElement.dataset.idkDesktopReady = 'true';
    document.addEventListener('keydown', event => { if (event.ctrlKey && event.altKey && event.code === 'KeyL') { event.preventDefault(); event.stopImmediatePropagation(); openLauncher(); } }, true);
    document.addEventListener('pointerdown', event => { const win = event.target.closest?.('#windows .window'); if (win) window.OS?.focus?.(win); }, true);
    const layer = document.getElementById('windows');
    if (layer) new MutationObserver(() => layer.querySelectorAll('.window').forEach(win => win.toggleAttribute('data-focused', win.classList.contains('focused')))).observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    const syncCompact = () => document.body.classList.toggle('idk-b21-compact', window.innerWidth <= 760);
    syncCompact(); window.addEventListener('resize', syncCompact, { passive: true });
    const idle = window.requestIdleCallback || (task => setTimeout(task, 0));
    window.addEventListener('load', () => idle(() => { document.documentElement.dataset.idkDesktopHydrated = 'true'; }), { once: true });
  }

  window.IDKBatchTwentyOne = { open: () => openApp(APP_ID), openLauncher, desktopCenter };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

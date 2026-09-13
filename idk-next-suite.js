(() => {
  'use strict';

  const STATE_KEY = 'idkNextState';
  const SNAPSHOT_KEY = 'idkNextSnapshots';
  const SAFE_KEYS = ['theme', 'wallpaper', 'iconSize', 'dockPosition', 'motion', 'idkWorkspace', 'idkFocusMode', 'idkNextState'];
  const DEFAULT_STATE = {
    focus: 'balanced',
    safeMode: false,
    doNotTrack: false,
    highContrast: false,
    reducedMotion: false,
    guestMode: false,
    routines: []
  };
  const FOCUS_MODES = {
    balanced: { label: 'Balanced', glyph: '◈', color: '#8bb8ff', description: 'Everything stays available with normal notifications.' },
    focus: { label: 'Deep Focus', glyph: '◉', color: '#7ef6a8', description: 'Quiet the desktop and keep your current task in view.' },
    school: { label: 'School', glyph: '✎', color: '#ffd166', description: 'A calm workspace for notes, calendar, and assignments.' },
    gaming: { label: 'Gaming', glyph: '✦', color: '#f78cff', description: 'Make games and media one click away.' },
    private: { label: 'Private', glyph: '◇', color: '#71ddff', description: 'Reduce ambient activity and keep this session local.' },
    guest: { label: 'Guest', glyph: '○', color: '#c9c9d8', description: 'A lightweight mode for sharing the desktop safely.' }
  };
  const BUILTIN_ROUTINES = [
    { id: 'routine-focus', name: 'Start deep focus', glyph: '◉', mode: 'focus', apps: ['notes', 'todo'], description: 'Quiet the desktop and open Notes and To-do.' },
    { id: 'routine-school', name: 'Open school desk', glyph: '✎', mode: 'school', apps: ['notes', 'calendar', 'todo'], description: 'Prepare a simple school workspace.' },
    { id: 'routine-game', name: 'Game night', glyph: '✦', mode: 'gaming', apps: ['games', 'music'], description: 'Switch to Gaming mode and open entertainment.' },
    { id: 'routine-private', name: 'Private session', glyph: '◇', mode: 'private', apps: [], description: 'Use Private mode without opening anything new.' }
  ];

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
  const state = { ...DEFAULT_STATE, ...(read(STATE_KEY, {}) || {}) };
  state.routines = Array.isArray(state.routines) ? state.routines.slice(0, 12) : [];
  let currentHub = null;

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'style') node.setAttribute('style', value);
      else if (key.startsWith('data-') || key.startsWith('aria-')) node.setAttribute(key, String(value));
      else node[key] = value;
    });
    children.forEach(child => node.append(child));
    return node;
  }

  function button(label, action, className = 'idk-next-button') {
    const item = el('button', { class: className, type: 'button', text: label });
    item.addEventListener('click', action);
    return item;
  }

  function notify(title, message, kind = 'info') {
    window.OS?.notify?.(title, message, kind);
  }

  function commit() {
    write(STATE_KEY, state);
    write('idkFocusMode', state.focus);
    const desktop = document.getElementById('desktop');
    if (desktop) {
      desktop.dataset.focusMode = state.focus;
      desktop.dataset.safeMode = String(state.safeMode);
      desktop.classList.toggle('idk-high-contrast', state.highContrast);
      desktop.classList.toggle('idk-next-reduced-motion', state.reducedMotion);
    }
    document.documentElement.dataset.idkGuest = String(state.guestMode);
    window.dispatchEvent(new CustomEvent('idk-next-state', { detail: { ...state } }));
  }

  function setFocus(mode, quiet = false) {
    if (!FOCUS_MODES[mode]) return;
    state.focus = mode;
    state.guestMode = mode === 'guest';
    commit();
    if (!quiet) notify('Focus mode', `${FOCUS_MODES[mode].label} mode is active.`);
    if (currentHub) renderHubTab('focus');
  }

  function appExists(id) {
    return typeof APPS !== 'undefined' && Boolean(APPS[id]);
  }

  function openApp(id) {
    if (!appExists(id)) return notify('IDK Hub', `${id} is not available in this build.`, 'warning');
    window.OS?.open?.(id);
  }

  function runRoutine(routine) {
    if (!routine) return;
    setFocus(routine.mode || 'balanced', true);
    const apps = state.safeMode ? [] : (Array.isArray(routine.apps) ? routine.apps.filter(appExists) : []);
    apps.forEach((id, index) => setTimeout(() => openApp(id), index * 120));
    notify('Routine started', state.safeMode ? `${routine.name} is ready. Safe mode kept apps closed.` : `${routine.name} is ready.`);
    if (!state.doNotTrack) window.dispatchEvent(new CustomEvent('idk-activity', { detail: { title: 'Routine', message: `${routine.name} started.`, kind: 'success', at: Date.now() } }));
  }

  function allRoutines() {
    return [...BUILTIN_ROUTINES, ...state.routines];
  }

  function snapshots() {
    const list = read(SNAPSHOT_KEY, []);
    return Array.isArray(list) ? list.filter(item => item && item.values).slice(0, 8) : [];
  }

  function snapshotValues() {
    const values = {};
    SAFE_KEYS.forEach(key => {
      try { values[key] = localStorage.getItem(key); } catch { values[key] = null; }
    });
    return values;
  }

  function createSnapshot(name = 'Desktop snapshot') {
    const item = { id: `snapshot-${Date.now()}`, name: name.trim().slice(0, 48) || 'Desktop snapshot', createdAt: Date.now(), values: snapshotValues() };
    write(SNAPSHOT_KEY, [item, ...snapshots()].slice(0, 8));
    notify('Recovery', `${item.name} was saved.`);
    return item;
  }

  function restoreSnapshot(item) {
    if (!item?.values) return;
    Object.entries(item.values).forEach(([key, value]) => {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {}
    });
    notify('Recovery', `${item.name} restored. Reloading the desktop.`);
    setTimeout(() => location.reload(), 350);
  }

  function downloadJSON(name, value) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function storageLabel() {
    const count = localStorage.length;
    return `${count} saved item${count === 1 ? '' : 's'}`;
  }

  function stat(label, value, detail = '') {
    return el('article', { class: 'idk-next-stat' }, [el('strong', { text: value }), el('span', { text: label }), detail ? el('small', { text: detail }) : el('span')]);
  }

  function renderOverview() {
    const root = el('section', { class: 'idk-next-panel' });
    const mode = FOCUS_MODES[state.focus] || FOCUS_MODES.balanced;
    root.append(
      el('div', { class: 'idk-next-hero' }, [
        el('div', { class: 'idk-next-eyebrow', text: 'IDK NEXT CONTROL CENTER' }),
        el('h2', { text: 'Your desktop, organized.' }),
        el('p', { text: 'Switch context, recover your workspace, and keep the important controls in one place.' }),
        el('div', { class: 'idk-next-actions' }, [button('Command palette', () => openPalette()), button('Open Settings', () => openApp('settings'), 'idk-next-button secondary'), button('Save snapshot', () => { createSnapshot(); renderHubTab('recovery'); }, 'idk-next-button secondary'), button('Share workspace', () => window.IDKDataLayer?.shareWorkspace?.(), 'idk-next-button secondary')])
      ]),
      el('div', { class: 'idk-next-stat-grid' }, [
        stat('Current mode', mode.label, mode.description),
        stat('Desktop activity', String(window.OS?.getActivityHistory?.().length || 0), 'Recent local events'),
        stat('Saved browser data', storageLabel(), 'Kept on this device'),
        stat('Connection', navigator.onLine ? 'Online' : 'Offline', navigator.onLine ? 'Ready to sync' : 'Changes stay local')
      ])
    );

    const modes = el('div', { class: 'idk-next-section' }, [el('div', { class: 'idk-next-section-heading' }, [el('div', {}, [el('h3', { text: 'Choose a mode' }), el('p', { text: 'One click changes the feel of your desktop.' })])])]);
    const modeGrid = el('div', { class: 'idk-next-mode-grid' });
    Object.entries(FOCUS_MODES).forEach(([id, item]) => {
      const card = el('button', { class: `idk-next-mode-card${state.focus === id ? ' active' : ''}`, type: 'button' }, [el('strong', { text: `${item.glyph} ${item.label}` }), el('span', { text: item.description })]);
      card.style.setProperty('--mode-color', item.color);
      card.addEventListener('click', () => setFocus(id));
      modeGrid.append(card);
    });
    modes.append(modeGrid);
    root.append(modes);

    const routineGrid = el('div', { class: 'idk-next-section' }, [el('div', { class: 'idk-next-section-heading' }, [el('div', {}, [el('h3', { text: 'Quick routines' }), el('p', { text: 'Open the apps you need with a single action.' })]), button('Manage routines', () => renderHubTab('automations'), 'idk-next-button small')])]);
    const routines = el('div', { class: 'idk-next-routine-grid' });
    allRoutines().slice(0, 4).forEach(routine => {
      routines.append(el('article', { class: 'idk-next-routine-card' }, [el('div', { class: 'idk-next-routine-glyph', text: routine.glyph || '✦' }), el('div', {}, [el('strong', { text: routine.name }), el('p', { text: routine.description || 'Saved routine' }), button('Run', () => runRoutine(routine), 'idk-next-button small')])]))
    });
    routineGrid.append(routines);
    root.append(routineGrid);
    return root;
  }

  function renderFocus() {
    const root = el('section', { class: 'idk-next-panel' });
    const heading = el('div', { class: 'idk-next-section-heading' });
    heading.append(el('div', {}, [el('h2', { text: 'Focus modes' }), el('p', { text: 'Change your desktop context without losing your files or apps.' })]));
    root.append(heading);
    const list = el('div', { class: 'idk-next-focus-list' });
    Object.entries(FOCUS_MODES).forEach(([id, item]) => {
      const card = el('article', { class: `idk-next-focus-card${state.focus === id ? ' active' : ''}` }, [el('div', { class: 'idk-next-focus-icon', text: item.glyph }), el('div', {}, [el('strong', { text: item.label }), el('p', { text: item.description })]), button(state.focus === id ? 'Active' : 'Use mode', () => setFocus(id), 'idk-next-button small')]);
      card.style.setProperty('--mode-color', item.color);
      list.append(card);
    });
    root.append(list, el('div', { class: 'idk-next-callout', text: 'Tip: use Ctrl/Cmd + Shift + P to open this screen from anywhere.' }));
    return root;
  }

  function renderAutomations() {
    const root = el('section', { class: 'idk-next-panel' });
    const heading = el('div', { class: 'idk-next-section-heading' });
    heading.append(el('div', {}, [el('h2', { text: 'Automation center' }), el('p', { text: 'Build small routines for the way you use IDK.' })]));
    root.append(heading);
    const builtins = el('div', { class: 'idk-next-routine-list' });
    allRoutines().forEach(routine => {
      const row = el('article', { class: 'idk-next-routine-row' }, [el('span', { class: 'idk-next-routine-glyph', text: routine.glyph || '✦' }), el('div', {}, [el('strong', { text: routine.name }), el('small', { text: routine.description || `${routine.apps?.length || 0} apps` })]), button('Run', () => runRoutine(routine), 'idk-next-button small')]);
      if (routine.id && !BUILTIN_ROUTINES.some(item => item.id === routine.id)) row.append(button('Delete', () => { state.routines = state.routines.filter(item => item.id !== routine.id); commit(); renderHubTab('automations'); }, 'idk-next-button danger small'));
      builtins.append(row);
    });
    const form = el('form', { class: 'idk-next-form' });
    const name = el('input', { class: 'field', name: 'name', placeholder: 'Routine name', maxlength: 40, required: true });
    const mode = el('select', { class: 'field', name: 'mode' });
    Object.entries(FOCUS_MODES).forEach(([id, item]) => mode.append(el('option', { value: id, text: item.label })));
    const apps = el('input', { class: 'field', name: 'apps', placeholder: 'Apps to open, e.g. notes, calendar' });
    form.append(el('label', {}, [el('span', { text: 'Name' }), name]), el('label', {}, [el('span', { text: 'Mode' }), mode]), el('label', {}, [el('span', { text: 'Apps' }), apps]), button('Save routine', event => { event.preventDefault(); const item = { id: `custom-${Date.now()}`, name: name.value.trim(), mode: mode.value, apps: apps.value.split(',').map(value => value.trim()).filter(Boolean).slice(0, 6), description: 'Custom IDK routine', glyph: '✦' }; if (!item.name) return; state.routines = [item, ...state.routines].slice(0, 12); commit(); name.value = ''; apps.value = ''; notify('Automation center', `${item.name} was saved.`); renderHubTab('automations'); }));
    root.append(builtins, el('div', { class: 'idk-next-section idk-next-create' }, [el('h3', { text: 'Create a routine' }), form]));
    return root;
  }

  function toggleRow(label, description, key) {
    const input = el('input', { type: 'checkbox', checked: Boolean(state[key]) });
    input.addEventListener('change', () => { state[key] = input.checked; commit(); });
    return el('label', { class: 'idk-next-toggle' }, [el('span', {}, [el('strong', { text: label }), el('small', { text: description })]), input]);
  }

  function renderPrivacy() {
    const root = el('section', { class: 'idk-next-panel' });
    const permissions = read('idkAppPermissions', {});
    const permissionCount = Object.values(permissions && typeof permissions === 'object' ? permissions : {}).reduce((total, item) => total + Object.values(item || {}).filter(Boolean).length, 0);
    const heading = el('div', { class: 'idk-next-section-heading' });
    heading.append(el('div', {}, [el('h2', { text: 'Privacy and safety' }), el('p', { text: 'Simple controls for what IDK stores and how it behaves.' })]));
    root.append(heading);
    root.append(el('div', { class: 'idk-next-safety-grid' }, [
      stat('Permission grants', String(permissionCount), 'Review App Permissions for detail'),
      stat('Storage', storageLabel(), 'This browser only'),
      stat('Guest mode', state.guestMode ? 'On' : 'Off', 'No account is required')
    ]));
    root.append(el('div', { class: 'idk-next-toggle-list' }, [
      toggleRow('Safe mode', 'Keep optional app features quiet while troubleshooting.', 'safeMode'),
      toggleRow('Do not track locally', 'Avoid recording new IDK timeline events.', 'doNotTrack'),
      toggleRow('High contrast', 'Increase contrast across the desktop.', 'highContrast'),
      toggleRow('Reduce motion', 'Turn off decorative desktop motion.', 'reducedMotion'),
      toggleRow('Guest mode', 'Use a lightweight temporary desktop profile.', 'guestMode')
    ]));
    root.append(el('div', { class: 'idk-next-actions' }, [
      button('App Permissions', () => openApp('permissions')),
      button('Clear activity', () => { window.OS?.clearActivity?.(); notify('Privacy', 'Local activity was cleared.'); renderHubTab('privacy'); }, 'idk-next-button secondary'),
      button('Export privacy report', () => downloadJSON(`idk-privacy-report-${Date.now()}.json`, { exportedAt: new Date().toISOString(), online: navigator.onLine, storageItems: localStorage.length, permissions: Object.keys(permissions || {}), focusMode: state.focus }), 'idk-next-button secondary')
    ]));
    return root;
  }

  function renderPerformance() {
    const root = el('section', { class: 'idk-next-panel' });
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const heading = el('div', { class: 'idk-next-section-heading' });
    heading.append(el('div', {}, [el('h2', { text: 'Performance and health' }), el('p', { text: 'See how this browser is handling your IDK session.' })]));
    root.append(heading);
    const grid = el('div', { class: 'idk-next-safety-grid' }, [stat('CPU threads', String(navigator.hardwareConcurrency || '—'), 'Browser-reported'), stat('Memory', navigator.deviceMemory ? `${navigator.deviceMemory} GB` : '—', 'Browser-reported'), stat('Network', connection?.effectiveType || (navigator.onLine ? 'Online' : 'Offline'), connection?.saveData ? 'Data saver on' : 'Normal connection')]);
    const status = el('p', { class: 'idk-next-status', text: 'Run a quick check to measure local storage and desktop response.' });
    const test = button('Run quick check', async () => {
      test.disabled = true;
      const started = performance.now();
      const probe = `idk-health-${Date.now()}`;
      try { localStorage.setItem(probe, 'ok'); localStorage.removeItem(probe); } catch {}
      const elapsed = Math.round(performance.now() - started);
      status.textContent = `Local check completed in ${elapsed} ms. ${elapsed < 20 ? 'Everything looks responsive.' : 'The browser may be under load.'}`;
      test.disabled = false;
    });
    root.append(grid, el('div', { class: 'idk-next-health-card' }, [el('strong', { text: 'Local health check' }), status, test]), el('div', { class: 'idk-next-actions' }, [button('Restore saved workspace', () => window.OS?.restoreWorkspace?.()), button('Open System Self-Test', () => openApp('selftest'), 'idk-next-button secondary'), button('Reload desktop', () => location.reload(), 'idk-next-button secondary')]));
    return root;
  }

  function renderRecovery() {
    const root = el('section', { class: 'idk-next-panel' });
    const list = snapshots();
    root.append(el('div', { class: 'idk-next-section-heading' }, [el('div', {}, [el('h2', { text: 'Recovery and portability' }), el('p', { text: 'Save a safe copy of your layout and personal desktop preferences.' })]), button('Create snapshot', () => { createSnapshot(`Snapshot ${new Date().toLocaleString()}`); renderHubTab('recovery'); }, 'idk-next-button small')]));
    const snapshotsList = el('div', { class: 'idk-next-snapshot-list' });
    if (!list.length) snapshotsList.append(el('div', { class: 'idk-next-empty', text: 'No snapshots yet. Create one before changing your setup.' }));
    list.forEach(item => {
      const row = el('article', { class: 'idk-next-snapshot' });
      row.append(el('div', {}, [el('strong', { text: item.name }), el('small', { text: new Date(item.createdAt).toLocaleString() })]), button('Restore', () => restoreSnapshot(item), 'idk-next-button small'));
      snapshotsList.append(row);
    });
    root.append(snapshotsList, el('div', { class: 'idk-next-actions' }, [button('Full backup and restore', () => window.IDKBackup?.open?.()), button('Share workspace', () => window.IDKDataLayer?.shareWorkspace?.(), 'idk-next-button secondary'), button('Export desktop settings', () => downloadJSON(`idk-desktop-settings-${Date.now()}.json`, { exportedAt: new Date().toISOString(), values: snapshotValues() }), 'idk-next-button secondary'), button('Reset saved layout', () => { localStorage.removeItem('desktopOrder'); localStorage.removeItem('idkDesktopIconPositions'); notify('Recovery', 'The desktop layout will reset after reload.'); }, 'idk-next-button danger')]));
    return root;
  }

  function applyThemeChoice(theme) {
    write('theme', theme);
    window.applyTheme?.(theme);
    notify('Appearance', `${theme} theme applied.`);
  }

  function renderAppearance() {
    const root = el('section', { class: 'idk-next-panel' });
    const themes = ['midnight', 'neon', 'sunset', 'mono', 'ocean', 'forest', 'candy'];
    const wallpapers = [
      ['IDK Blue', 'https://plain-wnam-prod-public.komododecks.com/202608/09/2mq0HYHmjO3qexTDZY9G/image.png'],
      ['Violet Horizon', 'linear-gradient(135deg, #101a3d 0%, #16224a 48%, #4b1f57 100%)'],
      ['Neon Tide', 'radial-gradient(circle at 18% 20%, rgba(126, 246, 168, .24), transparent 26%), linear-gradient(135deg, #062a35, #071020 58%, #123f4c)'],
      ['Sunset Bloom', 'linear-gradient(135deg, #27182d 0%, #6b2d50 52%, #f08a65 100%)'],
      ['Graphite', 'linear-gradient(135deg, #080b13 0%, #202938 48%, #596273 100%)']
    ];
    const heading = el('div', { class: 'idk-next-section-heading' });
    heading.append(el('div', {}, [el('h2', { text: 'Appearance studio' }), el('p', { text: 'Make IDK feel like your own desktop.' })]));
    root.append(heading);
    const themeGrid = el('div', { class: 'idk-next-theme-grid' });
    themes.forEach(theme => { const item = button(theme, () => applyThemeChoice(theme), 'idk-next-theme'); item.dataset.themeChoice = theme; themeGrid.append(item); });
    const wallpaperGrid = el('div', { class: 'idk-next-wallpaper-grid' });
    wallpapers.forEach(([label, value]) => { const item = button(label, () => { write('wallpaper', value); window.applyWallpaper?.(value); notify('Appearance', `${label} wallpaper applied.`); }, 'idk-next-wallpaper'); item.style.setProperty('--swatch', value); wallpaperGrid.append(item); });
    root.append(el('h3', { class: 'idk-next-subheading', text: 'Themes' }), themeGrid, el('h3', { class: 'idk-next-subheading', text: 'Wallpapers' }), wallpaperGrid);
    return root;
  }

  function renderHubTab(tab) {
    if (!currentHub) return;
    const panel = currentHub.querySelector('[data-next-panel]');
    const nav = currentHub.querySelectorAll('[data-next-tab]');
    const views = { overview: renderOverview, focus: renderFocus, automations: renderAutomations, privacy: renderPrivacy, performance: renderPerformance, recovery: renderRecovery, appearance: renderAppearance };
    const render = views[tab] || views.overview;
    nav.forEach(item => item.classList.toggle('active', item.dataset.nextTab === tab));
    panel.replaceChildren(render());
    currentHub.dataset.nextActiveTab = tab;
  }

  function renderHub(opts = {}) {
    const root = el('div', { class: 'app idk-next-hub' });
    const header = el('header', { class: 'idk-next-header' }, [el('div', {}, [el('span', { class: 'idk-next-kicker', text: 'IDK 10.0' }), el('h2', { text: 'IDK Hub' }), el('p', { text: 'One control center for your desktop.' })]), button('Command palette', () => openPalette(), 'idk-next-button small')]);
    const nav = el('nav', { class: 'idk-next-nav', 'aria-label': 'IDK Hub sections' });
    [['overview', 'Overview'], ['focus', 'Focus'], ['automations', 'Routines'], ['privacy', 'Privacy'], ['performance', 'Health'], ['recovery', 'Recovery'], ['appearance', 'Appearance']].forEach(([id, label]) => { const item = button(label, () => renderHubTab(id), 'idk-next-tab'); item.dataset.nextTab = id; nav.append(item); });
    root.append(header, nav, el('div', { class: 'idk-next-body', 'data-next-panel': '' }));
    currentHub = root;
    const onState = () => renderHubTab(root.dataset.nextActiveTab || 'overview');
    const onTab = event => { if (event.detail?.tab) renderHubTab(event.detail.tab); };
    window.addEventListener('idk-next-state', onState);
    window.addEventListener('idk-next-tab', onTab);
    root.cleanup = () => { window.removeEventListener('idk-next-state', onState); window.removeEventListener('idk-next-tab', onTab); if (currentHub === root) currentHub = null; };
    renderHubTab(opts.tab || 'overview');
    return root;
  }

  function openHub(tab = 'overview') {
    window.OS?.open?.('idk-hub', { title: 'IDK Hub', tab, width: 960, height: 700 });
    setTimeout(() => window.dispatchEvent(new CustomEvent('idk-next-tab', { detail: { tab } })), 80);
  }

  function openPalette() {
    if (window.IDKUnifiedSearch?.open) return window.IDKUnifiedSearch.open();
    const existing = document.getElementById('idk-next-palette');
    if (existing) { existing.hidden = false; existing.querySelector('input')?.focus(); return; }
    const overlay = el('section', { id: 'idk-next-palette', role: 'dialog', 'aria-label': 'IDK command palette' });
    const input = el('input', { class: 'field', placeholder: 'Search apps, routines, and settings…', autocomplete: 'off' });
    const results = el('div', { class: 'idk-next-palette-results' });
    const items = [
      { title: 'Open IDK Hub', detail: 'Control center', run: () => openHub() },
      { title: 'Deep Focus mode', detail: 'Focus', run: () => setFocus('focus') },
      { title: 'Open Files', detail: 'App', run: () => openApp('files') },
      { title: 'Open Settings', detail: 'App', run: () => openApp('settings') },
      { title: 'Open Browser', detail: 'App', run: () => openApp('proxy') },
      { title: 'Open App Permissions', detail: 'Privacy', run: () => openApp('permissions') },
      { title: 'Restore saved workspace', detail: 'Recovery', run: () => window.OS?.restoreWorkspace?.() },
      ...allRoutines().map(routine => ({ title: `Run ${routine.name}`, detail: 'Routine', run: () => runRoutine(routine) })),
      ...Object.entries(typeof APPS === 'undefined' ? {} : APPS).filter(([id]) => id !== 'player' && id !== 'idk-hub').map(([id, app]) => ({ title: `Open ${app.title}`, detail: 'App', run: () => openApp(id) }))
    ];
    const render = () => {
      const query = input.value.trim().toLowerCase();
      results.replaceChildren(...items.filter(item => !query || `${item.title} ${item.detail}`.toLowerCase().includes(query)).slice(0, 24).map(item => { const row = button(item.title, () => { overlay.remove(); item.run(); }, 'idk-next-palette-item'); row.append(el('small', { text: item.detail })); return row; }));
      if (!results.children.length) results.append(el('div', { class: 'idk-next-empty', text: 'No matching command.' }));
    };
    overlay.append(el('div', { class: 'idk-next-palette-card' }, [el('div', { class: 'idk-next-palette-heading' }, [el('strong', { text: 'Command palette' }), button('×', () => overlay.remove(), 'idk-next-close')]), input, results, el('small', { class: 'idk-next-shortcut', text: 'Press Escape to close' })]));
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    input.addEventListener('input', render);
    document.body.append(overlay);
    render();
    input.focus();
  }

  function installLauncher() {
    if (document.getElementById('idk-next-bar')) return;
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    const bar = el('div', { id: 'idk-next-bar', 'aria-label': 'IDK Hub shortcuts' });
    const control = button('◉ Control', () => openApp('control-center'), 'idk-next-launcher');
    control.setAttribute('aria-label', 'Open Control Center');
    bar.append(button('✦ Hub', () => openHub(), 'idk-next-launcher'), button('◉ Focus', () => openHub('focus'), 'idk-next-launcher'), button('⌕ Search', () => openPalette(), 'idk-next-launcher'), control);
    desktop.append(bar);
    window.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyP') { event.preventDefault(); openHub('focus'); }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyC') { event.preventDefault(); openApp('control-center'); }
      if (event.key === 'Escape') document.getElementById('idk-next-palette')?.remove();
    });
  }

  if (typeof APPS !== 'undefined' && !APPS['idk-hub']) {
    APPS['idk-hub'] = { title: 'IDK Hub', glyph: '✦', desktop: false, dock: false, width: 960, height: 700, render: renderHub };
  }
  commit();
  installLauncher();
  window.IDKNext = { open: openHub, openPalette, setFocus, runRoutine, createSnapshot, restoreSnapshot, state: () => ({ ...state, routines: state.routines.map(item => ({ ...item })) }) };
})();

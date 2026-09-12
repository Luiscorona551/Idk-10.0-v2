(() => {
  'use strict';
  if (window.IDKOSExpansion) return;

  const SETTINGS_KEY = 'idkOsExpansionSettings';
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const button = (label, action, className = 'btn tab') => { const item = document.createElement('button'); item.type = 'button'; item.className = className; item.textContent = label; item.onclick = action; return item; };
  const open = (id, options) => window.OS?.open?.(id, options);
  let autoLockTimer = 0;

  function settings() { return { autoLock: 0, mobileMode: false, ...read(SETTINGS_KEY, {}) }; }
  function lockNow() {
    if (window.IDKFeaturePack?.lockScreen) window.IDKFeaturePack.lockScreen();
    else notify('Session', 'The lock screen is unavailable in this build.', 'warning');
  }
  function armAutoLock() {
    clearTimeout(autoLockTimer);
    const minutes = Number(settings().autoLock);
    if (minutes > 0) autoLockTimer = setTimeout(lockNow, minutes * 60000);
  }
  function installAutoLock() {
    const reset = event => { if (event.target.closest?.('#idk-pack-lock, #idk-profile-lock')) return; armAutoLock(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(type => document.addEventListener(type, reset, { passive: true }));
    armAutoLock();
  }
  function applyAccessibility(state) {
    write('idkAccessibility', state);
    document.body.classList.toggle('idk-high-contrast', Boolean(state.highContrast));
    document.body.classList.toggle('idk-reduce-motion', Boolean(state.reduceMotion));
    document.body.classList.toggle('idk-large-text', Boolean(state.largeText));
    if (typeof applyMotion === 'function') applyMotion(state.reduceMotion ? 'off' : 'on');
  }
  function setMobileMode(enabled) {
    const next = { ...settings(), mobileMode: Boolean(enabled) };
    write(SETTINGS_KEY, next);
    document.body.classList.toggle('idk-mobile-mode', next.mobileMode);
  }
  async function healthText() {
    try {
      const response = await fetch('/healthz', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      return response.ok && data.ok !== false ? 'Healthy' : 'Needs attention';
    } catch { return 'Unavailable'; }
  }
  function card(title, detail, status) {
    const root = document.createElement('article'); root.className = 'idk-expansion-card';
    root.innerHTML = `<div class="idk-expansion-card-copy"><strong>${esc(title)}</strong><p>${esc(detail)}</p><small data-status>${esc(status || '')}</small></div><div class="idk-expansion-actions"></div>`;
    return root;
  }
  function sessionCard() {
    const value = settings(), profile = window.IDKAccount?.user?.username || window.IDKConnectivitySuite?.activeProfile?.()?.name || 'Local profile';
    const root = card('1. Sessions & Lock Screen', 'Protect this browser session and automatically lock it after inactivity.', `${profile} · ${value.autoLock ? `auto-lock after ${value.autoLock} min` : 'auto-lock off'}`);
    const actions = root.querySelector('.idk-expansion-actions');
    const select = document.createElement('select'); select.className = 'field'; select.setAttribute('aria-label', 'Auto-lock delay'); [['0', 'Auto-lock off'], ['5', '5 minutes'], ['15', '15 minutes'], ['30', '30 minutes']].forEach(([key, label]) => select.append(new Option(label, key))); select.value = String(value.autoLock);
    actions.append(select, button('Lock now', lockNow, 'btn'));
    select.onchange = () => { write(SETTINGS_KEY, { ...settings(), autoLock: Number(select.value) }); armAutoLock(); root.querySelector('[data-status]').textContent = select.value === '0' ? `${profile} · auto-lock off` : `${profile} · auto-lock after ${select.value} min`; notify('Session', 'Auto-lock preference saved.', 'success'); };
    return root;
  }
  function healthCard() {
    const root = card('2. App Health Center', 'Check the server, storage, offline shell, and account services.', 'Checking server health…');
    const status = root.querySelector('[data-status]'), actions = root.querySelector('.idk-expansion-actions');
    const refresh = async () => { status.textContent = 'Checking server health…'; status.textContent = `Server: ${await healthText()} · ${navigator.onLine ? 'online' : 'offline'}`; };
    actions.append(button('Refresh', refresh, 'btn'), button('Open health', () => window.IDKPerfectOS?.openHealth?.() || open('health'))); refresh(); return root;
  }
  function expansionApp() {
    const root = document.createElement('div'); root.className = 'app idk-os-expansion';
    root.innerHTML = '<header class="idk-nonchat-head"><div><span class="idk-nonchat-kicker">IDK WEB OS EXPANSION</span><h2>OS Expansion Hub</h2><p>The eleven requested system upgrades, connected to the features already installed in IDK.</p></div><span class="idk-nonchat-badge">11 MODULES</span></header><div class="idk-expansion-grid" data-grid></div><p class="idk-nonchat-status" data-note>Local-first controls. Cloud actions only run when you choose them.</p>';
    const grid = root.querySelector('[data-grid]');
    const append = (item, title, detail, status, actions) => { const value = item || card(title, detail, status); value.querySelector('.idk-expansion-actions').append(...actions); grid.append(value); };
    grid.append(sessionCard(), healthCard());
    append(null, '3. Cloud Drives', 'Connect IDK Account, WebDAV/JSON, Supabase, or Firebase for Files and settings.', 'Local Files are always available', [button('Cloud Sync', () => window.IDKAccountsDevices?.open?.('sync') || open('accounts', { tab: 'sync' })), button('Open Files', () => open('files'))]);
    append(null, '4. Window Manager', 'Arrange windows, save layouts, and restore the workspace after a restart.', 'Desktop Center controls', [button('Desktop Center', () => window.IDKBatchTwentyOne?.open?.() || open('desktopCenter')), button('Tile split', () => window.IDKWindowManager?.tileLayout?.('split'))]);
    append(null, '5. Privacy & Permissions', 'Review app capabilities, installed-program approvals, and recovery controls.', 'Permission-aware', [button('App Permissions', () => open('permissions')), button('Safety Center', () => window.IDKPlatformNext?.openSafetyCenter?.())]);
    append(null, '6. Update Center', 'Check the server release, offline shell, and installed web-app updates.', 'Stable channel', [button('System updates', () => window.IDKProductFeatures?.updateCenter?.()), button('App Manager', () => window.IDKPlatformNext?.openAppManager?.())]);
    append(null, '7. Web App Installer', 'Discover, install, sandbox, approve, update, and roll back HTML apps.', 'Sandboxed programs', [button('Discover apps', () => window.IDKPlatformNext?.openDiscovery?.()), button('Install HTML', () => window.IDKInstaller?.open?.() || open('apps'))]);
    append(null, '8. Cross-Device Clipboard', 'Keep recent text available locally and sync it through the signed-in account.', 'Universal Clipboard', [button('Open clipboard', () => window.IDKOSNext?.openShareSheet?.()), button('Accounts & Devices', () => window.IDKAccountsDevices?.open?.('sync'))]);
    append(null, '9. Workspace Sharing', 'Share a safe workspace bundle or collaborate through an IDK room.', 'Export or share', [button('Share workspace', () => window.IDKDataLayer?.shareWorkspace?.()), button('Open Rooms', () => open('rooms'))]);
    const accessibility = { highContrast: false, reduceMotion: false, largeText: false, ...read('idkAccessibility', {}) };
    const access = card('10. Accessibility', 'Apply high contrast, reduced motion, and larger text without leaving the desktop.', 'Preferences stay on this device');
    const accessActions = access.querySelector('.idk-expansion-actions');
    [['highContrast', 'Contrast'], ['reduceMotion', 'Motion'], ['largeText', 'Text']].forEach(([key, label]) => { const item = document.createElement('label'); item.className = 'idk-expansion-check'; const input = document.createElement('input'); input.type = 'checkbox'; input.checked = Boolean(accessibility[key]); input.onchange = () => { accessibility[key] = input.checked; applyAccessibility(accessibility); }; item.append(input, document.createTextNode(label)); accessActions.append(item); });
    accessActions.append(button('Settings', () => open('settings', { tab: 'desktop' }))); grid.append(access);
    const mobile = settings();
    const mobileCard = card('11. Mobile Companion Layout', 'Use touch-sized controls and a focused single-column desktop on narrow screens.', mobile.mobileMode ? 'Companion mode on' : `Responsive mode · ${window.innerWidth}px wide`);
    const mobileActions = mobileCard.querySelector('.idk-expansion-actions');
    mobileActions.append(button(mobile.mobileMode ? 'Turn off companion' : 'Turn on companion', () => { setMobileMode(!settings().mobileMode); root.remove(); open('osExpansion'); }, 'btn'), button('Open appearance', () => open('settings', { tab: 'desktop' })));
    grid.append(mobileCard);
    return root;
  }
  function register() {
    if (typeof APPS === 'undefined') return setTimeout(register, 150);
    APPS.osExpansion ||= { title: 'OS Expansion Hub', glyph: '◌', category: 'System', desktop: true, dock: false, width: 980, height: 720, render: expansionApp };
  }
  function install() {
    const value = settings();
    document.body.classList.toggle('idk-mobile-mode', value.mobileMode);
    applyAccessibility({ highContrast: false, reduceMotion: false, largeText: false, ...read('idkAccessibility', {}) });
    installAutoLock();
    register();
  }
  window.IDKOSExpansion = { open: () => open('osExpansion'), lock: lockNow, armAutoLock, setMobileMode };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

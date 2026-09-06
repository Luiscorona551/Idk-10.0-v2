(() => {
  'use strict';
  if (window.IDKBatchNine) return;

  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const accountUser = () => window.IDKAccount?.user || null;
  const button = (label, action, className = 'btn') => { const item = document.createElement('button'); item.type = 'button'; item.className = className; item.textContent = label; item.onclick = action; return item; };
  const panel = (title, copy, html) => { const root = document.createElement('section'); root.className = 'idk-settings-panel'; root.innerHTML = `<header><div><h2>${esc(title)}</h2><p>${esc(copy)}</p></div></header>${html}`; return root; };

  function installStyle() { if (document.querySelector('link[href="idk-batch-nine.css"]')) return; const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'idk-batch-nine.css'; document.head.append(link); }

  function applySavedAppearance() {
    const theme = read('theme', 'midnight'), wallpaper = read('wallpaper', '');
    if (typeof applyTheme === 'function') applyTheme(theme);
    if (typeof applyWallpaper === 'function' && wallpaper) applyWallpaper(wallpaper);
    if (typeof applyIconSize === 'function') applyIconSize(read('iconSize', 'normal'));
    if (typeof applyDockPosition === 'function') applyDockPosition(read('dockPosition', 'bottom'));
    if (typeof applyMotion === 'function') applyMotion(read('motion', 'on'));
  }

  function overviewPane(open) {
    const user = accountUser(), files = read('idkFileSystem', []), workspace = read('idkWorkspace', []);
    const root = panel('Settings Hub', 'One place for how IDK looks, works, syncs, and recovers.', '<div class="idk-settings-hero"><div><strong>Welcome back</strong><span>Manage this device without hunting through separate apps.</span></div><button class="btn" data-handoff>Open Device Handoff</button></div><div class="idk-settings-cards" data-cards></div><div class="idk-settings-section"><h3>Quick access</h3><div class="idk-settings-actions" data-actions></div></div>');
    const cards = root.querySelector('[data-cards]');
    [['Account', user ? user.username : 'Guest mode', user ? 'Cloud sync ready' : 'Local data only', 'account'], ['Appearance', read('theme', 'midnight'), `${read('iconSize', 'normal')} icons`, 'appearance'], ['Storage', `${files.filter(item => item.type === 'file').length} files`, `${workspace.length || 0} saved windows`, 'storage'], ['Connection', navigator.onLine ? 'Online' : 'Offline', navigator.onLine ? 'Sync available' : 'Changes stay local', 'handoff']].forEach(([title, value, detail, tab]) => { const card = document.createElement('button'); card.type = 'button'; card.className = 'idk-settings-card'; card.innerHTML = `<strong>${esc(value)}</strong><span>${esc(title)}</span><small>${esc(detail)}</small>`; card.onclick = () => open(tab); cards.append(card); });
    root.querySelector('[data-handoff]').onclick = () => open('handoff');
    [['Appearance', 'appearance'], ['Desktop & Accessibility', 'desktop'], ['Notifications', 'notifications'], ['Privacy & Recovery', 'privacy'], ['Account & Sync', 'account'], ['Connected Devices', 'devices']].forEach(([label, tab]) => root.querySelector('[data-actions]').append(button(label, () => open(tab), 'btn tab')));
    return root;
  }

  function appearancePane() {
    const root = panel('Appearance', 'Change the visual language of this IDK device.', '<div class="idk-settings-form"><label>Theme<select class="field" data-theme><option value="midnight">Midnight</option><option value="neon">Neon</option><option value="sunset">Sunset</option><option value="mono">Monochrome</option><option value="ocean">Ocean</option><option value="forest">Forest</option><option value="candy">Candy</option></select></label><label>Wallpaper URL or CSS gradient<input class="field" data-wallpaper placeholder="https://... or linear-gradient(...)" /></label><label>Clock<select class="field" data-clock><option value="false">12-hour</option><option value="true">24-hour</option></select></label></div><div class="idk-settings-actions"><button class="btn" data-save>Apply appearance</button></div><p class="idk-settings-note" data-status>Changes apply immediately to this device and sync with your account.</p>');
    root.querySelector('[data-theme]').value = read('theme', 'midnight'); root.querySelector('[data-wallpaper]').value = read('wallpaper', ''); root.querySelector('[data-clock]').value = String(read('clock24', false));
    root.querySelector('[data-save]').onclick = () => { const theme = root.querySelector('[data-theme]').value, wallpaper = root.querySelector('[data-wallpaper]').value.trim(), clock24 = root.querySelector('[data-clock]').value === 'true'; write('theme', theme); write('wallpaper', wallpaper); write('clock24', clock24); applySavedAppearance(); if (window.OS?.tickClock) window.OS.tickClock(); root.querySelector('[data-status]').textContent = 'Appearance applied.'; notify('Settings', 'Appearance updated.', 'success'); };
    return root;
  }

  function desktopPane() {
    const root = panel('Desktop & Accessibility', 'Tune layout, motion, text, and the saved workspace.', '<div class="idk-settings-form"><label>Desktop icon size<select class="field" data-size><option value="compact">Compact</option><option value="normal">Normal</option><option value="large">Large</option></select></label><label>Dock position<select class="field" data-dock><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></label><label>Animations<select class="field" data-motion><option value="on">On</option><option value="off">Reduced</option></select></label><label class="idk-settings-check"><input type="checkbox" data-contrast> High contrast</label><label class="idk-settings-check"><input type="checkbox" data-reduced> Reduce motion and larger text controls</label></div><div class="idk-settings-actions"><button class="btn" data-save>Apply desktop settings</button><button class="btn tab" data-workspace>Restore workspace</button><button class="btn tab" data-reset>Forget saved workspace</button></div><p class="idk-settings-note" data-status>Accessibility preferences stay on this device unless account sync is enabled.</p>');
    root.querySelector('[data-size]').value = read('iconSize', 'normal'); root.querySelector('[data-dock]').value = read('dockPosition', 'bottom'); root.querySelector('[data-motion]').value = read('motion', 'on'); const accessibility = { highContrast: false, reduceMotion: false, largeText: false, ...read('idkAccessibility', {}) }; root.querySelector('[data-contrast]').checked = accessibility.highContrast; root.querySelector('[data-reduced]').checked = accessibility.reduceMotion || accessibility.largeText;
    root.querySelector('[data-save]').onclick = () => { const motion = root.querySelector('[data-motion]').value, state = { ...accessibility, highContrast: root.querySelector('[data-contrast]').checked, reduceMotion: root.querySelector('[data-reduced]').checked, largeText: root.querySelector('[data-reduced]').checked }; write('iconSize', root.querySelector('[data-size]').value); write('dockPosition', root.querySelector('[data-dock]').value); write('motion', motion); write('idkAccessibility', state); applySavedAppearance(); document.body.classList.toggle('idk-high-contrast', state.highContrast); document.body.classList.toggle('idk-reduce-motion', state.reduceMotion); document.body.classList.toggle('idk-large-text', state.largeText); root.querySelector('[data-status]').textContent = 'Desktop settings applied.'; notify('Settings', 'Desktop settings updated.', 'success'); };
    root.querySelector('[data-workspace]').onclick = async () => { const count = await window.OS?.restoreWorkspace?.() || 0; root.querySelector('[data-status]').textContent = count ? `${count} saved window${count === 1 ? '' : 's'} restored.` : 'No saved workspace was found.'; };
    root.querySelector('[data-reset]').onclick = () => { window.OS?.clearWorkspace?.(); root.querySelector('[data-status]').textContent = 'Saved workspace forgotten.'; };
    return root;
  }

  function notificationsPane() {
    const root = panel('Notifications', 'Control interruptions and clear the notification center.', '<label class="idk-settings-check"><input type="checkbox" data-dnd> Do Not Disturb</label><p class="idk-settings-note">Do Not Disturb is local to this device. Important system errors can still be recorded for Reliability.</p><div class="idk-settings-actions"><button class="btn" data-save>Save notification settings</button><button class="btn tab" data-clear>Clear notification center</button></div><p class="idk-settings-note" data-status></p>');
    const state = { dnd: false, ...read('idkDesktopSuiteState', {}) }; root.querySelector('[data-dnd]').checked = state.dnd;
    root.querySelector('[data-save]').onclick = () => { write('idkDesktopSuiteState', { ...state, dnd: root.querySelector('[data-dnd]').checked }); root.querySelector('[data-status]').textContent = 'Notification settings saved.'; notify('Settings', 'Notification settings updated.', 'success'); };
    root.querySelector('[data-clear]').onclick = () => { localStorage.removeItem('idkNotifications'); window.dispatchEvent(new CustomEvent('idk-notifications-cleared')); root.querySelector('[data-status]').textContent = 'Notification center cleared.'; };
    return root;
  }

  function accountPane(open) {
    const user = accountUser(), root = panel('Account & Sync', user ? `Signed in as ${user.username}. Your IDK data can follow you across devices.` : 'Use an IDK account to sync desktop state, Files, apps, and profiles.', '<div class="idk-settings-account" data-account></div><div class="idk-settings-actions" data-actions></div><p class="idk-settings-note" data-status></p>');
    const body = root.querySelector('[data-account]'), actions = root.querySelector('[data-actions]'), status = root.querySelector('[data-status]');
    body.innerHTML = user ? `<strong>${esc(user.username)}</strong><span>Account sync is available. Use Device Handoff to add another browser without entering your password.</span>` : '<strong>Guest mode</strong><span>Local data is available, but it will not be restored on another device until you sign in.</span>';
    if (user) { actions.append(button('Sync now', async () => { status.textContent = 'Syncing...'; status.textContent = await window.IDKAccount?.sync?.() ? 'Sync complete.' : 'Sync did not complete.'; }, 'btn'), button('Open Accounts & Devices', () => window.IDKAccountsDevices?.open?.(), 'btn tab'), button('Open Device Handoff', () => open('handoff'), 'btn tab')); }
    else actions.append(button('Sign in or create account', () => { localStorage.removeItem('idkGuestSession'); location.reload(); }, 'btn'), button('Use a handoff code', () => open('handoff'), 'btn tab'));
    actions.append(button('Open Security & Privacy', () => window.IDKPlatformPolish?.openSecurityCenter?.(), 'btn tab'));
    return root;
  }

  function storagePane() {
    const root = panel('Storage & Recovery', 'See local storage usage and protect the current device.', '<div class="idk-settings-cards" data-summary><div class="idk-settings-card"><strong>Checking...</strong><span>Local storage</span><small>Browser estimate</small></div></div><div class="idk-settings-actions" data-actions></div><p class="idk-settings-note" data-status>Backups never include account passwords or session cookies.</p>');
    const summary = root.querySelector('[data-summary]'), status = root.querySelector('[data-status]');
    Promise.resolve(window.IDKPerfectOS?.storageInfo?.()).then(info => { if (!info) return; const used = info.usage ? `${(info.usage / 1048576).toFixed(1)} MB` : 'Unknown'; const quota = info.quota ? `${(info.quota / 1048576).toFixed(0)} MB available` : 'Quota unavailable'; summary.innerHTML = `<div class="idk-settings-card"><strong>${used}</strong><span>Used locally</span><small>${quota}</small></div>`; }).catch(() => {});
    root.querySelector('[data-actions]').append(button('Encrypted backup', () => window.IDKPerfectOS?.exportBackup?.(), 'btn'), button('Open Recovery Center', () => window.IDKPlatformPolish?.openRecoveryCenter?.(), 'btn tab'), button('Open System Health', () => window.IDKPerfectOS?.openHealth?.(), 'btn tab'), button('Clear crash log', () => { localStorage.removeItem('idkCrashLog'); status.textContent = 'Reliability log cleared.'; }, 'btn tab'));
    return root;
  }

  function privacyPane() {
    const root = panel('Privacy & Safety', 'Review the protections around this browser-based desktop.', '<div class="idk-settings-list"><article><strong>Same-origin account session</strong><small>Passwords are sent only to the IDK account service and sessions use secure HTTP-only cookies.</small></article><article><strong>Local diagnostics</strong><small>Client errors stay in this browser unless you explicitly export diagnostics.</small></article><article><strong>Browser permissions</strong><small>Camera, microphone, USB, Bluetooth, and notifications remain opt-in browser permissions.</small></article></div><div class="idk-settings-actions"><button class="btn" data-permissions>App Permissions</button><button class="btn tab" data-security>Security Center</button><button class="btn tab" data-recovery>Recovery Center</button></div>');
    root.querySelector('[data-permissions]').onclick = () => window.OS?.open?.('permissions'); root.querySelector('[data-security]').onclick = () => window.IDKPlatformPolish?.openSecurityCenter?.(); root.querySelector('[data-recovery]').onclick = () => window.IDKPlatformPolish?.openRecoveryCenter?.(); return root;
  }

  async function claimCode(code, status) {
    const clean = String(code || '').trim(); if (clean.length < 8) { if (status) status.textContent = 'Enter the handoff code from your other device.'; return false; }
    if (status) status.textContent = 'Claiming code...';
    try { const response = await fetch('/api/account/handoff/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ code: clean }) }); const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || 'That code could not be claimed.'); if (status) status.textContent = `Connected as ${result.user?.username || 'your account'}. Reloading...`; history.replaceState({}, '', location.pathname); setTimeout(() => location.reload(), 250); return true; } catch (error) { if (status) status.textContent = error.message; return false; }
  }

  function handoffPane() {
    const root = panel('Device Handoff', 'Add this browser to your IDK account with a short-lived, one-time code.', '<div class="idk-settings-handoff"><section><h3>Send from this device</h3><p>Generate a code, then enter it on the new device. It expires after 10 minutes and works once.</p><button class="btn" data-create>Generate handoff code</button><div class="idk-handoff-code" data-code hidden><code data-value></code><button class="btn tab" data-copy>Copy code</button><input class="field" data-link readonly><button class="btn tab" data-copy-link>Copy device link</button></div></section><section><h3>Receive on this device</h3><p>Enter a code created by a signed-in device. This browser will receive the account session and synced data.</p><form data-claim><input class="field" name="code" autocomplete="one-time-code" placeholder="12-character handoff code" required><button class="btn" type="submit">Claim code</button></form></section></div><div class="idk-settings-section"><h3>Connected account devices</h3><div class="idk-settings-list" data-devices><small>Loading...</small></div></div><p class="idk-settings-note" data-status></p>');
    const codeBox = root.querySelector('[data-code]'), value = root.querySelector('[data-value]'), link = root.querySelector('[data-link]'), status = root.querySelector('[data-status]');
    root.querySelector('[data-create]').onclick = async () => { if (!accountUser()) { status.textContent = 'Sign in on this device before creating a code.'; return; } status.textContent = 'Creating code...'; try { const response = await fetch('/api/account/handoff/create', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: '{}' }); const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || 'Could not create a code.'); value.textContent = result.code; link.value = `${location.origin}${location.pathname}?handoff=${encodeURIComponent(result.code)}`; codeBox.hidden = false; status.textContent = `Code expires at ${new Date(result.expiresAt).toLocaleTimeString()}.`; } catch (error) { status.textContent = error.message; } };
    root.querySelector('[data-copy]').onclick = async () => { await navigator.clipboard?.writeText(value.textContent); status.textContent = 'Handoff code copied.'; };
    root.querySelector('[data-copy-link]').onclick = async () => { await navigator.clipboard?.writeText(link.value); status.textContent = 'Device link copied.'; };
    root.querySelector('[data-claim]').onsubmit = event => { event.preventDefault(); claimCode(new FormData(event.currentTarget).get('code'), status); };
    const loadDevices = async () => { const list = root.querySelector('[data-devices]'); try { const result = await fetch('/api/account/devices', { credentials: 'same-origin' }).then(response => response.json()); if (!result.ok) throw new Error(result.error || 'Sign in to view devices.'); list.replaceChildren(...(result.devices || []).map(device => { const item = document.createElement('article'); item.innerHTML = `<div><strong>${esc(device.label || 'IDK browser')}${device.id === result.currentDeviceId ? ' - Current' : ''}</strong><small>${esc(device.userAgent || 'Browser')} - Last seen ${esc(new Date(device.lastSeen).toLocaleString())}</small></div>`; if (device.id !== result.currentDeviceId && !device.revokedAt) item.append(button('Revoke', async () => { await fetch(`/api/account/devices/${encodeURIComponent(device.id)}`, { method: 'DELETE', credentials: 'same-origin' }); loadDevices(); }, 'btn tab')); return item; })); if (!result.devices?.length) list.innerHTML = '<small>No account devices found.</small>'; } catch (error) { list.innerHTML = `<small>${esc(error.message)}</small>`; } };
    loadDevices(); return root;
  }

  function settingsApp(opts = {}) {
    const root = document.createElement('div'); root.className = 'app idk-settings-hub'; root.innerHTML = '<aside class="idk-settings-nav"><div class="idk-settings-brand"><strong>Settings</strong><small>IDK control center</small></div><nav data-nav></nav></aside><main class="idk-settings-main" data-pane></main>';
    const nav = root.querySelector('[data-nav]'), pane = root.querySelector('[data-pane]'), tabs = [['overview', 'Overview'], ['appearance', 'Appearance'], ['desktop', 'Desktop'], ['notifications', 'Notifications'], ['account', 'Account & Sync'], ['handoff', 'Device Handoff'], ['storage', 'Storage & Recovery'], ['privacy', 'Privacy & Safety']];
    const render = tab => { nav.querySelectorAll('button').forEach(item => item.classList.toggle('active', item.dataset.tab === tab)); const panes = { overview: () => overviewPane(render), appearance: appearancePane, desktop: desktopPane, notifications: notificationsPane, account: () => accountPane(render), handoff: handoffPane, storage: storagePane, privacy: privacyPane }; pane.replaceChildren(panes[tab]?.() || panes.overview()); };
    tabs.forEach(([id, label]) => { const item = button(label, () => render(id), 'idk-settings-nav-item'); item.dataset.tab = id; nav.append(item); }); render(opts.tab || 'overview'); return root;
  }

  function installHandoffEntry() {
    const code = new URL(location.href).searchParams.get('handoff'); if (code) setTimeout(() => claimCode(code), 160);
    const enhance = () => { const row = document.querySelector('#idk-account-overlay .idk-account-row'); if (!row || row.querySelector('[data-handoff-entry]')) return; const item = document.createElement('button'); item.type = 'button'; item.className = 'idk-account-secondary'; item.dataset.handoffEntry = 'true'; item.textContent = 'Use handoff code'; item.onclick = async () => { const value = prompt('Enter the handoff code from your other device.'); await claimCode(value, document.querySelector('#idk-account-error')); }; row.append(item); };
    enhance(); new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
  }

  function install() { installStyle(); if (typeof APPS !== 'undefined' && APPS.settings) { APPS.settings = { ...APPS.settings, width: 900, height: 650, render: settingsApp }; } applySavedAppearance(); installHandoffEntry(); }
  window.IDKBatchNine = { settings: settingsApp, claimHandoff: claimCode };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

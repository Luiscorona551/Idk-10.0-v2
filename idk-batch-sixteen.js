(() => {
  'use strict';
  if (window.IDKBatchSixteen) return;

  const DIAGNOSTICS_KEY = 'idkCallDiagnostics';
  const PERMISSION_KEY = 'idkNotificationPermission';
  const fallbackIceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const runtime = window.IDKCallRuntime ||= { iceServers: fallbackIceServers };

  function record(type, detail = {}) {
    const safe = Object.fromEntries(Object.entries(detail || {}).slice(0, 8).map(([key, value]) => [key, typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : String(value ?? '')]));
    const item = { type: String(type).slice(0, 48), at: Date.now(), ...safe };
    write(DIAGNOSTICS_KEY, [item, ...read(DIAGNOSTICS_KEY, [])].slice(0, 60));
    window.dispatchEvent(new CustomEvent('idk-call-diagnostic', { detail: item }));
    if (/^(call-end|call-expired|call-start-failed)$/.test(item.type)) window.IDKAccount?.sync?.();
    return item;
  }

  runtime.record ||= record;
  runtime.configState ||= 'loading';
  runtime.loadCallConfig ||= async () => {
    try {
      const response = await fetch('/api/call/config', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.iceServers) || !data.iceServers.length) throw new Error(data.error || 'Call configuration unavailable.');
      runtime.iceServers = data.iceServers;
      runtime.configState = 'ready';
      runtime.configSource = data.activeTransport || 'peer-to-peer';
      record('config-ready', { iceServers: data.iceServers.length, transport: runtime.configSource });
    } catch (error) {
      runtime.iceServers = fallbackIceServers;
      runtime.configState = 'fallback';
      runtime.configError = error?.message || 'Call configuration unavailable.';
      record('config-fallback', { message: runtime.configError });
    }
    return runtime.iceServers;
  };

  const prefs = () => ({ dnd: false, quietStart: '22:00', quietEnd: '08:00', calls: true, messages: true, friends: true, system: true, ...read('idkNotificationPrefs', {}) });
  const quiet = state => { if (!state.dnd || !state.quietStart || !state.quietEnd) return false; const now = new Date().toTimeString().slice(0, 5); return state.quietStart <= state.quietEnd ? now >= state.quietStart && now < state.quietEnd : now >= state.quietStart || now < state.quietEnd; };
  const notificationCategory = title => /call/i.test(title) ? 'calls' : /message|mention|chat/i.test(title) ? 'messages' : /friend|request/i.test(title) ? 'friends' : 'system';

  function browserNotify(title, message, kind = 'info', force = false) {
    if (!force && (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted')) return;
    const state = prefs();
    if (!force && (kind !== 'danger' && (state[notificationCategory(title)] === false || quiet(state)))) return;
    try { const item = new Notification(String(title), { body: String(message), tag: `idk-${notificationCategory(title)}`, icon: '/ugs-icon.jpeg' }); item.onclick = () => { window.focus(); item.close(); }; } catch {}
  }

  function installBrowserNotifications() {
    const original = window.OS?.notify;
    if (!original || original.__idkBatchSixteen) return;
    const wrapped = (title, message, kind = 'info') => { const result = original.call(window.OS, title, message, kind); browserNotify(title, message, kind); return result; };
    wrapped.__idkBatchSixteen = true;
    window.OS.notify = wrapped;
  }

  function augmentNotificationSettings(root) {
    if (!root || root.querySelector('[data-browser-notifications]')) return;
    const card = document.createElement('section');
    card.className = 'idk-browser-notification-card';
    card.dataset.browserNotifications = 'true';
    card.innerHTML = '<div><strong>Browser notifications</strong><small data-browser-status>Checking permission…</small></div><div class="idk-flow-actions"><button class="btn" data-browser-enable>Enable</button><button class="btn tab" data-browser-test>Send test</button></div>';
    const status = card.querySelector('[data-browser-status]'), enable = card.querySelector('[data-browser-enable]'), test = card.querySelector('[data-browser-test]');
    const update = () => { const permission = 'Notification' in window ? Notification.permission : 'unsupported'; write(PERMISSION_KEY, permission); status.textContent = permission === 'granted' ? 'Enabled when IDK is in the background.' : permission === 'denied' ? 'Blocked by this browser. Change site permissions to re-enable.' : permission === 'unsupported' ? 'This browser does not support notifications.' : 'Permission has not been requested.'; enable.disabled = permission === 'granted' || permission === 'unsupported'; enable.textContent = permission === 'granted' ? 'Enabled' : 'Enable'; test.disabled = permission !== 'granted'; };
    enable.onclick = async () => { if (!('Notification' in window)) return update(); const permission = await Notification.requestPermission(); write(PERMISSION_KEY, permission); update(); if (permission === 'granted') browserNotify('IDK notifications', 'Browser notifications are enabled.', 'success', true); };
    test.onclick = () => browserNotify('IDK test notification', 'Your IDK browser notification is working.', 'success', true);
    root.querySelector('[data-status]')?.before(card); update();
  }

  function callDiagnosticsApp() {
    const root = document.createElement('div'); root.className = 'app idk-call-diagnostics';
    root.innerHTML = '<header class="idk-control-head"><div><span class="idk-flow-kicker">IDK RELIABILITY</span><h2>Call Diagnostics</h2><p>Check the signaling service, peer connection support, notification permission, and offline shell without requesting microphone or camera access.</p></div><span class="idk-control-badge">NO MEDIA ACCESS</span></header><div class="idk-diagnostic-grid" data-checks></div><p class="idk-control-status" data-status>Ready to run checks.</p><div class="idk-flow-actions"><button class="btn" data-run>Run diagnostics</button><button class="btn tab" data-copy>Copy report</button><button class="btn tab" data-clear>Clear local call log</button></div><details class="idk-diagnostic-details"><summary>Recent call events</summary><pre data-events>No events recorded.</pre></details>';
    const checks = root.querySelector('[data-checks]'), status = root.querySelector('[data-status]'), events = root.querySelector('[data-events]');
    let report = {};
    const renderEvents = () => { const items = read(DIAGNOSTICS_KEY, []); events.textContent = items.length ? items.slice(0, 12).map(item => `${new Date(item.at).toLocaleTimeString()}  ${item.type}${item.state ? ` · ${item.state}` : ''}${item.message ? ` · ${item.message}` : ''}`).join('\n') : 'No events recorded.'; };
    const renderChecks = values => { checks.replaceChildren(...Object.entries(values).map(([label, value]) => { const card = document.createElement('article'); card.className = `idk-diagnostic-card ${value.ok ? 'is-ok' : 'is-warning'}`; card.innerHTML = `<strong>${value.ok ? 'OK' : 'CHECK'} · ${esc(label)}</strong><small>${esc(value.detail)}</small>`; return card; })); };
    const run = async () => { status.textContent = 'Running checks…'; const values = {}; values['Network'] = { ok: navigator.onLine, detail: navigator.onLine ? 'Browser reports an online connection.' : 'Browser is offline.' }; values['WebRTC'] = { ok: 'RTCPeerConnection' in window, detail: 'RTCPeerConnection is available.' }; values['Media devices'] = { ok: Boolean(navigator.mediaDevices?.getUserMedia), detail: navigator.mediaDevices?.getUserMedia ? 'Microphone and camera can be requested from Calls.' : 'Media access is unavailable.' }; values['Notifications'] = { ok: !('Notification' in window) || Notification.permission !== 'denied', detail: 'Notification' in window ? `Permission: ${Notification.permission}.` : 'Browser notifications are unsupported.' }; values['Offline shell'] = { ok: Boolean(navigator.serviceWorker), detail: navigator.serviceWorker ? 'Service worker support is available.' : 'Service workers are unavailable.' }; try { const response = await fetch('/api/health', { cache: 'no-store' }); const data = await response.json(); values['IDK health API'] = { ok: response.ok && data.ok, detail: response.ok ? `Database ${data.database?.connected ? 'connected' : 'unavailable'}; chat ${data.chat ? 'ready' : 'unavailable'}.` : `HTTP ${response.status}.` }; } catch (error) { values['IDK health API'] = { ok: false, detail: error?.message || 'Health request failed.' }; } try { const response = await fetch('/api/call/config', { cache: 'no-store' }); const data = await response.json(); values['Call configuration'] = { ok: response.ok && data.ok && data.iceServers?.length > 0, detail: response.ok ? `${data.iceServers?.length || 0} ICE server configuration(s); ${data.activeTransport || 'peer-to-peer'}.` : `HTTP ${response.status}.` }; } catch (error) { values['Call configuration'] = { ok: false, detail: error?.message || 'Call configuration failed.' }; } report = { checkedAt: new Date().toISOString(), online: navigator.onLine, connection: navigator.connection?.effectiveType || 'unknown', userAgent: navigator.userAgent, checks: values, callConfig: { state: runtime.configState, servers: runtime.iceServers?.length || 0 } }; renderChecks(values); renderEvents(); status.textContent = Object.values(values).every(value => value.ok) ? 'All available checks passed.' : 'Some checks need attention. Calls still require two signed-in friends to test end to end.'; record('diagnostics-run', { checks: Object.values(values).filter(value => value.ok).length, total: Object.keys(values).length }); };
    root.querySelector('[data-run]').onclick = run;
    root.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(report, null, 2)); status.textContent = 'Diagnostic report copied.'; } catch { status.textContent = 'Clipboard access was unavailable.'; } };
    root.querySelector('[data-clear]').onclick = () => { write(DIAGNOSTICS_KEY, []); renderEvents(); status.textContent = 'Local call diagnostics cleared.'; };
    renderEvents(); setTimeout(run, 80); return root;
  }

  function install() {
    installBrowserNotifications();
    runtime.loadCallConfig();
    if (typeof APPS !== 'undefined') APPS.callDiagnostics ||= { title: 'Call Diagnostics', glyph: '◌', desktop: false, dock: false, width: 700, height: 610, render: callDiagnosticsApp };
    const observer = new MutationObserver(() => document.querySelectorAll('.idk-notification-settings').forEach(augmentNotificationSettings));
    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('.idk-notification-settings').forEach(augmentNotificationSettings);
  }

  window.IDKBatchSixteen = { callDiagnosticsApp, browserNotify, record };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

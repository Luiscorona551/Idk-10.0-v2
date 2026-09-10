(() => {
  'use strict';
  if (window.IDKAllSix) return;

  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const queued = () => read('idkOfflineQueue', []).length + read('idkCloudSyncQueue', []).length;
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const open = id => window.OS?.open?.(id);
  let installPrompt = null;
  let panel = null;

  const button = (label, action, className = 'btn tab') => {
    const node = document.createElement('button');
    node.type = 'button'; node.className = className; node.textContent = label; node.onclick = action;
    return node;
  };

  function desktopHealth() {
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
    return overflow ? 'Layout needs attention' : 'Fits this screen';
  }

  function installCallQuality() {
    const Native = window.RTCPeerConnection;
    if (!Native || Native.__idkQualityWrapped) return;
    const attach = pc => {
      let timer = 0;
      const sample = async () => {
        if (pc.connectionState === 'closed') return;
        try {
          const stats = await pc.getStats();
          let lost = 0, received = 0, rtt = 0, jitter = 0;
          stats.forEach(report => {
            if (report.type === 'inbound-rtp' && (report.kind === 'audio' || report.kind === 'video')) {
              lost += Number(report.packetsLost || 0); received += Number(report.packetsReceived || 0); jitter = Math.max(jitter, Number(report.jitter || 0));
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') rtt = Math.max(rtt, Number(report.currentRoundTripTime || 0));
          });
          const loss = lost + received ? Number((lost / (lost + received) * 100).toFixed(1)) : 0;
          window.IDKCallRuntime?.record?.('quality-sample', { loss, rtt: Math.round(rtt * 1000), jitter: Math.round(jitter * 1000), quality: loss > 5 || rtt > .35 ? 'poor' : loss > 2 || rtt > .18 ? 'fair' : 'good' });
        } catch {}
      };
      const start = () => { if (!timer) { sample(); timer = setInterval(sample, 5000); } };
      const stop = () => { clearInterval(timer); timer = 0; };
      pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'connected') start(); if (pc.connectionState === 'closed' || pc.connectionState === 'failed') stop(); });
      pc.addEventListener('iceconnectionstatechange', () => { if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') start(); if (pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'failed') stop(); });
    };
    const Wrapped = new Proxy(Native, { construct(target, args, newTarget) { const pc = Reflect.construct(target, args, newTarget); attach(pc); return pc; } });
    Wrapped.__idkQualityWrapped = true;
    window.RTCPeerConnection = Wrapped;
  }

  function enhanceAccount() {
    const form = document.querySelector('#idk-account-form');
    if (!form || form.querySelector('[data-show-password]')) return;
    const password = form.querySelector('#idk-account-pass');
    if (!password) return;
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'idk-account-password-toggle'; toggle.dataset.showPassword = 'true'; toggle.textContent = 'Show password';
    toggle.onclick = () => { const visible = password.type === 'text'; password.type = visible ? 'password' : 'text'; toggle.textContent = visible ? 'Show password' : 'Hide password'; };
    password.closest('label')?.append(toggle);
  }

  function renderPanel() {
    if (!panel) return;
    const status = panel.querySelector('[data-six-status]');
    const account = window.IDKAccount?.user;
    const syncState = window.IDKAccount?.getSyncStatus?.() || read('idkSyncStatus', {});
    panel.querySelector('[data-six-account]').textContent = account ? `Signed in as ${account.username}` : 'Guest mode; local data stays here';
    panel.querySelector('[data-six-sync]').textContent = navigator.onLine ? (queued() ? `${queued()} changes queued` : (syncState.state === 'syncing' ? 'Syncing now' : 'Online and ready')) : `${queued() || 0} changes waiting offline`;
    panel.querySelector('[data-six-calls]').textContent = window.RTCPeerConnection ? (window.IDKCallRuntime?.configSource || 'WebRTC ready') : 'WebRTC unavailable';
    panel.querySelector('[data-six-desktop]').textContent = desktopHealth();
    panel.querySelector('[data-six-command]').textContent = 'Ctrl/Cmd + Shift + P';
    panel.querySelector('[data-six-install]').textContent = window.matchMedia('(display-mode: standalone)').matches ? 'Installed as an app' : installPrompt ? 'Ready to install' : 'Use the browser install menu';
    if (status) status.textContent = navigator.onLine ? 'All local services are available.' : 'Offline mode is active. Local changes remain available.';
  }

  function openPanel() {
    panel?.remove();
    panel = document.createElement('section');
    panel.id = 'idk-six-panel'; panel.className = 'idk-six-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.innerHTML = '<div class="idk-six-card"><header><div><span class="idk-redesign-kicker">IDK 10.0 / CONTROL</span><h2>Everything important, one place.</h2></div><button type="button" data-six-close aria-label="Close status panel">x</button></header><p class="idk-six-intro" data-six-status></p><div class="idk-six-grid"><article><strong>Account</strong><span data-six-account></span><div data-six-actions="account"></div></article><article><strong>Sync</strong><span data-six-sync></span><div data-six-actions="sync"></div></article><article><strong>Calls</strong><span data-six-calls></span><div data-six-actions="calls"></div></article><article><strong>Desktop</strong><span data-six-desktop></span><div data-six-actions="desktop"></div></article><article><strong>Commands</strong><span data-six-command></span><div data-six-actions="command"></div></article><article><strong>Install and offline</strong><span data-six-install></span><div data-six-actions="install"></div></article></div></div>';
    document.body.append(panel);
    panel.querySelector('[data-six-close]').onclick = () => panel.remove();
    panel.onclick = event => { if (event.target === panel) panel.remove(); };
    panel.querySelector('[data-six-actions="account"]').append(button('Manage account', () => open('settings')), button('Security center', () => window.IDKBatchNineteen?.open?.() || open('recoveryCenter')));
    panel.querySelector('[data-six-actions="sync"]').append(button('Sync now', async () => { await window.IDKOffline?.flush?.(); await window.IDKAccount?.sync?.(); renderPanel(); notify('Sync', 'Queued changes were retried.', 'success'); }), button('Backup', () => window.IDKBackup?.open?.() || open('recoveryCenter')));
    panel.querySelector('[data-six-actions="calls"]').append(button('Open Calls', () => open('calls')), button('Diagnostics', () => open('callDiagnostics')));
    panel.querySelector('[data-six-actions="desktop"]').append(button('Desktop center', () => open('desktopCenter')), button('Accessibility', () => window.IDKPlatformPolish?.openPreferences?.() || open('settings')));
    panel.querySelector('[data-six-actions="command"]').append(button('Open palette', () => window.IDKCommandPalette?.open?.() || window.IDKUnifiedSearch?.open?.(), 'btn'));
    panel.querySelector('[data-six-actions="install"]').append(button('Install IDK', async event => { if (!installPrompt) return notify('Install IDK', 'Use your browser menu to install IDK as an app.'); installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; renderPanel(); }, 'btn'), button('Offline health', () => open('health')));
    renderPanel();
  }

  function installPanelTrigger() {
    const nav = document.querySelector('#idk-redesign-nav');
    if (!nav || nav.querySelector('[data-six-trigger]')) return;
    const trigger = button('Status', openPanel, 'idk-six-trigger'); trigger.dataset.sixTrigger = 'true'; trigger.setAttribute('aria-label', 'Open IDK control status');
    nav.querySelector('.idk-redesign-nav-status')?.before(trigger);
  }

  function install() {
    installCallQuality();
    enhanceAccount();
    installPanelTrigger();
    new MutationObserver(() => { enhanceAccount(); installPanelTrigger(); }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') panel?.remove(); }, true);
    window.addEventListener('online', renderPanel); window.addEventListener('offline', renderPanel); window.addEventListener('idk-sync-status', renderPanel); window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; renderPanel(); }); window.addEventListener('appinstalled', () => { installPrompt = null; notify('IDK', 'IDK is installed as an app.', 'success'); renderPanel(); });
    window.IDKAllSix = { openPanel, refresh: renderPanel };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

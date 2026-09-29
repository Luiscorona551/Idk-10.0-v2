(() => {
  'use strict';
  if (window.IDKReleaseBatch) return;

  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);

  function addCallHealth(root) {
    if (!root || root.dataset.idkCallHealth) return;
    root.dataset.idkCallHealth = 'true';
    const card = document.createElement('section');
    card.className = 'idk-call-health';
    card.innerHTML = '<div><strong>Connection health</strong><small data-transport>Checking call transport…</small></div><span data-state>Ready</span><div class="idk-call-actions"><button class="btn tab" data-mic>Test microphone</button><button class="btn tab" data-diagnostics>Open diagnostics</button></div>';
    root.querySelector('.idk-call-intro')?.after(card);
    const transport = card.querySelector('[data-transport]');
    const state = card.querySelector('[data-state]');
    fetch('/api/call/config', { cache: 'no-store' }).then(response => response.json()).then(data => { transport.textContent = data.hasTurn ? 'TURN relay available for difficult networks.' : 'STUN only. Add IDK_ICE_SERVERS for TURN relay support.'; }).catch(() => { transport.textContent = 'Call transport status unavailable.'; });
    const update = event => { const detail = event.detail || {}; if (/connection-state|ice-state/.test(detail.type || '')) state.textContent = detail.state ? `Network: ${detail.state}` : detail.type; if (detail.type === 'quality-sample') state.textContent = `Quality: ${detail.loss || 0}% packet loss`; if (detail.type === 'call-end') state.textContent = 'Ready for another call'; };
    window.addEventListener('idk-call-diagnostic', update);
    card.querySelector('[data-mic]').onclick = async () => { try { if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable in this browser.'); const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); const label = media.getAudioTracks()[0]?.label || 'Microphone'; media.getTracks().forEach(track => track.stop()); state.textContent = `Microphone ready: ${label}`; notify('IDK Calls', 'Microphone test passed.', 'success'); } catch (error) { state.textContent = error?.message || 'Microphone test failed.'; notify('IDK Calls', state.textContent, 'warning'); } };
    card.querySelector('[data-diagnostics]').onclick = () => window.OS?.open?.('callDiagnostics');
    root.cleanup = ((cleanup = root.cleanup) => () => { window.removeEventListener('idk-call-diagnostic', update); cleanup?.(); })();
  }

  function addDeviceSessionControls(root) {
    if (!root || root.dataset.idkDeviceSessions || !root.querySelector('[data-list]')) return;
    root.dataset.idkDeviceSessions = 'true';
    const actions = document.createElement('div');
    actions.className = 'idk-security-actions idk-release-device-actions';
    const revoke = document.createElement('button');
    revoke.type = 'button'; revoke.className = 'btn tab'; revoke.textContent = 'Sign out other devices';
    const status = root.querySelector('[data-status]');
    revoke.onclick = async () => { if (!confirm('Sign out all other IDK browser sessions?')) return; revoke.disabled = true; try { const response = await fetch('/api/account/devices/revoke-others', { method: 'POST', credentials: 'same-origin' }); const data = await response.json(); if (!response.ok || data.ok === false) throw new Error(data.error || 'Could not revoke other devices.'); if (status) status.textContent = `${data.revokedDevices || 0} other device session(s) signed out.`; notify('Account', 'Other device sessions were revoked.', 'success'); } catch (error) { if (status) status.textContent = error.message; } finally { revoke.disabled = false; } };
    actions.append(revoke);
    root.querySelector('[data-list]')?.before(actions);
  }

  function scan() {
    document.querySelectorAll('.idk-calls-app').forEach(addCallHealth);
    document.querySelectorAll('.idk-security-batch19').forEach(addDeviceSessionControls);
  }


  const GREEN_WALLPAPER = 'https://cdn.phototourl.com/member/2026-09-25-b9324e05-93bd-445b-b799-c75b6ff7b455.jpg';
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

  function enhanceBrowser(root) {
    if (!root || root.dataset.idkReleaseBrowser) return;
    const bar = root.querySelector('.toolbar');
    if (!bar) return;
    root.dataset.idkReleaseBrowser = '1';
    const frame = root.querySelector('iframe');
    const url = root.querySelector('input[type="text"],input[type="url"],input[type="search"]');
    const button = (label, title, action) => { const el = document.createElement('button'); el.className = 'btn tab idk-release-browser-button'; el.type = 'button'; el.textContent = label; el.title = title; el.onclick = action; return el; };
    const current = () => String(url?.value || frame?.src || '').trim();
    bar.append(
      button('Home', 'Open browser home', () => { if (url) { url.value = 'https://www.google.com/'; url.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); } }),
      button('Copy URL', 'Copy current URL', async () => { const value = current(); if (!/^https?:/i.test(value)) return notify('Browser', 'No web URL to copy.', 'warning'); try { await navigator.clipboard.writeText(value); notify('Browser', 'URL copied.', 'success'); } catch { notify('Browser', 'Clipboard unavailable.', 'warning'); } }),
      button('New tab', 'Open another IDK browser window', () => window.OS?.open?.('proxy'))
    );
    const remember = () => { const value = current(); if (/^https?:/i.test(value)) save('idkBrowserLastURL', value); };
    frame?.addEventListener('load', remember);
    url?.addEventListener('change', remember);
  }

  function openEchoPanel() {
    document.getElementById('idk-echo-action-center')?.remove();
    const root = document.createElement('section');
    root.id = 'idk-echo-action-center';
    root.innerHTML = '<div class="idk-echo-center-card"><button class="idk-echo-center-close" type="button" aria-label="Close Echo">×</button><div class="idk-echo-center-flag"><img src="official-flag.jpg" alt="IDK Echo"></div><span class="idk-echo-kicker">IDK ECHO</span><h2>What can I help you with?</h2><p>Choose an action and Echo will handle it on your IDK desktop.</p><div class="idk-echo-action-grid"><button data-echo-action="settings">⚙ Open Settings</button><button data-echo-action="green">🌿 Change wallpaper to Green</button><button data-echo-action="files">📁 Open Files</button><button data-echo-action="browser">🌐 Open Browser</button><button data-echo-action="agent">🤖 Open Web Agent</button></div><div class="idk-echo-center-status">Ready.</div></div>';
    document.body.append(root);
    const status = root.querySelector('.idk-echo-center-status');
    const close = () => root.remove();
    root.querySelector('.idk-echo-center-close').onclick = close;
    root.onclick = event => { if (event.target === root) close(); };
    root.querySelectorAll('[data-echo-action]').forEach(action => action.onclick = () => {
      const kind = action.dataset.echoAction;
      if (kind === 'settings') window.OS?.open?.('settings');
      if (kind === 'files') window.OS?.open?.('files');
      if (kind === 'browser') window.OS?.open?.('proxy');
      if (kind === 'agent') window.OS?.open?.('agent');
      if (kind === 'green') { if (typeof window.applyWallpaper === 'function') window.applyWallpaper(GREEN_WALLPAPER); else document.documentElement.style.setProperty('--wallpaper', `url("${GREEN_WALLPAPER}")`); save('idkWallpaper', GREEN_WALLPAPER); }
      const message = { settings: 'Settings opened.', green: 'Green wallpaper applied.', files: 'Files opened.', browser: 'Browser opened.', agent: 'Web Agent opened.' }[kind] || 'Done.';
      status.textContent = message;
      notify('IDK Echo', message, 'success');
      setTimeout(close, 500);
    });
  }

  function setupEcho() {
    const echo = document.getElementById('echo-companion');
    if (!echo || echo.dataset.idkReleaseEcho) return;
    echo.dataset.idkReleaseEcho = '1';
    echo.onclick = event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const flag = document.createElement('img');
      flag.className = 'idk-echo-flight';
      flag.src = 'official-flag.jpg';
      flag.alt = '';
      document.body.append(flag);
      requestAnimationFrame(() => flag.classList.add('fly'));
      setTimeout(() => { flag.remove(); openEchoPanel(); }, 620);
    };
  }

  function improveStates() {
    document.querySelectorAll('.loading-state,.empty-state').forEach(node => node.classList.add('idk-release-state'));
    document.querySelectorAll('.site-frame').forEach(root => {
      const frame = root.querySelector('iframe');
      if (!frame || frame.dataset.idkReleaseFrame) return;
      frame.dataset.idkReleaseFrame = '1';
      frame.addEventListener('error', () => { root.classList.add('idk-frame-error'); notify('Browser', 'The page could not be loaded. Try again.', 'error'); });
      frame.addEventListener('load', () => root.classList.remove('idk-frame-error'));
    });
  }

  const oldScan = scan;
  scan = function () {
    oldScan();
    setupEcho();
    document.querySelectorAll('.site-frame').forEach(enhanceBrowser);
    improveStates();
  };

  const installRelease = () => { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installRelease, { once: true }); else installRelease();
  window.addEventListener('error', event => { if (event?.message) notify('IDK', 'Something went wrong. Try the action again.', 'error'); });
  window.addEventListener('unhandledrejection', event => { if (event?.reason) notify('IDK', 'A background task failed. Try again.', 'error'); });
  window.IDKReleaseBatch.openEchoPanel = openEchoPanel;
  window.IDKReleaseBatch = { scan, openEchoPanel };
  const install = () => { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
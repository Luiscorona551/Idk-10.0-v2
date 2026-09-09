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

  window.IDKReleaseBatch = { scan };
  const install = () => { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

(() => {
  'use strict';
  if (window.IDKProductionSuite) return;

  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const download = (name, value) => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1200); };
  const getJSON = async url => { const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `${response.status} response`); return data; };
  const postJSON = async (url, body = {}) => { const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }); const data = await response.json().catch(() => ({})); if (!response.ok || data.ok === false) throw new Error(data.error || `${response.status} response`); return data; };
  const button = (text, action, className = 'btn') => { const value = document.createElement('button'); value.type = 'button'; value.className = className; value.textContent = text; value.onclick = action; return value; };
  if (typeof APPS !== 'undefined' && !APPS.reliability) APPS.reliability = { title: 'Reliability Center', glyph: '🛡️', desktop: false, dock: false, width: 920, height: 680, render: createDashboard };

  async function probe(url) { try { return { ok: true, data: await getJSON(url) }; } catch (error) { return { ok: false, error: error.message }; } }

  function createDashboard() {
    const root = document.createElement('div');
    root.className = 'idk-production-center';
    root.innerHTML = '<div class="idk-production-head"><div><h2>Reliability Center</h2><p>Deployment, account security, sync, AI, app trust, and legal media links.</p></div><span class="idk-production-version">IDK 10.0</span></div><nav class="idk-production-tabs" aria-label="Reliability Center sections"><button type="button" data-tab="reliability">Overview</button><button type="button" data-tab="account">Account</button><button type="button" data-tab="sync">Sync & Backup</button><button type="button" data-tab="ai">AI Setup</button><button type="button" data-tab="apps">App Trust</button><button type="button" data-tab="media">Media</button></nav><div class="idk-production-pane" data-pane></div>';
    const pane = root.querySelector('[data-pane]');
    const tabs = [...root.querySelectorAll('[data-tab]')];
    const setStatus = (node, message, good = false) => { node.textContent = message; node.className = `idk-production-status${good ? ' good' : ''}`; };
    const card = (label, value, detail, state = 'neutral') => `<article class="idk-production-card ${state}"><strong>${esc(value)}</strong><span>${esc(label)}</span><small>${esc(detail)}</small></article>`;

    async function renderReliability() {
      pane.innerHTML = '<div class="idk-production-toolbar"><div><strong>System readiness</strong><small>Checks use the current browser and server only.</small></div><div class="idk-production-actions"></div></div><div class="idk-production-grid" data-grid></div><div class="idk-production-log" data-log></div>';
      const actions = pane.querySelector('.idk-production-actions'), grid = pane.querySelector('[data-grid]'), log = pane.querySelector('[data-log]');
      const refresh = button('Run checks', async () => { refresh.disabled = true; await renderReliability(); });
      actions.append(refresh, button('Export diagnostics', async () => { const data = await collectDiagnostics(); download(`idk-diagnostics-${new Date().toISOString().slice(0, 10)}.json`, data); notify('Reliability Center', 'Diagnostics downloaded.', 'success'); }, 'btn tab'));
      const [health, deploy, ai, account] = await Promise.all([probe('/healthz'), probe('/api/deploy/status'), probe('/api/ai/status'), probe('/api/account/status')]);
      const sync = window.IDKAccount?.getSyncStatus?.() || read('idkSyncStatus', {});
      const queue = read('idkOfflineQueue', []).length + read('idkCloudSyncQueue', []).length;
      const crash = read('idkCrashLog', []).length;
      const storage = await window.IDKPerfectOS?.storageInfo?.().catch?.(() => null) || null;
      const database = health.data?.database;
      grid.innerHTML = [
        card('Server', health.ok ? 'Healthy' : 'Unavailable', health.ok ? `${health.data?.service || 'IDK server'} responding` : health.error, health.ok ? 'good' : 'bad'),
        card('Deployment', deploy.ok ? (deploy.data?.commit || 'Ready') : 'Unknown', deploy.ok ? `${deploy.data?.environment || 'Railway'} · ${deploy.data?.version || 'current'}` : deploy.error, deploy.ok ? 'good' : 'warn'),
        card('Database', database?.connected ? 'Connected' : database?.configured ? 'Unavailable' : 'Not configured', database?.tablesReady ? 'Tables ready' : 'Account persistence status', database?.connected ? 'good' : 'warn'),
        card('AI', ai.data?.configured ? 'Configured' : 'Needs server key', ai.data?.provider || 'Set AI_API_KEY in deployment settings', ai.data?.configured ? 'good' : 'warn'),
        card('Account', account.data?.authenticated ? 'Signed in' : 'Guest mode', account.data?.user?.username || 'Local data remains available', account.data?.authenticated ? 'good' : 'neutral'),
        card('Sync', sync.lastSuccess ? 'Last sync saved' : sync.lastError ? 'Needs attention' : 'Ready', sync.lastSuccess ? new Date(sync.lastSuccess).toLocaleString() : `${sync.failures || 0} recent failure${sync.failures === 1 ? '' : 's'}`, sync.lastError ? 'warn' : 'good'),
        card('Offline queue', queue ? `${queue} pending` : 'Clear', queue ? 'Will retry on the next connection' : 'No queued actions', queue ? 'warn' : 'good'),
        card('Crash log', crash ? `${crash} recorded` : 'Clear', crash ? 'Review System Health' : 'No client errors recorded', crash ? 'warn' : 'good'),
        card('Storage', storage?.quota ? `${Math.round((storage.usage / storage.quota) * 100)}% used` : 'Unknown', storage?.quota ? 'Browser quota estimate' : 'Storage estimate unavailable', 'neutral')
      ].join('');
      log.textContent = `Checked ${new Date().toLocaleString()} · Network ${navigator.onLine ? 'online' : 'offline'} · Browser ${navigator.userAgent.replace(/\s+/g, ' ').slice(0, 100)}`;
    }

    async function collectDiagnostics() {
      const [health, deploy, ai, account] = await Promise.all([probe('/healthz'), probe('/api/deploy/status'), probe('/api/ai/status'), probe('/api/account/status')]);
      return { format: 'idk-diagnostics', version: 1, createdAt: new Date().toISOString(), health, deploy, ai: ai.data ? { ...ai.data, configured: Boolean(ai.data.configured) } : ai, account: account.data ? { configured: account.data.configured, authenticated: account.data.authenticated, user: account.data.user?.username || null } : account, local: { online: navigator.onLine, pendingOffline: read('idkOfflineQueue', []).length, pendingSync: read('idkCloudSyncQueue', []).length, crashLog: read('idkCrashLog', []).slice(-20), installedPrograms: read('idkInstalledPrograms', []).map(item => ({ id: item.id, name: item.name, version: item.version, source: item.source })) } };
    }

    function renderAccount() {
      const user = window.IDKAccount?.user;
      pane.innerHTML = `<div class="idk-production-section"><h3>Account Security</h3><p class="idk-production-note">${user ? `Signed in as <strong>${esc(user.username)}</strong>. Passwords and recovery codes are never stored in this browser.` : 'Sign in through the account prompt to manage server-backed security.'}</p><div class="idk-production-actions" data-account-actions></div><div class="idk-production-form-grid"><form data-password><h4>Change password</h4><input class="field" name="current" type="password" autocomplete="current-password" placeholder="Current password" required><input class="field" name="next" type="password" autocomplete="new-password" placeholder="New password (8+ characters)" minlength="8" required><input class="field" name="confirm" type="password" autocomplete="new-password" placeholder="Repeat new password" minlength="8" required><button class="btn" type="submit">Update password</button><p class="idk-production-status" data-password-status></p></form><section><h4>Recovery codes</h4><p class="idk-production-note">Generate one-time codes and keep them somewhere safe. Each code works once.</p><button class="btn tab" data-recovery>Generate recovery codes</button><pre class="idk-recovery-codes" data-codes hidden></pre></section></div><div class="idk-production-list" data-devices><p class="idk-production-note">Loading devices…</p></div></div>`;
      const actions = pane.querySelector('[data-account-actions]');
       actions.append(button('Export account data', async () => { try { const data = await getJSON('/api/account/export'); download(`idk-account-export-${new Date().toISOString().slice(0, 10)}.json`, data); } catch (error) { notify('Account', error.message, 'warning'); } }), button('Security Center', () => window.IDKBatchNineteen?.open?.(), 'btn'), button('Revoke other devices', async () => { try { await postJSON('/api/account/devices/revoke-others'); notify('Account', 'Other device sessions were revoked.', 'success'); renderAccount(); } catch (error) { notify('Account', error.message, 'warning'); } }, 'btn tab'), button('Open Accounts & Devices', () => window.IDKAccountsDevices?.open?.('security'), 'btn tab'));
      const passwordForm = pane.querySelector('[data-password]'), status = pane.querySelector('[data-password-status]');
      passwordForm.onsubmit = async event => { event.preventDefault(); const form = event.currentTarget; if (form.next.value !== form.confirm.value) return setStatus(status, 'The new passwords do not match.'); try { await postJSON('/api/account/password', { currentPassword: form.current.value, newPassword: form.next.value }); form.reset(); setStatus(status, 'Password updated and other sessions revoked.', true); } catch (error) { setStatus(status, error.message); } };
      pane.querySelector('[data-recovery]').onclick = async () => { try { const data = await postJSON('/api/account/recovery-codes'); const output = pane.querySelector('[data-codes]'); output.hidden = false; output.textContent = data.codes.join('\n'); notify('Account', 'Save these recovery codes somewhere safe.', 'success'); } catch (error) { notify('Account', error.message, 'warning'); } };
      getJSON('/api/account/devices').then(data => { const list = pane.querySelector('[data-devices]'); list.innerHTML = '<h4>Connected devices</h4>'; (data.devices || []).forEach(device => { const row = document.createElement('article'); row.className = 'idk-production-row'; row.innerHTML = `<div><strong>${esc(device.label || 'IDK browser')}${device.id === data.currentDeviceId ? ' · Current' : ''}</strong><small>Last seen ${esc(new Date(device.lastSeen).toLocaleString())}</small></div><span>${device.revokedAt ? 'Revoked' : 'Active'}</span>`; list.append(row); }); }).catch(error => { pane.querySelector('[data-devices]').innerHTML = `<p class="idk-production-status">${esc(error.message)}</p>`; });
    }

    function renderSync() {
      const status = window.IDKAccount?.getSyncStatus?.() || read('idkSyncStatus', {}), queued = read('idkOfflineQueue', []).length + read('idkCloudSyncQueue', []).length;
      pane.innerHTML = `<div class="idk-production-section"><h3>Sync & Backup</h3><p class="idk-production-note">Cloud sync is automatic when signed in. Offline changes remain local until the connection returns.</p><div class="idk-production-grid">${card('Sync state', status.lastError ? 'Needs attention' : status.lastSuccess ? 'Healthy' : 'Ready', status.lastSuccess ? new Date(status.lastSuccess).toLocaleString() : 'No completed sync recorded', status.lastError ? 'warn' : 'good')}${card('Queued work', queued ? `${queued} items` : 'None', queued ? 'Retry is available below' : 'Nothing waiting', queued ? 'warn' : 'good')}${card('Backup', 'Encrypted', 'Local recovery package uses AES-GCM', 'good')}</div><div class="idk-production-actions" data-actions></div><p class="idk-production-status" data-status>${esc(status.lastError || 'Ready')}</p></div>`;
      const actions = pane.querySelector('[data-actions]'), message = pane.querySelector('[data-status]');
      actions.append(button('Sync now', async () => { message.textContent = 'Syncing…'; const ok = await window.IDKAccount?.sync?.(); message.textContent = ok ? 'Sync complete.' : 'Sync did not complete; review the queue and try again.'; if (ok) renderSync(); }), button('Download encrypted backup', () => window.IDKPerfectOS?.exportBackup?.(), 'btn tab'), button('Download account export', async () => { try { download(`idk-account-export-${new Date().toISOString().slice(0, 10)}.json`, await getJSON('/api/account/export')); } catch (error) { message.textContent = error.message; } }, 'btn tab'), button('Open provider settings', () => window.IDKAccountsDevices?.open?.('sync'), 'btn tab'));
    }

    async function renderAI() {
      const server = await probe('/api/ai/status'), endpoint = read('idkAIEndpoint', '/api/ai'), model = read('idkAIModel', 'gpt-4o-mini');
      pane.innerHTML = `<div class="idk-production-section"><h3>AI Setup</h3><p class="idk-production-note">Server keys stay on Railway. This panel never asks you to paste a server secret into IDK.</p><div class="idk-production-grid">${card('Server AI', server.data?.configured ? 'Configured' : 'Waiting for key', server.data?.provider || server.error || 'Set AI_API_KEY in Railway variables', server.data?.configured ? 'good' : 'warn')}${card('Model', model, endpoint, 'neutral')}</div><form class="idk-production-form" data-ai-form><label>AI endpoint<input class="field" name="endpoint" value="${esc(endpoint)}" placeholder="/api/ai or an OpenAI-compatible endpoint"></label><label>Default model<input class="field" name="model" value="${esc(model)}" placeholder="gpt-4o-mini"></label><div class="idk-production-actions"><button class="btn" type="submit">Save local AI settings</button><button class="btn tab" type="button" data-open-ai>Open AI</button></div><p class="idk-production-status" data-status>${server.data?.configured ? 'Server AI is ready.' : 'The app is ready; add AI_API_KEY to enable server AI.'}</p></form></div>`;
      const form = pane.querySelector('[data-ai-form]'), message = pane.querySelector('[data-status]');
      form.onsubmit = event => { event.preventDefault(); write('idkAIEndpoint', form.endpoint.value.trim() || '/api/ai'); write('idkAIModel', form.model.value.trim() || 'gpt-4o-mini'); message.textContent = 'Saved locally. The API key remains server-side.'; };
      pane.querySelector('[data-open-ai]').onclick = () => window.OS?.open?.('ai');
    }

    function renderApps() {
      const installed = read('idkInstalledPrograms', []), pending = read('idkPendingAppUpdates', []), safety = read('idkProgramSafety', {});
      pane.innerHTML = `<div class="idk-production-section"><h3>App Trust & Marketplace</h3><p class="idk-production-note">Installed HTML apps remain sandboxed and require launch approval. Review updates before installing them.</p><div class="idk-production-grid">${card('Installed apps', installed.length, `${Object.keys(safety).length} trust records`, 'neutral')}${card('Pending updates', pending.length, pending.length ? 'Review in App Manager' : 'No pending updates', pending.length ? 'warn' : 'good')}${card('Allowed launches', Object.values(safety).filter(item => item?.approved).length, 'Local approvals only', 'good')}</div><div class="idk-production-actions" data-actions></div><div class="idk-production-list" data-list></div><p class="idk-production-status" data-status>Capabilities are rechecked before untrusted apps launch.</p></div>`;
      const actions = pane.querySelector('[data-actions]'), status = pane.querySelector('[data-status]');
      actions.append(button('Open App Store', () => window.IDKProductFeatures?.appCenter?.()), button('App Manager', () => window.IDKPlatformNext?.openAppManager?.(), 'btn tab'), button('Safety Center', () => window.IDKPlatformNext?.openSafetyCenter?.(), 'btn tab'), button('Reset app trust', () => { if (!confirm('Reset launch approvals for installed apps?')) return; localStorage.removeItem('idkProgramSafety'); status.textContent = 'All installed apps require review again.'; notify('App Trust', 'Launch approvals reset.', 'success'); }, 'btn tab'));
      const list = pane.querySelector('[data-list]');
      if (!installed.length) list.innerHTML = '<p class="idk-production-note">No installed programs.</p>';
      installed.forEach(program => { const row = document.createElement('article'); row.className = 'idk-production-row'; row.innerHTML = `<div><strong>${esc(program.icon || '🧩')} ${esc(program.name)}</strong><small>Version ${esc(program.version || 'local')} · ${program.source === 'public-store' ? 'App Store' : 'Local app'}</small></div>`; row.append(button('Uninstall', async () => { if (!confirm(`Uninstall ${program.name}?`)) return; await window.IDKInstaller?.remove?.(program.id); notify('App Trust', `${program.name} was uninstalled.`, 'success'); renderApps(); }, 'btn tab')); list.append(row); });
    }

    function renderMedia() {
      pane.innerHTML = '<div class="idk-production-section"><h3>Legal Media Sources</h3><p class="idk-production-note">The local Music Player stays available. These links use official or public-domain sources and do not bypass access controls.</p><div class="idk-media-links" data-links></div></div>';
      const links = pane.querySelector('[data-links]');
      [['Spotify', 'Official Spotify web app', 'https://open.spotify.com/', 'music'], ['YouTube', 'Official YouTube', 'https://www.youtube.com/', 'music'], ['Internet Archive', 'Public collections and legal media', 'https://archive.org/', 'movies']].forEach(([name, detail, url, app]) => { const item = document.createElement('article'); item.className = 'idk-production-media'; item.innerHTML = `<div><strong>${esc(name)}</strong><small>${esc(detail)}</small></div>`; item.append(button('Open official site', () => window.open(url, '_blank', 'noopener,noreferrer')), button(`Open in IDK ${app === 'music' ? 'Music' : 'Movies'}`, () => window.OS?.open?.(app), 'btn tab')); links.append(item); });
    }

    async function render(tab) { tabs.forEach(item => item.classList.toggle('active', item.dataset.tab === tab)); if (tab === 'account') return renderAccount(); if (tab === 'sync') return renderSync(); if (tab === 'ai') return renderAI(); if (tab === 'apps') return renderApps(); if (tab === 'media') return renderMedia(); return renderReliability(); }
    tabs.forEach(item => { item.onclick = () => render(item.dataset.tab); });
    render('reliability');
    return root;
  }

  function open() { if (window.OS?.open && typeof APPS !== 'undefined' && APPS.reliability) window.OS.open('reliability'); else { const root = document.createElement('section'); root.className = 'idk-next-modal idk-production-modal'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.innerHTML = '<div class="idk-next-card"><header class="idk-next-head"><strong>Reliability Center</strong><button type="button" data-close>×</button></header><div class="idk-next-body"></div></div>'; root.querySelector('[data-close]').onclick = () => root.remove(); root.querySelector('.idk-next-body').append(createDashboard()); document.body.append(root); } }
  function install() { const status = document.getElementById('idk-perfect-status'); if (status && !status.querySelector('[data-reliability]')) { const action = button('Reliability', open, 'idk-reliability-button'); action.dataset.reliability = 'true'; status.append(action); } }

  window.IDKProductionSuite = { open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

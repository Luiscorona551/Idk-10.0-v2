(() => {
  'use strict';
  if (window.IDKBatchNineteen) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const getJSON = async url => { const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' }); const data = await response.json().catch(() => ({})); if (!response.ok || data.ok === false) throw new Error(data.error || `${response.status} response`); return data; };
  const sendJSON = async (url, method, body = {}) => { const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }); const data = await response.json().catch(() => ({})); if (!response.ok || data.ok === false) throw new Error(data.error || `${response.status} response`); return data; };
  const sameEnvelope = (left, right) => Boolean(left && right && left.version === right.version && left.salt === right.salt && left.iv === right.iv && left.ciphertext === right.ciphertext);
  const download = (name, value, type = 'application/json') => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], { type })); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); };

  async function localVault() { return window.IDKBatchEighteen?.getEncryptedRecord?.() || null; }
  async function loadRemoteVault() { return (await getJSON('/api/account/vault')).backup || null; }

  function vaultPane() {
    const root = document.createElement('section');
    root.innerHTML = '<h2>Vault Portability</h2><p class="idk-security-note">Cloud backup stores only the encrypted Vault envelope. Your Vault passphrase never leaves this browser.</p><div class="idk-security-grid" data-summary></div><div class="idk-security-actions"><button class="btn" data-refresh>Refresh status</button><button class="btn tab" data-upload>Upload encrypted backup</button><button class="btn tab" data-restore hidden>Restore cloud backup</button><button class="btn tab" data-replace hidden>Replace cloud backup</button></div><section class="idk-security-card"><h3>One-time device transfer</h3><p>Move the encrypted Vault record to another browser without sharing your account session. The code works once and expires shortly.</p><button class="btn" data-create-transfer>Create transfer code</button><div class="idk-transfer-box" data-transfer hidden><strong data-transfer-code></strong><small data-transfer-expiry></small><button class="btn tab" data-copy-transfer>Copy code</button></div><form data-claim-transfer><input class="field" name="code" inputmode="text" autocomplete="one-time-code" placeholder="Transfer code"><button class="btn tab" type="submit">Claim on this device</button></form></section><p class="idk-security-status" data-status>Checking encrypted Vault status…</p></section>';
    const summary = root.querySelector('[data-summary]'), status = root.querySelector('[data-status]'), restore = root.querySelector('[data-restore]'), replace = root.querySelector('[data-replace]');
    let local = null, remote = null;
    const render = () => { const localState = local ? 'Encrypted record present' : 'No local Vault'; const cloudState = remote ? `Cloud revision ${remote.revision}` : 'No cloud backup'; summary.innerHTML = `<article><strong>${esc(localState)}</strong><small>Browser storage</small></article><article><strong>${esc(cloudState)}</strong><small>Account storage</small></article><article><strong>${local && remote ? (sameEnvelope(local, remote.envelope) ? 'In sync' : 'Conflict') : 'Ready'}</strong><small>Never stores plaintext</small></article>`; const conflict = Boolean(local && remote && !sameEnvelope(local, remote.envelope)); restore.hidden = !remote || !conflict; replace.hidden = !local || !remote || !conflict; };
    const refresh = async () => { status.textContent = 'Checking encrypted Vault status…'; try { local = await localVault(); remote = window.IDKAccount?.user ? await loadRemoteVault() : null; render(); status.textContent = window.IDKAccount?.user ? 'Encrypted backup status loaded.' : 'Sign in to enable cloud backup and transfer.'; } catch (error) { status.textContent = error.message; render(); } };
    root.querySelector('[data-refresh]').onclick = refresh;
    root.querySelector('[data-upload]').onclick = async () => { try { local = await localVault(); if (!local) throw new Error('Create or unlock a Vault before backing it up.'); remote = await loadRemoteVault(); if (remote && !sameEnvelope(local, remote.envelope) && !confirm('A different encrypted backup already exists. Replace it?')) { render(); status.textContent = 'Cloud backup was left unchanged.'; return; } const result = await sendJSON('/api/account/vault', 'PUT', { envelope: local, expectedRevision: remote?.revision || 0 }); remote = { envelope: local, revision: result.revision }; render(); status.textContent = 'Encrypted Vault backup saved.'; notify('Vault', 'Encrypted cloud backup saved.', 'success'); } catch (error) { status.textContent = error.message; } };
    restore.onclick = async () => { try { await window.IDKBatchEighteen?.installEncryptedRecord?.(remote.envelope); status.textContent = 'Cloud Vault installed locally. Unlock it with the original passphrase.'; } catch (error) { status.textContent = error.message; } };
    replace.onclick = () => root.querySelector('[data-upload]').click();
    root.querySelector('[data-create-transfer]').onclick = async () => { const box = root.querySelector('[data-transfer]'), code = root.querySelector('[data-transfer-code]'), expiry = root.querySelector('[data-transfer-expiry]'); try { local = await localVault(); if (!local) throw new Error('Create or unlock a Vault before creating a transfer.'); const data = await sendJSON('/api/account/vault/transfer/create', 'POST', { envelope: local }); code.textContent = data.code; expiry.textContent = `Expires ${new Date(data.expiresAt).toLocaleTimeString()}`; box.hidden = false; status.textContent = 'Transfer code created. Share it only with the receiving device.'; } catch (error) { status.textContent = error.message; } };
    root.querySelector('[data-copy-transfer]').onclick = async () => { const value = root.querySelector('[data-transfer-code]').textContent; try { await navigator.clipboard.writeText(value); status.textContent = 'Transfer code copied.'; } catch { status.textContent = 'Clipboard access was unavailable.'; } };
    root.querySelector('[data-claim-transfer]').onsubmit = async event => { event.preventDefault(); try { const data = await sendJSON('/api/account/vault/transfer/claim', 'POST', { code: event.currentTarget.code.value }); await window.IDKBatchEighteen?.installEncryptedRecord?.(data.envelope); event.currentTarget.reset(); status.textContent = 'Encrypted Vault transferred. Unlock it with the original passphrase.'; notify('Vault', 'One-time Vault transfer claimed.', 'success'); } catch (error) { status.textContent = error.message; } };
    refresh();
    return root;
  }

  function recoveryPane() {
    const root = document.createElement('section');
    root.innerHTML = '<h2>Recovery Codes</h2><p class="idk-security-note">Codes are shown once, never stored in this browser, and each code works only once. Print or save them before closing this panel.</p><div class="idk-security-actions"><button class="btn" data-generate>Generate new codes</button><button class="btn tab" data-print hidden>Print codes</button><button class="btn tab" data-copy hidden>Copy codes</button><button class="btn tab" data-clear hidden>Clear</button></div><pre class="idk-recovery-sheet" data-codes hidden></pre><p class="idk-security-status" data-status>Ready.</p>';
    const output = root.querySelector('[data-codes]'), status = root.querySelector('[data-status]'), actions = ['print', 'copy', 'clear'].map(name => root.querySelector(`[data-${name}]`));
    root.querySelector('[data-generate]').onclick = async () => { try { const data = await sendJSON('/api/account/recovery-codes', 'POST'); output.textContent = data.codes.join('\n'); output.hidden = false; actions.forEach(item => { item.hidden = false; }); status.textContent = 'Codes generated. Generating new codes invalidates earlier codes.'; notify('Account', 'Save your new recovery codes somewhere safe.', 'success'); } catch (error) { status.textContent = error.message; } };
    root.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(output.textContent); status.textContent = 'Recovery codes copied. Clear the display when finished.'; } catch { status.textContent = 'Clipboard access was unavailable.'; } };
    root.querySelector('[data-print]').onclick = () => { const printWindow = window.open('', '_blank', 'width=520,height=640'); if (!printWindow) return; printWindow.document.write(`<title>IDK Recovery Codes</title><main style="font:16px system-ui;max-width:420px;margin:40px auto"><h1>IDK Recovery Codes</h1><p>Each code works once. Keep this page private.</p><pre style="font:20px monospace;line-height:1.8">${esc(output.textContent)}</pre></main>`); printWindow.document.close(); printWindow.focus(); printWindow.print(); };
    root.querySelector('[data-clear]').onclick = () => { output.textContent = ''; output.hidden = true; actions.forEach(item => { item.hidden = true; }); status.textContent = 'Codes cleared from this panel.'; };
    return root;
  }

  function auditPane() {
    const root = document.createElement('section');
    root.innerHTML = '<h2>Privacy History</h2><p class="idk-security-note">Server-recorded account security events. Vault contents, passphrases, and recovery-code values are never included.</p><div class="idk-security-actions"><button class="btn" data-refresh>Refresh history</button><button class="btn tab" data-download>Download history</button></div><div class="idk-audit-list" data-list><p>Loading history…</p></div><p class="idk-security-status" data-status></p>';
    const list = root.querySelector('[data-list]'), status = root.querySelector('[data-status]');
    const load = async () => { try { const data = await getJSON('/api/account/audit?limit=100'); list.replaceChildren(...(data.events || []).map(event => { const card = document.createElement('article'); card.innerHTML = `<strong>${esc(event.event)}</strong><small>${esc(new Date(event.createdAt).toLocaleString())}</small><span>${esc(Object.entries(event.detail || {}).map(([key, value]) => `${key}: ${value}`).join(' · '))}</span>`; return card; })); if (!data.events?.length) list.innerHTML = '<p>No security events recorded yet.</p>'; status.textContent = `${data.events?.length || 0} recent events.`; } catch (error) { list.innerHTML = `<p>${esc(error.message)}</p>`; } };
    root.querySelector('[data-refresh]').onclick = load;
    root.querySelector('[data-download]').onclick = async () => { try { const data = await getJSON('/api/account/audit?limit=100'); download(`idk-privacy-history-${new Date().toISOString().slice(0, 10)}.json`, { format: 'idk-privacy-history', exportedAt: new Date().toISOString(), events: data.events || [] }); } catch (error) { status.textContent = error.message; } };
    load();
    return root;
  }

  async function wipeLocalDevice() {
    document.body.insertAdjacentHTML('beforeend', '<section class="idk-remote-lock" id="idk-remote-lock"><div><strong>Remote wipe requested</strong><span>This browser is clearing local IDK data now.</span></div></section>');
    try { window.IDKBatchEighteen?.lock?.(''); } catch {}
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    try { const databases = await indexedDB.databases?.() || []; await Promise.all(databases.map(database => database.name ? new Promise(resolve => { const request = indexedDB.deleteDatabase(database.name); request.onsuccess = request.onerror = request.onblocked = resolve; }) : Promise.resolve())); } catch {}
    await fetch('/api/account/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    location.reload();
  }

  function lockLocalDevice() {
    if (document.getElementById('idk-remote-lock')) return;
    const root = document.createElement('section'); root.className = 'idk-remote-lock'; root.id = 'idk-remote-lock'; root.innerHTML = '<div><strong>Device locked</strong><span>An account administrator requested a lock. Sign out before handing this device to someone else.</span><button class="btn" type="button">Sign out and reload</button></div>'; root.querySelector('button').onclick = async () => { await fetch('/api/account/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {}); localStorage.removeItem('idkAccountSession'); location.reload(); }; document.body.append(root);
  }

  async function pollCommands() {
    if (!window.IDKAccount?.user) return;
    try { const data = await getJSON('/api/account/device-commands'); for (const command of data.commands || []) { if (command.type === 'lock') lockLocalDevice(); if (command.type === 'wipe') await wipeLocalDevice(); await sendJSON(`/api/account/device-commands/${encodeURIComponent(command.id)}/ack`, 'POST').catch(() => {}); } } catch {}
  }

  function installStyle() { if (document.querySelector('link[href="idk-batch-nineteen.css"]')) return; const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'idk-batch-nineteen.css'; document.head.append(link); }
  function installDesktopBatch() { if (!document.querySelector('link[href^="idk-batch-twentyone.css"]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'idk-batch-twentyone.css?v=21'; document.head.append(link); } if (!document.querySelector('script[src^="idk-batch-twentyone.js"]')) { const script = document.createElement('script'); script.src = 'idk-batch-twentyone.js?v=21'; script.defer = true; document.body.append(script); } }

  function devicesPane() {
    const root = document.createElement('section');
    root.innerHTML = '<h2>Connected Devices</h2><p class="idk-security-note">Revoke sessions immediately, or send a lock or wipe command. Commands take effect when the other browser checks in; an offline or closed device cannot receive one.</p><div class="idk-security-device-list" data-list><p>Loading devices…</p></div><p class="idk-security-status" data-status></p>';
    const list = root.querySelector('[data-list]'), status = root.querySelector('[data-status]');
    const command = async (device, type) => { if (!confirm(`${type === 'wipe' ? 'Wipe all local IDK data from' : 'Lock'} ${device.label || 'this device'}?`)) return; try { await sendJSON(`/api/account/devices/${encodeURIComponent(device.id)}/commands`, 'POST', { type }); status.textContent = `${type === 'wipe' ? 'Wipe' : 'Lock'} command sent.`; } catch (error) { status.textContent = error.message; } };
    const load = async () => { try { const data = await getJSON('/api/account/devices'); list.replaceChildren(...(data.devices || []).map(device => { const card = document.createElement('article'); const current = device.id === data.currentDeviceId; card.innerHTML = `<div><strong>${esc(device.label || 'IDK browser')}${current ? ' · Current' : ''}</strong><small>${esc(device.userAgent || 'Browser')} · Last seen ${esc(new Date(device.lastSeen).toLocaleString())}</small></div><div class="idk-security-actions"></div>`; const actions = card.querySelector('.idk-security-actions'); if (!current && !device.revokedAt) { const lock = document.createElement('button'); lock.className = 'btn tab'; lock.textContent = 'Lock'; lock.onclick = () => command(device, 'lock'); const wipe = document.createElement('button'); wipe.className = 'btn danger'; wipe.textContent = 'Wipe'; wipe.onclick = () => command(device, 'wipe'); const revoke = document.createElement('button'); revoke.className = 'btn tab'; revoke.textContent = 'Revoke'; revoke.onclick = async () => { if (!confirm(`Revoke ${device.label || 'this device'}?`)) return; await fetch(`/api/account/devices/${encodeURIComponent(device.id)}`, { method: 'DELETE', credentials: 'same-origin' }); load(); }; actions.append(lock, wipe, revoke); } else if (device.revokedAt) actions.append(Object.assign(document.createElement('span'), { className: 'idk-security-revoked', textContent: 'Revoked' })); return card; })); if (!data.devices?.length) list.innerHTML = '<p>No connected devices found.</p>'; } catch (error) { list.innerHTML = `<p>${esc(error.message)}</p>`; } };
    load();
    return root;
  }

  function securityApp(opts = {}) {
    const root = document.createElement('div'); root.className = 'app idk-security-batch19';
    root.innerHTML = '<aside class="idk-security-nav"><strong>Security Center</strong><small>Batch 19 controls</small><nav data-nav></nav></aside><main class="idk-security-main" data-pane></main>';
    const pane = root.querySelector('[data-pane]'), nav = root.querySelector('[data-nav]'), views = { vault: ['Vault portability', vaultPane], recovery: ['Recovery codes', recoveryPane], audit: ['Privacy history', auditPane], devices: ['Connected devices', devicesPane] };
    const render = tab => { pane.replaceChildren(views[tab]?.[1]?.() || vaultPane()); nav.querySelectorAll('button').forEach(item => item.classList.toggle('active', item.dataset.tab === tab)); };
    Object.entries(views).forEach(([id, [label]]) => { const button = document.createElement('button'); button.type = 'button'; button.dataset.tab = id; button.textContent = label; button.onclick = () => render(id); nav.append(button); });
    render(opts.tab || 'vault');
    return root;
  }

  function open(tab = 'vault') { if (typeof APPS !== 'undefined' && APPS.security && window.OS?.open) window.OS.open('security', { tab }); }
  function install() {
    installStyle();
    installDesktopBatch();
    if (typeof APPS !== 'undefined') APPS.security ||= { title: 'Security Center', glyph: '◈', desktop: false, dock: false, width: 980, height: 720, render: securityApp };
    window.addEventListener('idk-account-restored', () => { pollCommands(); clearInterval(window.IDKBatchNineteen.commandTimer); window.IDKBatchNineteen.commandTimer = setInterval(pollCommands, 30000); });
    setTimeout(pollCommands, 2500);
  }

  window.IDKBatchNineteen = { open, securityApp, pollCommands, wipeLocalDevice };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

(() => {
  'use strict';
  if (window.IDKReleaseNext) return;

  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const formatBytes = size => { if (!Number.isFinite(size)) return 'Unknown size'; if (size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`; return `${(size / (1024 * 1024)).toFixed(1)} MB`; };
  const fileList = () => window.SYSTEM_APPS?.getFiles?.() || read('idkFileSystem', []);
  const downloadsFolder = () => fileList().find(item => item.type === 'folder' && item.parent === '' && item.name.toLowerCase() === 'downloads');
  const localDownloads = () => { const folder = downloadsFolder(); return fileList().filter(item => item.type === 'file' && item.parent === folder?.id); };
  const queueKey = 'idkDownloadQueue';
  const gamepadKey = 'idkGamepadMappings';
  const downloadName = url => { try { const value = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || 'download'); return value.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 120) || `download-${Date.now()}`; } catch { return `download-${Date.now()}`; } };

  function addCallHealth(root) {
    if (!root || root.dataset.idkCallHealth) return;
    root.dataset.idkCallHealth = 'true';
    const card = document.createElement('section');
    card.className = 'idk-call-health';
    card.innerHTML = '<div><strong>Connection health</strong><small data-transport>Checking call transport...</small></div><span data-state>Ready</span><div class="idk-call-actions"><button class="btn tab" data-mic>Test microphone</button><button class="btn tab" data-diagnostics>Open diagnostics</button></div>';
    root.querySelector('.idk-call-intro')?.after(card);
    const transport = card.querySelector('[data-transport]'), state = card.querySelector('[data-state]');
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
    const actions = document.createElement('div'); actions.className = 'idk-security-actions idk-release-device-actions';
    const revoke = document.createElement('button'); revoke.type = 'button'; revoke.className = 'btn tab'; revoke.textContent = 'Sign out other devices';
    const status = root.querySelector('[data-status]');
    revoke.onclick = async () => { if (!confirm('Sign out all other IDK browser sessions?')) return; revoke.disabled = true; try { const response = await fetch('/api/account/devices/revoke-others', { method: 'POST', credentials: 'same-origin' }); const data = await response.json(); if (!response.ok || data.ok === false) throw new Error(data.error || 'Could not revoke other devices.'); if (status) status.textContent = `${data.revokedDevices || 0} other device session(s) signed out.`; notify('Account', 'Other device sessions were revoked.', 'success'); } catch (error) { if (status) status.textContent = error.message; } finally { revoke.disabled = false; } };
    actions.append(revoke); root.querySelector('[data-list]')?.before(actions);
  }

  function saveQueue(queue) { write(queueKey, queue.slice(-30)); window.dispatchEvent(new CustomEvent('idk-download-queue')); }

  async function downloadQueued(item, update) {
    if (!navigator.onLine) { item.state = 'queued'; item.error = 'Waiting for a connection.'; update(); return; }
    const folder = downloadsFolder(); if (!folder) { item.state = 'error'; item.error = 'The Downloads folder is unavailable.'; update(); return; }
    item.state = 'downloading'; item.error = ''; item.progress = 0; saveQueue(read(queueKey, []).map(entry => entry.id === item.id ? item : entry)); update();
    try {
      const response = await fetch(item.url, { cache: 'no-store' }); if (!response.ok) throw new Error(`Download returned HTTP ${response.status}.`);
      const total = Number(response.headers.get('content-length') || 0); let blob;
      if (!response.body?.getReader) blob = await response.blob();
      else { const reader = response.body.getReader(), chunks = []; let received = 0, next = await reader.read(); while (!next.done) { chunks.push(next.value); received += next.value.byteLength; item.progress = total ? Math.round((received / total) * 100) : 0; update(); next = await reader.read(); } blob = new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' }); }
      await window.SYSTEM_APPS.writeBlobFile(item.name, blob, folder.id, blob.type); item.state = 'complete'; item.progress = 100; item.size = blob.size; item.error = ''; notify('Downloads', `${item.name} is ready in Downloads.`, 'success');
    } catch (error) { item.state = 'error'; item.error = error?.message || 'Download failed.'; notify('Downloads', `${item.name}: ${item.error}`, 'warning'); }
    saveQueue(read(queueKey, []).map(entry => entry.id === item.id ? item : entry)); update();
  }

  function downloadsApp() {
    const root = document.createElement('div'); root.className = 'app idk-downloads-app idk-download-queue-app';
    root.innerHTML = '<header class="idk-downloads-head"><div><h2>Downloads Center</h2><p>Save trusted URLs into IDK Downloads with progress, warnings, and offline retry.</p></div><span class="idk-downloads-mark">QUEUE READY</span></header><div class="idk-download-warning"><strong>Download safety</strong><span>Only download files from sources you trust. IDK does not scan downloaded files for malware.</span></div><form class="idk-download-form" data-form><input class="field" name="url" type="url" placeholder="https://example.com/file.pdf" required><input class="field" name="name" placeholder="Optional filename"><button class="btn" type="submit">Add download</button></form><p class="idk-download-status" data-status>Ready.</p><div class="idk-downloads-stats" data-stats></div><section class="idk-download-queue"><h3>Download queue</h3><div data-queue-list></div></section><div class="idk-downloads-toolbar"><input class="field" type="search" data-search placeholder="Search saved downloads..." aria-label="Search downloads"><button class="btn tab" type="button" data-files>Open Files</button><button class="btn tab" type="button" data-import>Import here</button><button class="btn tab" type="button" data-clear>Clear Downloads</button><input type="file" multiple hidden data-input></div><div class="idk-downloads-list" data-list></div>';
    const form = root.querySelector('[data-form]'), status = root.querySelector('[data-status]'), stats = root.querySelector('[data-stats]'), queueList = root.querySelector('[data-queue-list]'), list = root.querySelector('[data-list]'), search = root.querySelector('[data-search]'), input = root.querySelector('[data-input]');
    const openFiles = () => { window.OS?.open?.('files'); setTimeout(() => window.IDKFiles?.openLocation?.('Downloads'), 80); };
    const render = () => {
      const queue = read(queueKey, []), all = localDownloads(), query = search.value.trim().toLowerCase(), items = all.filter(item => !query || item.name.toLowerCase().includes(query));
      const total = all.reduce((sum, item) => sum + Number(item.size || item.content?.length || 0), 0); stats.innerHTML = `<article class="idk-downloads-stat"><strong>${all.length}</strong><small>saved files</small></article><article class="idk-downloads-stat"><strong>${formatBytes(total)}</strong><small>local storage</small></article><article class="idk-downloads-stat"><strong>${queue.filter(item => item.state === 'queued' || item.state === 'downloading').length}</strong><small>queued</small></article>`;
      queueList.replaceChildren(); if (!queue.length) queueList.append(Object.assign(document.createElement('p'), { className: 'idk-download-empty', textContent: 'No queued downloads.' }));
      queue.slice().reverse().forEach(item => { const row = document.createElement('article'); row.className = `idk-download-queue-item ${item.state}`; row.innerHTML = `<div><strong>${esc(item.name)}</strong><small>${esc(item.state === 'error' ? item.error : item.state)}${item.progress ? ` - ${item.progress}%` : ''}</small></div><div class="idk-download-actions"></div>`; const actions = row.querySelector('.idk-download-actions'); if (item.state === 'queued' || item.state === 'error') { const retry = document.createElement('button'); retry.className = 'btn tab'; retry.type = 'button'; retry.textContent = 'Retry'; retry.onclick = () => downloadQueued(item, render); actions.append(retry); } if (item.state === 'complete') { const dismiss = document.createElement('button'); dismiss.className = 'btn tab'; dismiss.type = 'button'; dismiss.textContent = 'Dismiss'; dismiss.onclick = () => { saveQueue(queue.filter(entry => entry.id !== item.id)); render(); }; actions.append(dismiss); } queueList.append(row); });
      list.replaceChildren(); if (!items.length) list.append(Object.assign(document.createElement('div'), { className: 'idk-download-empty', textContent: 'No saved downloads match this view.' }));
      items.forEach(entry => { const row = document.createElement('article'); row.className = 'idk-download-item'; row.innerHTML = `<span class="idk-download-icon">↓</span><div class="idk-download-info"><strong>${esc(entry.name)}</strong><small>${esc(entry.mime || 'File')} - ${formatBytes(Number(entry.size || entry.content?.length || 0))}</small></div><div class="idk-download-actions"></div>`; const actions = row.querySelector('.idk-download-actions'); const save = document.createElement('button'); save.className = 'btn'; save.type = 'button'; save.textContent = 'Download'; save.onclick = async () => { try { const blob = await window.SYSTEM_APPS?.readBlob?.(entry); if (!blob) throw new Error('That file is no longer available.'); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = entry.name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1200); } catch (error) { notify('Downloads', error.message, 'warning'); } }; const open = document.createElement('button'); open.className = 'btn tab'; open.type = 'button'; open.textContent = 'Open Files'; open.onclick = openFiles; const remove = document.createElement('button'); remove.className = 'btn tab'; remove.type = 'button'; remove.textContent = 'Delete'; remove.onclick = async () => { if (confirm(`Delete ${entry.name}?`)) { await window.IDKFiles?.removeEntries?.([entry]); render(); } }; actions.append(save, open, remove); list.append(row); });
    };
    form.onsubmit = event => { event.preventDefault(); let url; try { url = new URL(form.url.value.trim()); if (!/^https?:$/.test(url.protocol)) throw new Error('Use an HTTP or HTTPS download URL.'); } catch (error) { status.textContent = error.message || 'Enter a valid download URL.'; return; } const item = { id: `download-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, url: url.href, name: form.name.value.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 120) || downloadName(url.href), state: 'queued', progress: 0, at: Date.now() }; saveQueue([...read(queueKey, []), item]); form.reset(); render(); downloadQueued(item, render); };
    search.oninput = render; root.querySelector('[data-files]').onclick = openFiles; root.querySelector('[data-import]').onclick = () => input.click(); input.onchange = async () => { const folder = downloadsFolder(); if (folder && input.files?.length) await window.SYSTEM_APPS?.importFiles?.(input.files, folder.id); input.value = ''; render(); }; root.querySelector('[data-clear]').onclick = async () => { const items = localDownloads(); if (items.length && confirm(`Delete all ${items.length} saved downloads?`)) { await window.IDKFiles?.removeEntries?.(items); render(); } };
    const processQueue = () => read(queueKey, []).filter(item => item.state === 'queued' || item.state === 'error').forEach(item => downloadQueued(item, render));
    const refresh = () => { render(); if (navigator.onLine) processQueue(); }; window.addEventListener('idk-data-changed', render); window.addEventListener('idk-download-queue', render); window.addEventListener('online', refresh); window.addEventListener('offline', render); refresh(); root.cleanup = () => { window.removeEventListener('idk-data-changed', render); window.removeEventListener('idk-download-queue', render); window.removeEventListener('online', refresh); window.removeEventListener('offline', render); }; return root;
  }

  function addGameController(root) {
    if (!root || root.dataset.idkGameController) return; root.dataset.idkGameController = 'true'; const toolbar = root.querySelector('.toolbar'); if (!toolbar) return;
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'btn tab'; toggle.textContent = 'Controller'; const panel = document.createElement('section'); panel.className = 'idk-game-controller'; panel.hidden = true; panel.innerHTML = '<strong>Controller mapping</strong><small>Choose the keyboard key each gamepad button sends to the active game.</small><div data-mappings></div>'; const mappingRoot = panel.querySelector('[data-mappings]'); const keys = [['', 'Unmapped'], ['ArrowUp', 'Arrow up'], ['ArrowDown', 'Arrow down'], ['ArrowLeft', 'Arrow left'], ['ArrowRight', 'Arrow right'], [' ', 'Space'], ['Enter', 'Enter'], ['Escape', 'Escape'], ['KeyZ', 'Z'], ['KeyX', 'X']];
    const render = () => { const values = read(gamepadKey, {}); mappingRoot.replaceChildren(); for (let index = 0; index < 8; index += 1) { const label = document.createElement('label'); label.textContent = `Button ${index}`; const select = document.createElement('select'); select.className = 'field'; keys.forEach(([value, text]) => select.append(new Option(text, value))); select.value = values[index] || ''; select.onchange = () => { write(gamepadKey, { ...read(gamepadKey, {}), [index]: select.value }); window.IDKAccount?.sync?.(); }; label.append(select); mappingRoot.append(label); } };
    toggle.onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) render(); }; toolbar.append(toggle); toolbar.after(panel);
  }

  function updateGameAvailability(event) { const name = event.detail?.name; if (!name) return; document.querySelectorAll('.games-app .game-tile-card').forEach(card => { if (card.dataset.gameId !== name) return; const badge = card.querySelector('.game-availability'); if (badge) { badge.textContent = event.detail.ok ? 'Ready' : 'Unavailable'; badge.classList.toggle('is-unavailable', !event.detail.ok); } }); }
  function installGamepadRouting() { if (window.IDKReleaseGamepadRouting) return; window.IDKReleaseGamepadRouting = true; document.addEventListener('idk-hardware-input', event => { const index = event.detail?.buttons?.findIndex(Boolean); const key = read(gamepadKey, {})[index]; if (!key) return; const frame = document.querySelector('#windows .window[data-app="game-player"] iframe'); if (!frame) return; frame.contentWindow?.postMessage({ type: 'idk-game-key', key }, '*'); try { frame.contentDocument?.dispatchEvent(new KeyboardEvent('keydown', { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, bubbles: true })); } catch {} }); }

  function scan() { document.querySelectorAll('.idk-calls-app').forEach(addCallHealth); document.querySelectorAll('.idk-security-batch19').forEach(addDeviceSessionControls); document.querySelectorAll('.games-app').forEach(addGameController); }
  const install = () => { scan(); installGamepadRouting(); window.addEventListener('idk-game-availability', updateGameAvailability); let attempts = 0; const timer = setInterval(() => { if (typeof APPS !== 'undefined' && APPS.downloads && !APPS.downloads.render.__idkDownloadQueue) { APPS.downloads.render = downloadsApp; APPS.downloads.render.__idkDownloadQueue = true; clearInterval(timer); } if (++attempts > 100) clearInterval(timer); }, 100); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); };
  window.IDKReleaseNext = { scan, downloadsApp };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

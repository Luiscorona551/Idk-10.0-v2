(() => {
  'use strict';
  if (window.IDKBatchEleven) return;

  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const array = key => { const value = read(key, []); return Array.isArray(value) ? value : []; };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const open = (app, opts) => window.OS?.open?.(app, opts || {});
  const emit = type => window.dispatchEvent(new CustomEvent('idk-data-changed', { detail: { type, batch: 11 } }));
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const todayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  function injectStyle() {
    if (document.querySelector('link[href="idk-batch-eleven.css"]')) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'idk-batch-eleven.css'; document.head.append(link);
  }

  function files() { return window.IDKFiles?.getFiles?.() || array('idkFileSystem'); }
  async function toBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
  }
  function fromBase64(value, type) { const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0)); return new Blob([bytes], { type: type || 'application/octet-stream' }); }
  function downloadJSON(name, value) { const href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = href; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(href), 1000); }

  function copyDialog(items, from, to, copy) {
    const list = Array.from(items || []); let resolveResult;
    const result = new Promise(resolve => { resolveResult = resolve; });
    const root = document.createElement('section'); root.className = 'idk-copy-files'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<div class="idk-copy-dialog"><header><div><span class="idk-flow-kicker">IDK FILES</span><h2>Copy Files</h2><p data-status>Preparing ${esc(from)} for ${esc(to)}.</p></div><button type="button" data-close disabled aria-label="Close">×</button></header><div class="idk-copy-transfer"><div class="idk-copy-location"><span class="idk-copy-folder"></span><strong>${esc(from)}</strong></div><span class="idk-copy-travel"><i></i><i></i><i></i></span><div class="idk-copy-location"><span class="idk-copy-folder"></span><strong>${esc(to)}</strong></div></div><div class="idk-copy-count" data-count>0 of ${list.length} files</div><progress max="100" value="0" data-progress></progress><button class="btn" type="button" data-done hidden>Done</button></div>`;
    const status = root.querySelector('[data-status]'), count = root.querySelector('[data-count]'), progress = root.querySelector('[data-progress]'), close = root.querySelector('[data-close]'), done = root.querySelector('[data-done]');
    const finish = () => { root.remove(); resolveResult(); };
    close.onclick = finish; done.onclick = finish; document.body.append(root);
    const run = async () => {
      try {
        for (let index = 0; index < list.length; index += 1) { await copy(list[index]); const current = index + 1; count.textContent = `${current} of ${list.length} files`; progress.value = list.length ? current / list.length * 100 : 100; status.textContent = current === list.length ? 'All files copied successfully.' : `Copying ${list[index].name || 'file'}…`; await delay(Math.min(26, 8 + list.length)); }
        if (!list.length) status.textContent = 'No files needed copying.';
        done.hidden = false; close.disabled = false; resolveResult();
      } catch (error) { status.textContent = `Copy stopped: ${error.message || 'unknown error'}`; close.disabled = false; done.hidden = false; progress.classList.add('error'); }
    };
    run(); return result;
  }

  async function readFilePayload(entries) {
    const payload = [];
    for (const entry of entries) { const blob = await window.IDKFiles?.readBlob?.(entry); if (blob) payload.push({ id: entry.id, name: entry.name, parent: entry.parent || '', mime: entry.mime || blob.type, size: blob.size, text: Boolean(entry.text), content: await toBase64(blob) }); }
    return payload;
  }

  function packageSnapshot() {
    const snapshot = window.IDKBatchTen?.snapshot?.(['settings', 'workspace', 'notes', 'tasks', 'calendar', 'browser', 'files']) || { categories: {} };
    return { ...snapshot, version: 2, fileTransfer: 'full' };
  }
  function conflictEntries(payload) { const current = files(); return payload.filter(incoming => current.some(local => local.type === 'file' && (local.id === incoming.id || (local.name === incoming.name && local.parent === incoming.parent)))); }
  function uniqueName(name, used) { if (!used.has(name)) return name; const dot = name.lastIndexOf('.'), stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : ''; let index = 2, candidate = `${stem} (${index})${ext}`; while (used.has(candidate)) { index += 1; candidate = `${stem} (${index})${ext}`; } return candidate; }

  function renderFullReview(root) {
    const panel = root.querySelector('[data-full-review]'), pending = root._idkFullPending;
    if (!pending) { panel.hidden = true; return; }
    const payload = Array.isArray(pending.filePayload) ? pending.filePayload : [], conflicts = conflictEntries(payload), categories = Object.keys(pending.categories || {}), fields = [...new Set(Object.values(pending.categories || {}).flatMap(value => Object.keys(value || {})))], fieldConflicts = fields.filter(key => localStorage.getItem(key) !== null);
    panel.hidden = false; panel.innerHTML = `<header><div><span class="idk-flow-kicker">FULL PACKAGE</span><h3>Review before replacing</h3></div><span class="count">${payload.length} files</span></header><p class="idk-flow-note">This package contains ${categories.length} saved data categories and ${payload.length} file contents. ${fieldConflicts.length ? `${fieldConflicts.length} saved field${fieldConflicts.length === 1 ? '' : 's'} already exist locally.` : 'No saved fields conflict locally.'} ${conflicts.length ? `${conflicts.length} local file${conflicts.length === 1 ? '' : 's'} will conflict.` : 'No local file names conflict.'}</p>${fieldConflicts.length ? `<div class="idk-flow-conflicts">${fieldConflicts.slice(0, 12).map(key => `<div><strong>${esc(key)}</strong><small>Saved data</small></div>`).join('')}${fieldConflicts.length > 12 ? `<small>+ ${fieldConflicts.length - 12} more saved-field conflicts</small>` : ''}</div>` : ''}${conflicts.length ? `<div class="idk-flow-conflicts">${conflicts.slice(0, 12).map(item => `<div><strong>${esc(item.name)}</strong><small>${esc(item.parent || 'IDK root')}</small></div>`).join('')}${conflicts.length > 12 ? `<small>+ ${conflicts.length - 12} more file conflicts</small>` : ''}</div>` : ''}<div class="idk-flow-actions"><button class="btn" data-full-merge>Merge package</button><button class="btn tab" data-full-replace>Replace conflicts</button><button class="btn tab" data-full-cancel>Cancel</button></div>`;
    panel.querySelector('[data-full-merge]').onclick = () => applyFullTransfer(root, 'merge'); panel.querySelector('[data-full-replace]').onclick = () => applyFullTransfer(root, 'replace'); panel.querySelector('[data-full-cancel]').onclick = () => { root._idkFullPending = null; renderFullReview(root); };
  }

  async function applyFullTransfer(root, mode) {
    const pending = root._idkFullPending, payload = Array.isArray(pending?.filePayload) ? pending.filePayload : [], status = root.querySelector('[data-status]'); if (!pending) return;
    const categories = Object.keys(pending.categories || {}).filter(category => category !== 'files'); if (categories.length) window.IDKBatchTen?.applyTransfer?.(pending, categories, mode);
    const incomingFiles = pending.categories?.files?.idkFileSystem; if (Array.isArray(incomingFiles)) { const currentFiles = files(); incomingFiles.filter(item => item?.type === 'folder').forEach(folder => { if (!currentFiles.some(item => item.type === 'folder' && ((item.id && item.id === folder.id) || (item.name === folder.name && item.parent === folder.parent)))) currentFiles.push({ ...folder, updated: folder.updated || Date.now() }); }); write('idkFileSystem', currentFiles); emit('files'); }
    const conflicts = conflictEntries(payload); if (mode === 'replace' && conflicts.length) await window.IDKFiles?.removeEntries?.(conflicts);
    const used = new Set(files().filter(item => item.type === 'file').map(item => `${item.parent || ''}/${item.name}`)); status.textContent = 'Copying full file contents…';
    await copyDialog(payload, 'Transfer package', 'This device', async entry => { const folder = files().some(item => item.type === 'folder' && item.id === entry.parent) ? entry.parent : ''; const folderNames = new Set([...used].filter(value => value.startsWith(`${folder}/`)).map(value => value.slice(folder.length + 1))); const name = mode === 'merge' ? uniqueName(entry.name, folderNames) : entry.name; await window.IDKFiles?.writeBlobFile?.(name, fromBase64(entry.content, entry.mime), folder, entry.mime, mode === 'replace' ? entry.id : ''); used.add(`${folder}/${name}`); });
    root._idkFullPending = null; renderFullReview(root); status.textContent = `${mode === 'merge' ? 'Merged' : 'Replaced'} package data and copied ${payload.length} file${payload.length === 1 ? '' : 's'}.`; notify('Transfer Center', 'Full transfer completed.', 'success'); emit('transfer');
  }

  async function exportFull(root) {
    const status = root.querySelector('[data-status]'), entries = files().filter(item => item.type === 'file'), payload = []; status.textContent = 'Reading file contents…';
    await copyDialog(entries, 'This device', 'Transfer package', async entry => { const item = await readFilePayload([entry]); if (item[0]) payload.push(item[0]); });
    downloadJSON(`idk-full-transfer-${new Date().toISOString().slice(0, 10)}.json`, { ...packageSnapshot(), filePayload: payload, fileCount: payload.length }); status.textContent = `Full transfer exported with ${payload.length} file${payload.length === 1 ? '' : 's'}.`; notify('Transfer Center', 'Full file transfer exported.', 'success');
  }

  function fullTransferApp() {
    const root = window.IDKBatchTen?.transfer?.() || document.createElement('div'); const heading = root.querySelector('.idk-flow-head p'); if (heading) heading.textContent = 'Move settings, browser workspaces, and full file contents between IDK devices. Review conflicts before replacing anything.';
    const actions = root.querySelector('.idk-flow-head-actions'), status = root.querySelector('[data-status]'); if (!actions || !status) return root;
    const copy = document.createElement('button'); copy.className = 'btn'; copy.type = 'button'; copy.textContent = 'Copy Files'; copy.onclick = () => exportFull(root); const label = document.createElement('label'); label.className = 'btn tab'; label.textContent = 'Import full package'; const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.hidden = true; label.append(input); actions.prepend(copy, label);
    const review = document.createElement('section'); review.className = 'idk-flow-card idk-flow-full-review'; review.dataset.fullReview = 'true'; review.hidden = true; root.append(review);
    input.onchange = async event => { const file = event.target.files?.[0]; if (!file) return; try { const value = JSON.parse(await file.text()); if (value.format !== 'idk-flow-transfer' || !value.categories) throw new Error('That file is not an IDK Flow transfer.'); root._idkFullPending = value; status.textContent = 'Full package preview ready. Choose how to resolve conflicts.'; renderFullReview(root); } catch (error) { status.textContent = error.message; } input.value = ''; };
    return root;
  }

  function browserWorkspaceApp() {
    const root = document.createElement('div'); root.className = 'app idk-browser-workspaces'; root.innerHTML = '<header class="idk-flow-head"><div><span class="idk-flow-kicker">IDK BROWSER</span><h2>Browser Workspaces</h2><p>Save tabs, history, bookmarks, and the current browser session under a name you can restore on another device.</p></div><div class="idk-flow-head-actions"><button class="btn" data-browser>Open Browser</button><button class="btn tab" data-handoff>Device Handoff</button></div></header><form class="idk-workspace-save"><input class="field" name="name" required maxlength="48" placeholder="Workspace name"><button class="btn" type="submit">Save current browser</button></form><div class="idk-workspace-list" data-list></div>';
    const list = root.querySelector('[data-list]'), form = root.querySelector('form');
    const render = () => { const items = array('idkBrowserWorkspaces'); list.replaceChildren(...(items.length ? items.map(item => { const card = document.createElement('article'); card.className = 'idk-workspace-card'; card.innerHTML = `<div><strong>${esc(item.name)}</strong><small>${item.session?.tabs?.length || 0} tabs · ${item.history?.length || 0} history · ${item.bookmarks?.length || 0} bookmarks · ${item.downloads?.length || 0} Downloads</small></div><div class="idk-flow-actions"><button class="btn" data-restore>Restore</button><button class="btn tab" data-delete>Delete</button></div>`; card.querySelector('[data-restore]').onclick = () => { write('idkBrowserSession', item.session); write('idkBrowserHistory', item.history || []); write('idkBrowserBookmarks', item.bookmarks || []); if (Array.isArray(item.downloads)) { const current = files(); item.downloads.forEach(download => { if (!current.some(value => value.id === download.id)) current.push(download); }); write('idkFileSystem', current); } emit('browser'); emit('files'); notify('Browser Workspaces', `${item.name} restored.`, 'success'); document.querySelector('#windows .window[data-app="proxy"]')?.querySelector('.close')?.click(); open('proxy'); }; card.querySelector('[data-delete]').onclick = () => { write('idkBrowserWorkspaces', items.filter(value => value.id !== item.id)); render(); }; return card; }) : [Object.assign(document.createElement('p'), { className: 'idk-flow-empty', textContent: 'No named browser workspaces yet.' })])); };
    form.onsubmit = event => { event.preventDefault(); const name = new FormData(form).get('name').toString().trim(); if (!name) return; const session = read('idkBrowserSession', null); if (!session?.tabs?.length) return notify('Browser Workspaces', 'Open at least one browser tab before saving.'); const items = array('idkBrowserWorkspaces'); items.unshift({ id: id('browser-workspace'), name, updatedAt: Date.now(), session: JSON.parse(JSON.stringify(session)), history: array('idkBrowserHistory'), bookmarks: array('idkBrowserBookmarks'), downloads: files().filter(item => item.type === 'file' && item.parent === 'downloads').map(item => ({ ...item })) }); write('idkBrowserWorkspaces', items.slice(0, 24)); form.reset(); render(); notify('Browser Workspaces', `${name} saved.`, 'success'); };
    root.querySelector('[data-browser]').onclick = () => open('proxy'); root.querySelector('[data-handoff]').onclick = () => open('handoff'); render(); return root;
  }

  function installHandoffLink() {
    if (typeof APPS === 'undefined' || !APPS.handoff || APPS.handoff._batchEleven) return;
    const previous = APPS.handoff.render; APPS.handoff.render = opts => { const root = previous(opts); const actions = root.querySelector('.idk-handoff-actions'); if (actions && !actions.querySelector('[data-browser-workspaces]')) { const button = document.createElement('button'); button.className = 'btn tab'; button.type = 'button'; button.dataset.browserWorkspaces = 'true'; button.textContent = 'Browser Workspaces'; button.onclick = () => open('browserWorkspaces'); actions.append(button); } return root; }; APPS.handoff._batchEleven = true;
  }

  function reminderToast(item) { const existing = document.querySelector('.idk-reminder-toast'); if (existing) existing.remove(); const root = document.createElement('section'); root.className = 'idk-reminder-toast'; root.innerHTML = `<div><span class="idk-flow-kicker">IDK TODAY</span><strong>${esc(item.title)}</strong><small>${esc(item.time || 'Reminder for today')}</small></div><div class="idk-flow-actions"><button class="btn" data-open>Open reminder</button><button class="btn tab" data-close>Dismiss</button></div>`; root.querySelector('[data-open]').onclick = () => { root.remove(); open('calendar'); }; root.querySelector('[data-close]').onclick = () => root.remove(); document.body.append(root); notify('Calendar reminder', item.title, 'info'); }
  function reminderTick() { const today = todayKey(), now = new Date(), events = array('idkCalendarEvents'); let changed = false; events.forEach(item => { if (item.reminded || !item.date || item.date > today) return; if (item.date === today && item.time) { const [hour, minute] = item.time.split(':').map(Number); if (hour > now.getHours() || (hour === now.getHours() && minute > now.getMinutes())) return; } item.reminded = true; changed = true; reminderToast(item); }); if (changed) { write('idkCalendarEvents', events); emit('calendar'); } }
  function installReminders() { reminderTick(); const timer = setInterval(reminderTick, 30000); window.addEventListener('idk-data-changed', reminderTick); window.addEventListener('beforeunload', () => { clearInterval(timer); window.removeEventListener('idk-data-changed', reminderTick); }, { once: true }); }

  function install() { injectStyle(); if (typeof APPS !== 'undefined') { APPS.transfer = { title: 'Transfer Center', glyph: '⇄', desktop: false, dock: false, width: 920, height: 720, render: fullTransferApp }; APPS.browserWorkspaces = { title: 'Browser Workspaces', glyph: '▣', desktop: false, dock: false, width: 820, height: 600, render: browserWorkspaceApp }; } installHandoffLink(); installReminders(); }
  window.IDKBatchEleven = { transfer: fullTransferApp, browserWorkspaces: browserWorkspaceApp, exportFull };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

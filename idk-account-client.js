(() => {
  'use strict';
  const ACCOUNT_KEY = 'idkAccountSession';
  const HYDRATED_KEY = 'idkAccountHydrated';
  const FILE_DB = 'idkFileBlobs';
  const FILE_STORE = 'files';
  const skipKeys = new Set([ACCOUNT_KEY]);
  let user = null, timer = null, saving = false, restored = false, saveQueued = false, fileFingerprints = new Map();

  const readLocal = () => { const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k || skipKeys.has(k)) continue; out[k] = localStorage.getItem(k); } return out; };
  const clearLocal = () => { const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && !skipKeys.has(k)) keys.push(k); } keys.forEach(k => { try { localStorage.removeItem(k); } catch {} }); };
  const restoreLocal = data => { if (!data || typeof data !== 'object') return; Object.entries(data).forEach(([k, v]) => { try { localStorage.setItem(k, String(v)); } catch {} }); };
  const readJSON = (key, fallback) => { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
  const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const get = async url => { const r = await fetch(url, { credentials: 'same-origin' }); return r.json(); };
  const post = async (url, body) => { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }); return r.json(); };
  const put = async (url, body) => { const r = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }); return r.json(); };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const openFileDB = () => new Promise((resolve, reject) => { if (!window.indexedDB) return reject(new Error('IndexedDB unavailable')); const r = indexedDB.open(FILE_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(FILE_STORE); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const loadFileBlob = async id => { const db = await openFileDB(); return new Promise((resolve, reject) => { const r = db.transaction(FILE_STORE, 'readonly').objectStore(FILE_STORE).get(id); r.onsuccess = () => resolve(r.result || null); r.onerror = () => reject(r.error); }); };
  const storeFileBlob = async (id, blob) => { const db = await openFileDB(); return new Promise((resolve, reject) => { const tx = db.transaction(FILE_STORE, 'readwrite'); tx.objectStore(FILE_STORE).put(blob, id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); };
  const deleteFileBlob = async id => { const db = await openFileDB(); return new Promise((resolve, reject) => { const tx = db.transaction(FILE_STORE, 'readwrite'); tx.objectStore(FILE_STORE).delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); };
  const arrayBufferToBase64 = buffer => { const bytes = new Uint8Array(buffer); let binary = ''; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk)); return btoa(binary); };

  function style() {
    if (document.getElementById('idk-account-style')) return;
    const s = document.createElement('style'); s.id = 'idk-account-style';
    s.textContent = `#idk-account-overlay{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;background:rgba(0,3,15,.68);backdrop-filter:blur(6px)}.idk-account-card{width:min(430px,calc(100% - 28px));padding:22px;border:1px solid rgba(89,134,218,.65);border-radius:10px;background:linear-gradient(145deg,rgba(19,45,95,.98),rgba(5,12,30,.98));color:#fff;box-shadow:0 25px 80px #0009}.idk-account-card h2{margin:0 0 5px}.idk-account-card p{color:#b6c7e4;font-size:11px}.idk-account-card label{display:block;margin:10px 0;color:#c9d6ed;font-size:11px}.idk-account-card input{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border-radius:5px;border:1px solid #5575a8;background:#07142d;color:#fff}.idk-account-row{display:flex;gap:7px;margin-top:14px}.idk-account-row button{flex:1;padding:9px;border-radius:5px;border:1px solid #638bd1;background:#245db4;color:#fff;cursor:pointer}.idk-account-secondary{background:transparent!important}.idk-account-error{min-height:16px;color:#ff9b9b;font-size:11px}.idk-account-profile{position:fixed;right:12px;top:12px;z-index:10040;display:flex;gap:7px;align-items:center;padding:6px 9px;border:1px solid rgba(255,255,255,.12);border-radius:7px;background:rgba(5,12,30,.62);color:#fff;font-size:11px}.idk-account-profile img{width:25px;height:25px;border-radius:50%;object-fit:cover}`;
    document.head.appendChild(s);
  }
  function modal() { style(); const o = document.createElement('div'); o.id = 'idk-account-overlay'; o.innerHTML = `<section class="idk-account-card"><h2 id="idk-account-title">Welcome to IDK 10.0</h2><p id="idk-account-copy">Create an IDK account so your desktop and personal data follow you across devices.</p><form id="idk-account-form"><label>Username<input id="idk-account-user" maxlength="32" autocomplete="username" required></label><label>Password<input id="idk-account-pass" type="password" minlength="6" autocomplete="current-password" required></label><label id="idk-account-avatar-label" hidden>Profile picture<input id="idk-account-avatar" value="profile-1.jpg"></label><div class="idk-account-error" id="idk-account-error"></div><div class="idk-account-row"><button type="submit" id="idk-account-submit">Sign in</button><button type="button" class="idk-account-secondary" id="idk-account-toggle">Create account</button></div></form></section>`; document.body.appendChild(o); return o; }
  function profile() { if (!user) return; style(); document.getElementById('idk-account-profile')?.remove(); const p = document.createElement('div'); p.id = 'idk-account-profile'; p.innerHTML = `<img src="${esc(user.avatar || 'profile-1.jpg')}" alt=""><span>${esc(user.username)}</span>`; document.body.appendChild(p); }

  function localPayload() {
    return {
      desktop: { localStorage: readLocal() },
      games: readJSON('idkInstalledPrograms', []),
      cards: readJSON('idkDesktopCards', []),
      sheets: readJSON('idkSheetsData', {}),
      messenger: { chatName: readJSON('chatName', ''), profile: readJSON('idkProfile', null) },
      featureState: readJSON('idkUltimateState', {})
    };
  }

  async function syncFiles() {
    if (!user) return;
    const entries = readJSON('idkFileSystem', []);
    const indexed = entries.filter(entry => entry?.storage === 'indexeddb');
    let remote = [];
    try { const list = await get('/api/account/files'); if (!list.ok) return; remote = Array.isArray(list.files) ? list.files : []; } catch { return; }
    const remoteIds = new Set(remote.map(file => file.id));
    for (const entry of indexed) {
      try {
        const blob = await loadFileBlob(entry.id); if (!blob) continue;
        const fingerprint = `${entry.id}:${entry.updated}:${entry.size}:${blob.size}`;
        if (fileFingerprints.get(entry.id) === fingerprint) continue;
        const contentBase64 = arrayBufferToBase64(await blob.arrayBuffer());
        const r = await post('/api/account/files', { id: entry.id, name: entry.name, mime: entry.mime || blob.type || 'application/octet-stream', contentBase64 });
        if (r.ok) { fileFingerprints.set(entry.id, fingerprint); remoteIds.delete(entry.id); }
      } catch {}
    }
    for (const remoteId of remoteIds) { try { await fetch(`/api/account/files/${encodeURIComponent(remoteId)}`, { method: 'DELETE', credentials: 'same-origin' }); } catch {} }
  }

  async function restoreFiles() {
    if (!user) return;
    try {
      const list = await get('/api/account/files'); if (!list.ok || !Array.isArray(list.files)) return;
      const entries = readJSON('idkFileSystem', []);
      const byId = new Map(entries.map(entry => [entry.id, entry]));
      for (const remote of list.files) {
        let entry = byId.get(remote.id);
        if (!entry) { entry = { id: remote.id, name: remote.name, type: 'file', parent: '', updated: remote.updated, size: Number(remote.size) || 0, mime: remote.mime || 'application/octet-stream', storage: 'indexeddb', text: /^text\//.test(remote.mime || '') }; entries.push(entry); byId.set(entry.id, entry); }
        else { entry.name = remote.name; entry.size = Number(remote.size) || entry.size; entry.mime = remote.mime || entry.mime; entry.storage = 'indexeddb'; entry.updated = remote.updated || entry.updated; }
        const response = await fetch(`/api/account/files/${encodeURIComponent(remote.id)}/content`, { credentials: 'same-origin' });
        if (response.ok) { const blob = await response.blob(); await storeFileBlob(remote.id, blob); fileFingerprints.set(remote.id, `${remote.id}:${remote.updated}:${remote.size}:${blob.size}`); }
      }
      writeJSON('idkFileSystem', entries);
    } catch {}
  }

  async function sync() {
    if (!user || !restored || saving) return false;
    saving = true;
    try { const r = await put('/api/account/state', localPayload()); await syncFiles(); return Boolean(r.ok); }
    catch { return false; }
    finally { saving = false; }
  }

  async function restore() {
    const r = await get('/api/account/state'); if (!r.ok) return false;
    const s = r.state || {}; clearLocal(); restoreLocal(s.desktop?.localStorage);
    if (Array.isArray(s.games)) localStorage.setItem('idkInstalledPrograms', JSON.stringify(s.games));
    if (s.cards) localStorage.setItem('idkDesktopCards', JSON.stringify(s.cards));
    if (s.sheets) localStorage.setItem('idkSheetsData', JSON.stringify(s.sheets));
    if (s.messenger?.chatName !== undefined) localStorage.setItem('chatName', JSON.stringify(s.messenger.chatName));
    if (s.messenger?.profile !== undefined) localStorage.setItem('idkProfile', JSON.stringify(s.messenger.profile));
    if (s.feature_state !== undefined) writeJSON('idkUltimateState', s.feature_state || {});
    restored = true;
    await restoreFiles();
    window.dispatchEvent(new CustomEvent('idk-account-restored', { detail: { user, state: s } }));
    return true;
  }

  function watchLocalStorage() {
    const originalSet = localStorage.setItem.bind(localStorage), originalRemove = localStorage.removeItem.bind(localStorage), originalClear = localStorage.clear.bind(localStorage);
    const queue = () => { if (!user || !restored || saveQueued) return; saveQueued = true; setTimeout(async () => { saveQueued = false; await sync(); }, 900); };
    try { localStorage.setItem = (key, value) => { originalSet(key, value); if (!skipKeys.has(String(key))) queue(); }; localStorage.removeItem = key => { originalRemove(key); if (!skipKeys.has(String(key))) queue(); }; localStorage.clear = () => { originalClear(); queue(); }; } catch {}
  }

  async function startUser(nextUser) {
    user = nextUser; restored = false; await restore(); await sync(); profile(); clearInterval(timer); timer = setInterval(sync, 5000); window.addEventListener('beforeunload', sync, { capture: true });
    if (!sessionStorage.getItem(HYDRATED_KEY)) { sessionStorage.setItem(HYDRATED_KEY, '1'); location.reload(); }
  }

  async function auth() {
    let st; try { st = await get('/api/account/status'); } catch { return false; }
    if (!st.configured) return true;
    if (st.authenticated) { await startUser(st.user); return true; }
    clearLocal(); sessionStorage.removeItem(HYDRATED_KEY); window.dispatchEvent(new CustomEvent('idk-account-signed-out'));
    const o = modal(), form = o.querySelector('#idk-account-form'), toggle = o.querySelector('#idk-account-toggle'), title = o.querySelector('#idk-account-title'), copy = o.querySelector('#idk-account-copy'), submit = o.querySelector('#idk-account-submit'), avatar = o.querySelector('#idk-account-avatar-label');
    let register = false;
    toggle.onclick = () => { register = !register; title.textContent = register ? 'Create your IDK account' : 'Welcome to IDK 10.0'; copy.textContent = register ? 'Your personal desktop will be saved securely to your account.' : 'Sign in to restore your personal desktop, games, Files and Messenger data.'; submit.textContent = register ? 'Create account' : 'Sign in'; toggle.textContent = register ? 'I already have an account' : 'Create account'; avatar.hidden = !register; form.querySelector('#idk-account-pass').autocomplete = register ? 'new-password' : 'current-password'; };
    form.onsubmit = async e => { e.preventDefault(); const err = o.querySelector('#idk-account-error'); err.textContent = ''; submit.disabled = true; const body = { username: o.querySelector('#idk-account-user').value.trim(), password: o.querySelector('#idk-account-pass').value, avatar: o.querySelector('#idk-account-avatar').value.trim() || 'profile-1.jpg' }; try { const r = await post(register ? '/api/account/register' : '/api/account/login', body); if (!r.ok) { err.textContent = r.error || 'Could not sign in.'; submit.disabled = false; return; } o.remove(); await startUser(r.user); } catch { err.textContent = 'Could not connect to the IDK account service.'; submit.disabled = false; } };
    return true;
  }

  function init() { watchLocalStorage(); auth(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  window.IDKAccount = { sync, restore, get user() { return user; } };
})();
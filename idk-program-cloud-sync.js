(() => {
  'use strict';

  const KEY = 'idkInstalledPrograms';
  const DB_NAME = 'idkInstalledProgramsDB';
  const STORE = 'programs';

  const read = () => {
    try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value.filter(Boolean) : []; }
    catch { return []; }
  };
  const write = value => { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {} };

  const openDb = () => new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Program storage unavailable'));
  });

  const loadBlob = async id => {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Program file unavailable'));
      });
    } finally { db.close(); }
  };

  const saveBlob = async (id, blob) => {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Program save failed'));
      });
    } finally { db.close(); }
  };

  const toBase64 = async blob => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };

  const request = async (url, options = {}) => {
    try {
      const response = await fetch(url, { credentials: 'same-origin', ...options });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, ...data };
    } catch { return { ok: false }; }
  };

  async function syncPrograms() {
    if (!window.IDKAccount?.user) return;
    const local = read();
    const result = await request('/api/account/programs');
    if (!result.ok || !Array.isArray(result.programs)) return;

    const merged = [...local];
    const localById = new Map(merged.map(program => [program.id, program]));
    const remoteById = new Map(result.programs.map(program => [program.id, program]));

    for (const program of local) {
      if (!program?.id || remoteById.has(program.id)) continue;
      try {
        const blob = await loadBlob(program.id);
        if (!blob) continue;
        const uploaded = await request('/api/account/programs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...program, contentBase64: await toBase64(blob) })
        });
        if (uploaded.ok && uploaded.program) remoteById.set(uploaded.program.id, uploaded.program);
      } catch {}
    }

    for (const program of remoteById.values()) {
      if (localById.has(program.id)) continue;
      try {
        const response = await fetch(`/api/account/programs/${encodeURIComponent(program.id)}/content`, { credentials: 'same-origin' });
        if (!response.ok) continue;
        await saveBlob(program.id, await response.blob());
        merged.push(program);
        localById.set(program.id, program);
      } catch {}
    }

    const mergedByName = new Map();
    for (const program of merged) if (program?.name) mergedByName.set(program.name, program);
    for (const program of remoteById.values()) if (program?.name && !mergedByName.has(program.name)) mergedByName.set(program.name, program);
    write([...mergedByName.values()]);
  }

  window.addEventListener('idk-account-restored', () => { syncPrograms().catch(() => {}); });
})();

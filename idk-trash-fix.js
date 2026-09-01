(() => {
  'use strict';

  const PROGRAMS_KEY = 'idkInstalledPrograms';
  const DB_NAME = 'idkInstalledProgramsDB';
  const STORE_NAME = 'programs';

  const readPrograms = () => { try { return JSON.parse(localStorage.getItem(PROGRAMS_KEY) || '[]'); } catch { return []; } };
  const savePrograms = list => { try { localStorage.setItem(PROGRAMS_KEY, JSON.stringify(list)); } catch {} };

  const removeProgramData = async id => {
    try {
      if (!window.indexedDB) return;
      const request = indexedDB.open(DB_NAME, 1);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) { db.close(); return; }
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      };
    } catch {}
  };

  const removeDesktopShortcuts = id => {
    document.querySelectorAll('#icons button').forEach(button => {
      if (button.dataset.installedProgram === id || button.dataset.installerProgram === id) button.remove();
    });
  };

  const deleteProgram = async id => {
    const programs = readPrograms();
    const program = programs.find(p => p && p.id === id);
    if (window.IDKAccount?.user) {
      try { await fetch(`/api/account/programs/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' }); } catch {}
    }
    savePrograms(programs.filter(p => p && p.id !== id));
    await removeProgramData(id);
    removeDesktopShortcuts(id);
    if (window.OS?.notify) window.OS.notify('Trash', program ? `${program.name} was removed from IDK 10.0.` : 'Program removed from IDK 10.0.');
  };

  document.addEventListener('click', async event => {
    const button = event.target.closest('.idk-trash-row button');
    if (!button) return;
    const row = button.closest('.idk-trash-row');
    if (!row) return;
    const name = row.querySelector('strong')?.textContent?.trim();
    const program = readPrograms().find(p => p && p.name === name);
    if (!program?.id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    await deleteProgram(program.id);
    row.remove();
    const list = row.parentElement;
    if (list && !list.querySelector('.idk-trash-row')) list.innerHTML = '<div class="idk-file-empty">Trash is empty.</div>';
  }, true);

  const cleanStaleShortcuts = () => {
    const valid = new Set(readPrograms().map(p => p?.id).filter(Boolean));
    document.querySelectorAll('#icons button[data-installed-program], #icons button[data-installer-program]').forEach(button => {
      const id = button.dataset.installedProgram || button.dataset.installerProgram;
      if (id && !valid.has(id)) button.remove();
    });
  };

  const init = () => { cleanStaleShortcuts(); setTimeout(cleanStaleShortcuts, 1000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();

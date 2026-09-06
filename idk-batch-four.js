(() => {
  'use strict';

  const WATCHED_KEYS = new Set([
    'idkFileSystem', 'idkRichNotes', 'idkNotes', 'idkTodos', 'idkCalendarEvents',
    'idkBrowserSession', 'idkBrowserBookmarks', 'idkBrowserHistory'
  ]);

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  function counts() {
    const files = read('idkFileSystem', []);
    const notes = read('idkRichNotes', read('idkNotesPair', []));
    const tasks = read('idkTodos', []);
    const events = read('idkCalendarEvents', []);
    const history = read('idkBrowserHistory', []);
    const bookmarks = read('idkBrowserBookmarks', []);
    return {
      files: Array.isArray(files) ? files.filter(item => item?.type === 'file').length : 0,
      folders: Array.isArray(files) ? files.filter(item => item?.type === 'folder').length : 0,
      notes: Array.isArray(notes) ? notes.filter(item => !item?.trashed).length : 0,
      tasks: Array.isArray(tasks) ? tasks.length : 0,
      activeTasks: Array.isArray(tasks) ? tasks.filter(item => !item?.done).length : 0,
      calendarEvents: Array.isArray(events) ? events.length : 0,
      browserHistory: Array.isArray(history) ? history.length : 0,
      browserBookmarks: Array.isArray(bookmarks) ? bookmarks.length : 0
    };
  }

  function emit(key, detail = {}) {
    if (!WATCHED_KEYS.has(String(key))) return;
    window.dispatchEvent(new CustomEvent('idk-data-changed', { detail: { key: String(key), ...detail } }));
  }

  function wrapStorage() {
    if (!window.localStorage || localStorage.setItem.__idkBatchFour) return;
    const originalSet = localStorage.setItem.bind(localStorage);
    const originalRemove = localStorage.removeItem.bind(localStorage);
    const set = (key, value) => { originalSet(key, value); emit(key, { operation: 'set' }); };
    const remove = key => { originalRemove(key); emit(key, { operation: 'remove' }); };
    set.__idkBatchFour = true;
    remove.__idkBatchFour = true;
    try {
      localStorage.setItem = set;
      localStorage.removeItem = remove;
    } catch {}
  }

  function install() {
    wrapStorage();
    const existing = window.IDKDataLayer || {};
    const baseHealth = existing.health;
    window.IDKDataLayer = {
      ...existing,
      counts,
      emit,
      health: async () => ({ ...(await baseHealth?.() || {}), apps: counts() })
    };
    window.addEventListener('idk-data-changed', event => {
      if (event.detail?.key) window.dispatchEvent(new CustomEvent('idk-sync-status', { detail: { state: 'local-change', key: event.detail.key, pending: false } }));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

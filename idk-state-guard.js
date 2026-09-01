(() => {
  'use strict';
  const KEY = 'idkUltimateState';
  const defaults = { wallpaper: '', theme: 'system', iconSize: 'normal', notes: '', apps: [], tasks: [], shortcuts: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) localStorage.setItem(KEY, JSON.stringify(defaults));
    else {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid state');
      localStorage.setItem(KEY, JSON.stringify({ ...defaults, ...value }));
    }
  } catch {
    try { localStorage.setItem(KEY, JSON.stringify(defaults)); } catch {}
  }
})();

(() => {
  'use strict';

  // Final desktop-only cleanup: remove every shortcut whose app id or label is Apps.
  // The Apps application itself remains available from Start/Search; only the desktop shortcut is removed.
  function removeAppsShortcut() {
    const root = document.querySelector('#icons');
    if (!root) return;
    [...root.querySelectorAll('.desktop-icon, [data-app-id], [data-app], [data-id]')].forEach(el => {
      if (!(el instanceof HTMLElement)) return;
      const id = String(el.dataset.appId || el.dataset.app || el.dataset.id || '').trim().toLowerCase();
      const label = String(el.querySelector('.label,.icon-label,.desktop-icon-label')?.textContent || el.textContent || '')
        .replace(/\s+/g, ' ').trim().toLowerCase();
      if (id === 'apps' || label === 'apps') el.remove();
    });
  }

  function boot() {
    removeAppsShortcut();
    const observer = new MutationObserver(removeAppsShortcut);
    observer.observe(document.body, { childList: true, subtree: true });
    [100, 300, 700, 1500, 3000].forEach(ms => setTimeout(removeAppsShortcut, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

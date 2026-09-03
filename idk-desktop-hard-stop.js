(() => {
  'use strict';

  const norm = value => String(value || '').trim().toLowerCase();

  function isAppsButton(button) {
    const id = norm(button.dataset.app || button.dataset.appId || button.dataset.id);
    const text = norm(button.textContent);
    const aria = norm(button.getAttribute('aria-label'));
    const title = norm(button.getAttribute('title'));
    return id === 'apps' || text === 'apps' || aria === 'apps' || title === 'apps' || /(^|\s)apps(\s|$)/.test(text);
  }

  function clean() {
    const icons = document.getElementById('icons');
    if (icons) {
      const seen = new Set();
      icons.querySelectorAll('.desktop-icon').forEach(icon => {
        const id = norm(icon.dataset.app || icon.dataset.appId || icon.dataset.id);
        const label = norm(icon.querySelector('.label')?.textContent || icon.textContent);
        const key = label || id;
        if (id === 'apps' || label === 'apps' || (key && seen.has(key))) {
          icon.remove();
          return;
        }
        if (key) seen.add(key);
        icon.draggable = false;
        icon.setAttribute('draggable', 'false');
        icon.style.webkitUserDrag = 'none';
        icon.style.userSelect = 'none';
        icon.style.touchAction = 'manipulation';
      });
    }

    const dock = document.getElementById('dock');
    if (dock) {
      dock.querySelectorAll('button').forEach(button => {
        if (isAppsButton(button)) button.remove();
      });
    }
  }

  // Stop legacy desktop-icon pointer handlers before they receive the event.
  document.addEventListener('pointerdown', event => {
    const icon = event.target.closest?.('#icons .desktop-icon');
    if (!icon) return;
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('pointermove', event => {
    const icon = event.target.closest?.('#icons .desktop-icon');
    if (!icon) return;
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('dragstart', event => {
    if (event.target.closest?.('#icons .desktop-icon')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  function start() {
    clean();
    const desktop = document.getElementById('desktop');
    if (desktop) {
      new MutationObserver(clean).observe(desktop, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

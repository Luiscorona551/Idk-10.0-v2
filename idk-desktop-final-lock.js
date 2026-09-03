(() => {
  'use strict';

  // Final desktop guard: icons launch only. This runs after the legacy desktop
  // scripts so their pointer listeners cannot remain attached to live icons.
  const normalize = value => String(value || '').trim().toLowerCase();

  const repair = () => {
    const layer = document.getElementById('icons');
    if (layer) {
      const seen = new Set();
      [...layer.querySelectorAll('.desktop-icon')].forEach(oldIcon => {
        const id = normalize(oldIcon.dataset.app || oldIcon.dataset.appId || oldIcon.dataset.id);
        const label = normalize(oldIcon.querySelector('.label')?.textContent || oldIcon.textContent);

        // The Apps launcher belongs to the Start/taskbar experience, not the desktop.
        if (id === 'apps' || label === 'apps') {
          oldIcon.remove();
          return;
        }

        // Keep one desktop shortcut per application. This removes the duplicate
        // Messenger shortcut visible in the current desktop while preserving the first.
        const key = id || label;
        if (key && seen.has(key)) {
          oldIcon.remove();
          return;
        }
        if (key) seen.add(key);

        // Clone the node so any pointermove/pointerup handlers installed by the
        // old draggable implementation are discarded.
        if (oldIcon.dataset.idkFinalStatic !== '1') {
          const icon = oldIcon.cloneNode(true);
          icon.dataset.idkFinalStatic = '1';
          icon.draggable = false;
          icon.style.userSelect = 'none';
          icon.style.webkitUserDrag = 'none';
          icon.style.touchAction = 'manipulation';
          icon.classList.remove('dragging');
          icon.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const appId = icon.dataset.app || icon.dataset.appId || icon.dataset.id;
            if (appId) window.OS?.launch?.(appId);
          });
          oldIcon.replaceWith(icon);
        }
      });
      layer.style.touchAction = 'pan-y';
    }

    // The screenshot's bottom-right Apps button is a dock button, not a desktop icon.
    const dock = document.getElementById('dock');
    if (dock) {
      [...dock.querySelectorAll('.dock-btn')].forEach(button => {
        const id = normalize(button.dataset.app || button.dataset.appId);
        const text = normalize(button.textContent);
        const aria = normalize(button.getAttribute('aria-label'));
        if (id === 'apps' || text === 'apps' || aria === 'apps' || /(^|\s)apps(\s|$)/.test(text)) {
          button.remove();
        }
      });
    }
  };

  const start = () => {
    repair();
    const observer = new MutationObserver(() => {
      if (!start.queued) {
        start.queued = true;
        requestAnimationFrame(() => {
          start.queued = false;
          repair();
        });
      }
    });
    const desktop = document.getElementById('desktop');
    if (desktop) observer.observe(desktop, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

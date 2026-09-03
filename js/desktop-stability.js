(() => {
  'use strict';

  // Single maintained desktop-icon guard. The legacy OS creates draggable
  // icons; this replaces each live icon once so its old pointer listeners are
  // discarded. Icons remain clickable and never become draggable.
  const normalize = value => String(value || '').trim().toLowerCase();

  function clean() {
    const layer = document.getElementById('icons');
    if (!layer) return;

    const seen = new Set();
    [...layer.querySelectorAll('.desktop-icon')].forEach(oldIcon => {
      const id = normalize(oldIcon.dataset.app || oldIcon.dataset.appId || oldIcon.dataset.id);
      const label = normalize(oldIcon.querySelector('.label')?.textContent || oldIcon.textContent);

      if (id === 'apps' || label === 'apps') {
        oldIcon.remove();
        return;
      }

      const key = id || label;
      if (key && seen.has(key)) {
        oldIcon.remove();
        return;
      }
      if (key) seen.add(key);

      if (oldIcon.dataset.idkStableIcon === '1') {
        oldIcon.draggable = false;
        oldIcon.setAttribute('draggable', 'false');
        return;
      }

      const icon = oldIcon.cloneNode(true);
      icon.dataset.idkStableIcon = '1';
      icon.draggable = false;
      icon.setAttribute('draggable', 'false');
      icon.style.userSelect = 'none';
      icon.style.webkitUserDrag = 'none';
      icon.style.touchAction = 'manipulation';
      icon.classList.remove('dragging');
      icon.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const appId = icon.dataset.app || icon.dataset.appId || icon.dataset.id;
        if (appId) window.OS?.open?.(appId);
      });
      oldIcon.replaceWith(icon);
      if (id === 'tv') window.TV?.mount?.(icon);
    });

    layer.style.touchAction = 'pan-y';
    layer.style.overflowY = 'auto';
    layer.style.overflowX = 'hidden';
  }

  function start() {
    clean();
    const layer = document.getElementById('icons');
    if (!layer) return;
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        clean();
      });
    }).observe(layer, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

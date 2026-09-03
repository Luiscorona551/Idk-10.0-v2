(() => {
  'use strict';

  // Desktop icons are launch-only. Replacing the original nodes removes the
  // pointer listeners installed by the legacy draggable-icon code while
  // preserving the existing icon markup and normal app launching.
  const install = () => {
    const layer = document.getElementById('icons');
    if (!layer) return;

    [...layer.querySelectorAll('.desktop-icon')].forEach(oldIcon => {
      if (oldIcon.dataset.idkStaticIcon === '1') return;

      const id = String(oldIcon.dataset.app || oldIcon.dataset.appId || '').trim();
      if (!id) return;

      const icon = oldIcon.cloneNode(true);
      icon.dataset.idkStaticIcon = '1';
      icon.draggable = false;
      icon.style.userSelect = 'none';
      icon.style.webkitUserDrag = 'none';
      icon.style.touchAction = 'manipulation';
      icon.classList.remove('dragging');

      icon.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        window.OS?.launch?.(id);
      });

      oldIcon.replaceWith(icon);

      if (id === 'tv') window.TV?.mount?.(icon);
    });
  };

  const start = () => {
    install();
    const layer = document.getElementById('icons');
    if (layer) {
      new MutationObserver(() => install()).observe(layer, {
        childList: true,
        subtree: true
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

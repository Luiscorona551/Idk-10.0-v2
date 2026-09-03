(() => {
  'use strict';

  // One lightweight desktop guard. It disables the legacy drag gesture on
  // desktop application icons without blocking their normal click activation.
  function clean() {
    const layer = document.getElementById('icons');
    if (!layer) return;

    layer.style.touchAction = 'pan-y';
    layer.querySelectorAll('.desktop-icon').forEach(icon => {
      icon.draggable = false;
      icon.setAttribute('draggable', 'false');
      icon.style.userSelect = 'none';
      icon.style.webkitUserDrag = 'none';
      icon.style.touchAction = 'manipulation';
      icon.classList.remove('dragging');
    });

    [...layer.children].forEach(icon => {
      if (!(icon instanceof HTMLElement)) return;
      const id = String(icon.dataset.app || icon.dataset.appId || '').trim().toLowerCase();
      const label = String(icon.querySelector('.label')?.textContent || '').trim().toLowerCase();
      if (id === 'apps' || label === 'apps') icon.remove();
    });
  }

  // Prevent only the legacy pointerdown handler attached directly to desktop
  // icons. We intentionally do not call preventDefault(), so the browser still
  // generates a normal click for launching the application.
  document.addEventListener('pointerdown', event => {
    const icon = event.target.closest?.('#icons .desktop-icon');
    if (!icon) return;
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('dragstart', event => {
    if (event.target.closest?.('#icons .desktop-icon')) event.preventDefault();
  }, true);

  function boot() {
    clean();
    const layer = document.getElementById('icons');
    if (layer) new MutationObserver(() => clean()).observe(layer, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

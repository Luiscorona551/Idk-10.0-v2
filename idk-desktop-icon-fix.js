(() => {
  'use strict';
  const apply = () => {
    const root = document.querySelector('#icons');
    if (!root) return;
    root.style.overflow = 'auto';
    root.style.overflowX = 'hidden';
    root.style.overflowY = 'auto';
    root.style.touchAction = 'pan-y';
    root.querySelectorAll('.desktop-icon').forEach(icon => {
      icon.draggable = false;
      icon.style.userSelect = 'none';
      icon.style.touchAction = 'manipulation';
      const id = String(icon.dataset.app || icon.dataset.appId || '').toLowerCase();
      const label = String(icon.querySelector('.label')?.textContent || icon.textContent || '').trim().toLowerCase();
      if (id === 'apps' || label === 'apps') icon.remove();
    });
  };
  const start = () => {
    apply();
    new MutationObserver(apply).observe(document.querySelector('#icons') || document.body, { childList:true, subtree:true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
(() => {
  'use strict';
  // Final release guard: keep desktop icons fixed in the grid, keep the desktop
  // scrollable, remove the unwanted Apps shortcut, and make Messenger reliable.
  const ROOT = '#icons';
  let timer = 0;

  const text = el => String(el?.textContent || el?.getAttribute?.('aria-label') || el?.title || '')
    .replace(/\s+/g, ' ').trim().toLowerCase();

  const isApps = el => {
    const id = String(el?.dataset?.appId || el?.dataset?.app || el?.dataset?.id || '').trim().toLowerCase();
    return id === 'apps' || text(el) === 'apps';
  };

  const isMessenger = el => el && (
    el.matches?.('[data-live-messenger]') ||
    /idk messenger/.test(text(el))
  );

  function repair() {
    const root = document.querySelector(ROOT);
    if (!root) return;

    root.style.setProperty('overflow-y', 'auto', 'important');
    root.style.setProperty('overflow-x', 'hidden', 'important');
    root.style.setProperty('touch-action', 'pan-y', 'important');

    [...root.children].forEach(el => {
      if (!(el instanceof HTMLElement)) return;
      if (isApps(el)) el.remove();
      if (isMessenger(el)) {
        el.draggable = false;
        el.style.setProperty('user-select', 'none', 'important');
        el.style.setProperty('touch-action', 'manipulation', 'important');
        el.setAttribute('aria-label', 'Open Idk Messenger');
      }
    });
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = 0; repair(); }, 80);
  }

  function messengerClick(event) {
    const target = event.target.closest?.('[data-live-messenger], .idk-final-desktop-icon');
    if (!target || !/idk messenger/i.test(text(target))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.IdkMessenger?.open?.();
  }

  function blockDesktopIconDrag(event) {
    const target = event.target.closest?.('#icons .desktop-icon');
    if (!target) return;
    // OS.js has a legacy pointerdown drag handler. Stop only that pointerdown;
    // normal click activation remains available.
    event.stopImmediatePropagation();
  }

  function boot() {
    repair();
    document.addEventListener('click', messengerClick, true);
    document.addEventListener('pointerdown', blockDesktopIconDrag, true);
    const root = document.querySelector(ROOT);
    if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    [250, 800, 1600, 3000].forEach(ms => setTimeout(repair, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

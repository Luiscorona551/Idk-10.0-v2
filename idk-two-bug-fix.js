(() => {
  'use strict';

  const ROOT = '#icons';
  const X_STEP = 112;
  const Y_STEP = 118;
  const START_X = 16;
  const START_Y = 88;
  let timer = 0;

  function labelOf(el) {
    return (el.querySelector('.label,.icon-label,.desktop-icon-label')?.textContent || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function icons(root) {
    return [...root.children].filter(el => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.id === 'idk-icon-scroll-spacer') return false;
      return el.classList.contains('desktop-icon') || el.dataset.app || el.dataset.appId || el.dataset.id || el.querySelector('.glyph');
    });
  }

  function place(el, col, row) {
    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('left', `${START_X + col * X_STEP}px`, 'important');
    el.style.setProperty('top', `${START_Y + row * Y_STEP}px`, 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('transform', 'none', 'important');
  }

  function fix() {
    const root = document.querySelector(ROOT);
    if (!root) return;

    for (const el of icons(root)) {
      const id = String(el.dataset.appId || el.dataset.app || el.dataset.id || '').trim().toLowerCase();
      const label = labelOf(el);
      if (id === 'apps' || label === 'apps') el.remove();
    }

    const remaining = icons(root);
    const messenger = remaining.find(el => {
      const id = String(el.dataset.appId || el.dataset.app || el.dataset.id || '').trim().toLowerCase();
      const label = labelOf(el);
      return id === 'chat' || id === 'messenger' || label === 'idk messenger' || label === 'messenger';
    });
    const calendar = remaining.find(el => {
      const id = String(el.dataset.appId || el.dataset.app || el.dataset.id || '').trim().toLowerCase();
      const label = labelOf(el);
      return id === 'calendar' || label === 'calendar';
    });

    // Keep Messenger and Calendar in separate desktop slots.
    if (messenger) place(messenger, 0, 1);
    if (calendar) place(calendar, 1, 1);
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = 0; fix(); }, 50);
  }

  function boot() {
    fix();
    const root = document.querySelector(ROOT);
    if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    [100, 400, 900, 1800, 3500].forEach(ms => setTimeout(fix, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

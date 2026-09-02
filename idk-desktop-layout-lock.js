(() => {
  'use strict';
  const ROOT = '#icons';
  const VERSION_KEY = 'idkDesktopLayoutVersion';
  const VERSION = '6-final-grid';
  const COLS = 2;
  const COL_W = 124;
  const ROW_H = 126;
  const START_X = 18;
  const START_Y = 112;
  let applying = false;
  let observer = null;
  let scheduled = false;

  const isIcon = el => el instanceof HTMLElement && (
    el.classList.contains('desktop-icon') || el.dataset.appId || el.dataset.app || el.dataset.id
  );
  const labelOf = el => (el.querySelector('.label,.icon-label,.desktop-icon-label')?.textContent || el.textContent || '').trim();
  const keyOf = el => String(el.dataset.appId || el.dataset.app || el.dataset.id || labelOf(el)).trim().toLowerCase();

  function getRoot() { return document.querySelector(ROOT); }

  function removeDuplicateApps(root) {
    [...root.children].filter(isIcon).forEach(el => {
      const key = keyOf(el);
      if (key === 'apps' || labelOf(el).toLowerCase() === 'apps') el.remove();
    });
  }

  function arrange() {
    if (applying) return;
    const root = getRoot();
    if (!root) return;
    applying = true;
    removeDuplicateApps(root);
    const list = [...root.children].filter(isIcon);

    root.style.setProperty('position', 'absolute', 'important');
    root.style.setProperty('left', '0', 'important');
    root.style.setProperty('top', '0', 'important');
    root.style.setProperty('width', '310px', 'important');
    root.style.setProperty('height', 'calc(100% - 120px)', 'important');
    root.style.setProperty('overflow', 'visible', 'important');

    list.forEach((el, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = START_X + col * COL_W;
      const y = START_Y + row * ROW_H;
      el.style.setProperty('position', 'absolute', 'important');
      el.style.setProperty('left', `${x}px`, 'important');
      el.style.setProperty('top', `${y}px`, 'important');
      el.style.setProperty('right', 'auto', 'important');
      el.style.setProperty('bottom', 'auto', 'important');
      el.style.setProperty('transform', 'none', 'important');
      el.style.setProperty('width', '104px', 'important');
      el.style.setProperty('height', '112px', 'important');
      el.style.setProperty('min-width', '104px', 'important');
      el.style.setProperty('min-height', '112px', 'important');
      el.style.setProperty('margin', '0', 'important');
      el.style.setProperty('padding', '3px 2px', 'important');
      el.style.setProperty('box-sizing', 'border-box', 'important');
      el.style.setProperty('display', 'flex', 'important');
      el.style.setProperty('flex-direction', 'column', 'important');
      el.style.setProperty('align-items', 'center', 'important');
      el.style.setProperty('justify-content', 'flex-start', 'important');
      el.style.setProperty('overflow', 'visible', 'important');

      const glyph = el.querySelector('.glyph');
      if (glyph) {
        glyph.style.setProperty('width', '48px', 'important');
        glyph.style.setProperty('height', '48px', 'important');
        glyph.style.setProperty('flex', '0 0 48px', 'important');
        glyph.style.setProperty('margin', '0 0 6px', 'important');
      }
      const label = el.querySelector('.label,.icon-label,.desktop-icon-label');
      if (label) {
        label.style.setProperty('width', '104px', 'important');
        label.style.setProperty('max-width', '104px', 'important');
        label.style.setProperty('min-height', '38px', 'important');
        label.style.setProperty('margin', '0', 'important');
        label.style.setProperty('text-align', 'center', 'important');
        label.style.setProperty('white-space', 'normal', 'important');
        label.style.setProperty('line-height', '1.15', 'important');
        label.style.setProperty('overflow', 'visible', 'important');
        label.style.setProperty('word-break', 'normal', 'important');
      }
    });

    localStorage.setItem(VERSION_KEY, VERSION);
    applying = false;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      arrange();
    });
  }

  function boot() {
    arrange();
    const root = getRoot();
    if (root && !observer) {
      observer = new MutationObserver(mutations => {
        if (applying) return;
        if (mutations.some(m => m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length))) schedule();
      });
      observer.observe(root, { childList: true });
    }
    setTimeout(arrange, 300);
    setTimeout(arrange, 1000);
    setTimeout(arrange, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

(() => {
  'use strict';

  // Keep desktop apps anchored to the side. Icons fill downward first;
  // when there is no more vertical room, they continue in the next column.
  const ROOT = '#icons';
  const VERSION_KEY = 'idkDesktopLayoutVersion';
  const VERSION = '12-side-column-wrap';
  const COL_W = 108;
  const ROW_H = 122;
  const START_X = 8;
  const START_Y = 156;
  const SPECIAL = ['messenger', 'idk messenger', 'sheets', 'idk sheets', 'program installer'];
  let applying = false;
  let timer = 0;

  function getRoot() { return document.querySelector(ROOT); }

  function textOf(el) {
    return (el.querySelector('.label,.icon-label,.desktop-icon-label')?.textContent || el.textContent || '').trim();
  }

  function keyOf(el) {
    return String(el.dataset.appId || el.dataset.app || el.dataset.id || textOf(el)).trim().toLowerCase();
  }

  function isDesktopIcon(el) {
    return el instanceof HTMLElement && (
      el.classList.contains('desktop-icon') || el.dataset.appId || el.dataset.app || el.dataset.id
    );
  }

  function isAppsShortcut(el) {
    return keyOf(el) === 'apps' || textOf(el).toLowerCase() === 'apps';
  }

  function isSpecial(el) {
    const key = keyOf(el);
    const text = textOf(el).toLowerCase();
    return SPECIAL.includes(key) || SPECIAL.includes(text);
  }

  function removeAppsShortcuts(r) {
    [...r.children].filter(isDesktopIcon).forEach(el => {
      if (isAppsShortcut(el)) el.remove();
    });
  }

  function removeDuplicateMessengers(r) {
    const all = [...r.children].filter(isDesktopIcon);
    const messengers = all.filter(el => {
      const key = keyOf(el);
      const text = textOf(el).toLowerCase();
      return key === 'chat' || key === 'messenger' || key === 'idk messenger' || text === 'messenger' || text === 'idk messenger';
    });
    if (messengers.length <= 1) return;

    const keeper = messengers.find(el => el.hasAttribute('data-live-messenger')) || messengers[messengers.length - 1];
    messengers.forEach(el => { if (el !== keeper) el.remove(); });
  }

  function arrange() {
    if (applying) return;
    const r = getRoot();
    if (!r) return;

    applying = true;
    removeAppsShortcuts(r);
    removeDuplicateMessengers(r);

    const all = [...r.children].filter(isDesktopIcon);
    const specials = all.filter(isSpecial);
    const regular = all.filter(el => !isSpecial(el));

    // Leave a safe gap below the clock. Fill the available vertical space
    // before creating another column, so icons stay against the side.
    const availableHeight = Math.max(window.innerHeight - START_Y - 118, ROW_H);
    const rowsPerColumn = Math.max(1, Math.floor(availableHeight / ROW_H));
    const mobile = window.innerWidth < 700;
    const usableRows = mobile ? Math.max(1, Math.min(rowsPerColumn, 4)) : rowsPerColumn;

    const specialRows = Math.max(1, Math.min(usableRows, Math.ceil(specials.length / Math.max(1, Math.floor((window.innerWidth - START_X) / COL_W)))));
    const specialCols = Math.max(1, Math.ceil(specials.length / specialRows));
    const regularStartRow = Math.min(usableRows, specialRows);
    const regularRows = Math.max(1, usableRows - regularStartRow);

    // Specials occupy the first side columns. Regular apps continue below
    // them and automatically wrap into the next column when the column fills.
    specials.forEach((el, i) => {
      const col = Math.floor(i / usableRows);
      const row = i % usableRows;
      positionIcon(el, col, row);
    });

    regular.forEach((el, i) => {
      const rowOffset = regularStartRow;
      const row = rowOffset + (i % Math.max(1, regularRows));
      const col = Math.floor(i / Math.max(1, regularRows));
      positionIcon(el, col, row);
    });

    const maxCol = Math.max(
      0,
      ...all.map(el => Math.round((parseFloat(el.style.left) - START_X) / COL_W))
    );
    const maxRow = Math.max(
      0,
      ...all.map(el => Math.round((parseFloat(el.style.top) - START_Y) / ROW_H))
    );
    const contentWidth = Math.max(window.innerWidth, START_X + (maxCol + 1) * COL_W + 24);
    const contentHeight = Math.max(window.innerHeight - 112, START_Y + (maxRow + 1) * ROW_H + 32);
    const viewportHeight = Math.max(window.innerHeight - 112, 300);

    r.style.setProperty('position', 'absolute', 'important');
    r.style.setProperty('left', '0', 'important');
    r.style.setProperty('top', '0', 'important');
    r.style.setProperty('width', '100%', 'important');
    r.style.setProperty('height', `${viewportHeight}px`, 'important');
    r.style.setProperty('max-width', '100%', 'important');
    r.style.setProperty('max-height', `${viewportHeight}px`, 'important');
    r.style.setProperty('overflow-x', 'auto', 'important');
    r.style.setProperty('overflow-y', 'auto', 'important');
    r.style.setProperty('touch-action', 'pan-x pan-y', 'important');
    r.style.setProperty('box-sizing', 'border-box', 'important');
    r.style.setProperty('padding-bottom', '24px', 'important');
    r.style.setProperty('scrollbar-width', 'thin', 'important');

    let spacer = r.querySelector('#idk-icon-scroll-spacer');
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.id = 'idk-icon-scroll-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      r.appendChild(spacer);
    }
    spacer.style.setProperty('position', 'absolute', 'important');
    spacer.style.setProperty('left', '0', 'important');
    spacer.style.setProperty('top', '0', 'important');
    spacer.style.setProperty('width', `${contentWidth}px`, 'important');
    spacer.style.setProperty('height', `${contentHeight}px`, 'important');
    spacer.style.setProperty('pointer-events', 'none', 'important');

    try {
      localStorage.setItem(VERSION_KEY, VERSION);
      localStorage.removeItem('idkDesktopIconPositions');
    } catch {}

    applying = false;
  }

  function positionIcon(el, col, row) {
    const x = START_X + col * COL_W;
    const y = START_Y + row * ROW_H;

    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('left', `${x}px`, 'important');
    el.style.setProperty('top', `${y}px`, 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('width', '100px', 'important');
    el.style.setProperty('height', '106px', 'important');
    el.style.setProperty('min-width', '100px', 'important');
    el.style.setProperty('min-height', '106px', 'important');
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
      label.style.setProperty('width', '100px', 'important');
      label.style.setProperty('max-width', '100px', 'important');
      label.style.setProperty('min-height', '34px', 'important');
      label.style.setProperty('margin', '0', 'important');
      label.style.setProperty('text-align', 'center', 'important');
      label.style.setProperty('white-space', 'normal', 'important');
      label.style.setProperty('line-height', '1.15', 'important');
      label.style.setProperty('overflow', 'visible', 'important');
      label.style.setProperty('word-break', 'normal', 'important');
    }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      arrange();
    }, 100);
  }

  function boot() {
    arrange();
    const r = getRoot();
    if (r) {
      new MutationObserver(mutations => {
        if (!applying && mutations.some(m => m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length))) schedule();
      }).observe(r, { childList: true });
    }
    window.addEventListener('resize', schedule, { passive: true });
    [300, 800, 1500, 3000].forEach(ms => setTimeout(arrange, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

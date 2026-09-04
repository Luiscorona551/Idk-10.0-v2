(() => {
  'use strict';
  const ROOT = '#icons';
  const VERSION_KEY = 'idkDesktopLayoutVersion';
  const VERSION = '10-two-by-two-scrollable';
  const DEFAULT_COL_W = 112;
  const DEFAULT_ROW_H = 116;
  const ROWS = 2;
  const VISIBLE_COLUMNS = 2;
  const START_X = 12;
  const START_Y = 146;
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
    if (!(el instanceof HTMLElement) || el.classList.contains('idk-program-installer-icon')) return false;
    return (
      el.classList.contains('desktop-icon') ||
      el.classList.contains('idk-installed-shortcut') ||
      el.classList.contains('idk-final-desktop-icon') ||
      el.dataset.appId || el.dataset.app || el.dataset.id
    );
  }
  function layoutConfig() {
    try {
      return localStorage.getItem('idkGridDensity') === 'compact'
        ? { colW: 98, rowH: 108, iconW: 90 }
        : localStorage.getItem('idkGridDensity') === 'spacious'
          ? { colW: 124, rowH: 126, iconW: 112 }
          : { colW: DEFAULT_COL_W, rowH: DEFAULT_ROW_H, iconW: 104 };
    } catch { return { colW: DEFAULT_COL_W, rowH: DEFAULT_ROW_H, iconW: 104 }; }
  }
  function isAppsShortcut(el) {
    return keyOf(el) === 'apps' || textOf(el).toLowerCase() === 'apps';
  }

  function removeAppsShortcuts(root) {
    [...root.children].filter(isDesktopIcon).forEach(el => {
      if (isAppsShortcut(el)) el.remove();
    });
  }

  function arrange() {
    if (applying) return;
    const root = getRoot();
    if (!root) return;
    applying = true;
    removeAppsShortcuts(root);

    const config = layoutConfig();
    const favorites = (() => { try { return JSON.parse(localStorage.getItem('idkDesktopFavorites') || '[]'); } catch { return []; } })();
    const recent = (() => { try { return JSON.parse(localStorage.getItem('recentApps') || '[]'); } catch { return []; } })();
    const order = (() => { try { return JSON.parse(localStorage.getItem('desktopOrder') || '[]'); } catch { return []; } })();
    const score = key => favorites.includes(key) ? order.indexOf(key) >= 0 ? order.indexOf(key) / 1000 : 0 : recent.indexOf(key) >= 0 ? 10 + recent.indexOf(key) : order.indexOf(key) >= 0 ? 50 + order.indexOf(key) : 100;
    const icons = [...root.children].filter(isDesktopIcon).sort((a, b) => score(keyOf(a)) - score(keyOf(b)));
    const columns = Math.max(1, Math.ceil(icons.length / ROWS));
    const viewportHeight = Math.min(
      Math.max(START_Y + ROWS * config.rowH + 24, 300),
      Math.max(window.innerHeight - 120, 300)
    );
    const contentWidth = START_X + columns * config.colW + 18;
    const viewportWidth = START_X + VISIBLE_COLUMNS * config.colW + 18;

    root.style.setProperty('position', 'absolute', 'important');
    root.style.setProperty('left', '0', 'important');
    root.style.setProperty('top', '0', 'important');
    root.style.setProperty('width', `${viewportWidth}px`, 'important');
    root.style.setProperty('height', `${viewportHeight}px`, 'important');
    root.style.setProperty('max-height', `${viewportHeight}px`, 'important');
    root.style.setProperty('overflow-x', 'auto', 'important');
    root.style.setProperty('overflow-y', 'hidden', 'important');
    root.style.setProperty('box-sizing', 'border-box', 'important');
    root.style.setProperty('padding-bottom', '24px', 'important');

    let spacer = root.querySelector('#idk-icon-scroll-spacer');
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.id = 'idk-icon-scroll-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      root.appendChild(spacer);
    }
    spacer.style.setProperty('position', 'absolute', 'important');
    spacer.style.setProperty('left', `${contentWidth - 2}px`, 'important');
    spacer.style.setProperty('top', '0', 'important');
    spacer.style.setProperty('width', '1px', 'important');
    spacer.style.setProperty('height', '2px', 'important');
    spacer.style.setProperty('pointer-events', 'none', 'important');

    icons.forEach((icon, index) => positionIcon(icon, Math.floor(index / ROWS), index % ROWS, config));

    try {
      localStorage.setItem(VERSION_KEY, VERSION);
      localStorage.removeItem('idkDesktopIconPositions');
    } catch {}
    applying = false;
  }

  function positionIcon(icon, column, row, config) {
    const x = START_X + column * config.colW;
    const y = START_Y + row * config.rowH;
    icon.style.setProperty('position', 'absolute', 'important');
    icon.style.setProperty('left', `${x}px`, 'important');
    icon.style.setProperty('top', `${y}px`, 'important');
    icon.style.setProperty('right', 'auto', 'important');
    icon.style.setProperty('bottom', 'auto', 'important');
    icon.style.setProperty('transform', 'none', 'important');
    icon.style.setProperty('width', `${config.iconW}px`, 'important');
    icon.style.setProperty('height', `${config.rowH - 4}px`, 'important');
    icon.style.setProperty('min-width', `${config.iconW}px`, 'important');
    icon.style.setProperty('min-height', `${config.rowH - 4}px`, 'important');
    icon.style.setProperty('margin', '0', 'important');
    icon.style.setProperty('padding', '3px 2px', 'important');
    icon.style.setProperty('box-sizing', 'border-box', 'important');
    icon.style.setProperty('display', 'flex', 'important');
    icon.style.setProperty('flex-direction', 'column', 'important');
    icon.style.setProperty('align-items', 'center', 'important');
    icon.style.setProperty('justify-content', 'flex-start', 'important');
    icon.style.setProperty('overflow', 'visible', 'important');
    icon.style.setProperty('scroll-snap-align', 'start', 'important');

    const glyph = icon.querySelector('.glyph,.idk-installed-shortcut-icon,:scope > span:first-child');
    if (glyph) {
      glyph.style.setProperty('width', '48px', 'important');
      glyph.style.setProperty('height', '48px', 'important');
      glyph.style.setProperty('flex', '0 0 48px', 'important');
      glyph.style.setProperty('margin', '0 0 6px', 'important');
    }
    const label = icon.querySelector('.label,.icon-label,.desktop-icon-label,:scope > label') || icon.querySelector(':scope > span:last-child');
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
    timer = setTimeout(() => { timer = 0; arrange(); }, 100);
  }

  function boot() {
    arrange();
    const root = getRoot();
    if (root) new MutationObserver(mutations => {
      if (!applying && mutations.some(m => m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length))) schedule();
    }).observe(root, { childList: true });
    window.addEventListener('resize', schedule, { passive: true });
    [300, 800, 1500, 3000].forEach(ms => setTimeout(arrange, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

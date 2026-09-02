(() => {
  'use strict';

  const POS_KEY = 'idkDesktopIconPositions';
  const VERSION_KEY = 'idkDesktopLayoutVersion';
  const VERSION = '4-original-two-column';

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function getRoot() { return document.querySelector('#icons'); }

  function getIcons(root) {
    return [...root.children].filter(el => el instanceof HTMLElement && (
      el.classList.contains('desktop-icon') || el.dataset.appId || el.dataset.app || el.dataset.id
    ));
  }

  function keyFor(el, index) {
    return el.dataset.appId || el.dataset.app || el.dataset.id ||
      el.getAttribute('aria-label') || el.title || `desktop-icon-${index}`;
  }

  function isAppsShortcut(el) {
    const id = String(el.dataset.appId || el.dataset.app || el.dataset.id || '').toLowerCase();
    const title = String(el.getAttribute('title') || '').trim().toLowerCase();
    const label = String(el.querySelector('.label')?.textContent || el.textContent || '').trim().toLowerCase();
    return id === 'apps' || title === 'apps' || label === 'apps';
  }

  function removeDuplicateAppsShortcut(root) {
    getIcons(root).filter(isAppsShortcut).forEach(el => el.remove());
  }

  function applyGrid() {
    const root = getRoot();
    if (!root) return false;
    removeDuplicateAppsShortcut(root);

    const icons = getIcons(root);
    if (!icons.length) return false;

    root.style.position = 'relative';
    root.style.overflow = 'visible';

    // Match the original IDK desktop: two clean columns, then the next row.
    const columns = 2;
    const cellW = 122;
    const cellH = 112;
    const left = 22;
    const top = 176;
    const positions = {};

    icons.forEach((el, index) => {
      const key = keyFor(el, index);
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = left + col * cellW;
      const y = top + row * cellH;
      positions[key] = { left: x, top: y };

      el.style.position = 'absolute';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.transform = 'none';
      el.style.width = '96px';
      el.style.minWidth = '96px';
      el.style.height = '102px';
      el.style.minHeight = '102px';
      el.style.padding = '5px 2px';
      el.style.margin = '0';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'flex-start';
      el.style.boxSizing = 'border-box';
      el.style.overflow = 'visible';

      const glyph = el.querySelector('.glyph');
      if (glyph) {
        glyph.style.width = '48px';
        glyph.style.height = '48px';
        glyph.style.flex = '0 0 48px';
        glyph.style.margin = '0 auto 5px';
      }

      const label = el.querySelector('.label');
      if (label) {
        label.style.width = '96px';
        label.style.maxWidth = '96px';
        label.style.minHeight = '34px';
        label.style.margin = '0';
        label.style.textAlign = 'center';
        label.style.whiteSpace = 'normal';
        label.style.lineHeight = '1.15';
        label.style.overflow = 'visible';
        label.style.textOverflow = 'clip';
        label.style.wordBreak = 'normal';
      }
    });

    write(POS_KEY, positions);
    try {
      const suite = read('idkCompleteSuiteState', {});
      suite.desktopIconPositions = positions;
      write('idkCompleteSuiteState', suite);
      window.IDKAccount?.sync?.();
    } catch {}
    return true;
  }

  function boot() {
    const root = getRoot();
    if (!root) return;
    const versionChanged = localStorage.getItem(VERSION_KEY) !== VERSION;
    if (versionChanged) {
      write(POS_KEY, {});
      localStorage.setItem(VERSION_KEY, VERSION);
      applyGrid();
    } else if (!localStorage.getItem(POS_KEY)) {
      applyGrid();
    } else {
      // Always remove the duplicate Apps shortcut, then enforce the two-column layout.
      applyGrid();
    }
  }

  function watchForApps() {
    const root = getRoot();
    if (!root) return;
    let timer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => applyGrid(), 60);
    });
    observer.observe(root, { childList: true });
    window.addEventListener('resize', () => applyGrid());
  }

  function start() {
    boot();
    setTimeout(boot, 300);
    setTimeout(boot, 1000);
    setTimeout(watchForApps, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

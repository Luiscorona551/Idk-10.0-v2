(() => {
  'use strict';

  const POS_KEY = 'idkDesktopIconPositions';
  const VERSION_KEY = 'idkDesktopLayoutVersion';
  const VERSION = '3';

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function getRoot() {
    return document.querySelector('#icons');
  }

  function getIcons(root) {
    return [...root.children].filter(el => el instanceof HTMLElement && (
      el.classList.contains('desktop-icon') || el.dataset.appId || el.dataset.app || el.dataset.id
    ));
  }

  function keyFor(el, index) {
    return el.dataset.appId || el.dataset.app || el.dataset.id ||
      el.getAttribute('aria-label') || el.title || `desktop-icon-${index}`;
  }

  function applyGrid(forceReset = false) {
    const root = getRoot();
    if (!root) return false;
    const icons = getIcons(root);
    if (!icons.length) return false;

    root.style.position = 'relative';
    root.style.overflow = 'visible';

    const isNarrow = window.innerWidth < 620;
    const columns = isNarrow ? 2 : 3;
    const cellW = isNarrow ? 94 : 108;
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
      el.style.width = '88px';
      el.style.minWidth = '88px';
      el.style.height = '100px';
      el.style.minHeight = '100px';
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
        glyph.style.width = '46px';
        glyph.style.height = '46px';
        glyph.style.flex = '0 0 46px';
        glyph.style.margin = '0 auto 5px';
      }
      const label = el.querySelector('.label');
      if (label) {
        label.style.width = '88px';
        label.style.maxWidth = '88px';
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
      // Reset old, uneven positions once, then keep normal dragging afterward.
      write(POS_KEY, {});
      localStorage.setItem(VERSION_KEY, VERSION);
      applyGrid(true);
    } else if (!localStorage.getItem(POS_KEY)) {
      applyGrid(true);
    }
  }

  function watchForApps() {
    const root = getRoot();
    if (!root) return;
    const observer = new MutationObserver(() => {
      const icons = getIcons(root);
      if (!icons.length) return;
      // Only place genuinely new icons; never rearrange existing dragged icons.
      const positions = read(POS_KEY, {});
      let changed = false;
      icons.forEach((el, index) => {
        const key = keyFor(el, index);
        if (positions[key]) return;
        const columns = window.innerWidth < 620 ? 2 : 3;
        const used = Object.keys(positions).length;
        const col = used % columns;
        const row = Math.floor(used / columns);
        positions[key] = { left: 22 + col * (window.innerWidth < 620 ? 94 : 108), top: 176 + row * 112 };
        changed = true;
      });
      if (changed) {
        write(POS_KEY, positions);
        icons.forEach((el, index) => {
          const p = positions[keyFor(el, index)];
          if (p) { el.style.left = `${p.left}px`; el.style.top = `${p.top}px`; }
        });
      }
    });
    observer.observe(root, { childList: true });
    window.addEventListener('resize', () => {
      // Keep the established grid; only reset on a major viewport change if icons would collide.
      const icons = getIcons(root);
      const columns = window.innerWidth < 620 ? 2 : 3;
      icons.forEach((el, index) => {
        const key = keyFor(el, index);
        const positions = read(POS_KEY, {});
        if (!positions[key]) return;
        const p = positions[key];
        const maxX = Math.max(0, root.clientWidth - el.offsetWidth);
        if (p.left > maxX) {
          p.left = Math.max(8, maxX);
          positions[key] = p;
          el.style.left = `${p.left}px`;
        }
      });
      write(POS_KEY, read(POS_KEY, {}));
    });
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

(() => {
  'use strict';

  const POS_KEY = 'idkDesktopIconPositions';
  const VERSION_KEY = 'idkDesktopLayoutVersion';
  const VERSION = '5-clean-two-column-no-overlap';
  const CELL_W = 122;
  const CELL_H = 122;
  const LEFT = 22;
  const TOP = 176;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function root() { return document.querySelector('#icons'); }
  function icons(r) {
    return [...r.children].filter(el => el instanceof HTMLElement && (
      el.classList.contains('desktop-icon') || el.dataset.appId || el.dataset.app || el.dataset.id
    ));
  }
  function keyFor(el, index) {
    return el.dataset.appId || el.dataset.app || el.dataset.id || el.getAttribute('aria-label') || el.title || `desktop-icon-${index}`;
  }
  function isDuplicateApps(el) {
    const id = String(el.dataset.appId || el.dataset.app || el.dataset.id || '').toLowerCase();
    const label = String(el.querySelector('.label')?.textContent || el.textContent || '').trim().toLowerCase();
    return id === 'apps' || label === 'apps';
  }
  function removeDuplicateApps(r) {
    icons(r).filter(isDuplicateApps).forEach(el => el.remove());
  }

  function apply() {
    const r = root();
    if (!r) return false;
    removeDuplicateApps(r);
    const list = icons(r);
    if (!list.length) return false;

    r.style.position = 'absolute';
    r.style.left = '20px';
    r.style.top = '106px';
    r.style.display = 'block';
    r.style.width = '280px';
    r.style.maxHeight = 'calc(100% - 150px)';
    r.style.overflow = 'visible';

    const positions = {};
    list.forEach((el, i) => {
      // Never use the old broken saved coordinates for the initial reset.
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = LEFT + col * CELL_W;
      const y = TOP + row * CELL_H;
      const key = keyFor(el, i);
      positions[key] = { left: x, top: y };

      el.style.setProperty('position', 'absolute', 'important');
      el.style.setProperty('left', `${x}px`, 'important');
      el.style.setProperty('top', `${y}px`, 'important');
      el.style.setProperty('right', 'auto', 'important');
      el.style.setProperty('bottom', 'auto', 'important');
      el.style.setProperty('transform', 'none', 'important');
      el.style.setProperty('width', '96px', 'important');
      el.style.setProperty('min-width', '96px', 'important');
      el.style.setProperty('height', '108px', 'important');
      el.style.setProperty('min-height', '108px', 'important');
      el.style.setProperty('padding', '4px 2px', 'important');
      el.style.setProperty('margin', '0', 'important');
      el.style.setProperty('display', 'flex', 'important');
      el.style.setProperty('flex-direction', 'column', 'important');
      el.style.setProperty('align-items', 'center', 'important');
      el.style.setProperty('justify-content', 'flex-start', 'important');
      el.style.setProperty('box-sizing', 'border-box', 'important');
      el.style.setProperty('overflow', 'visible', 'important');

      const glyph = el.querySelector('.glyph');
      if (glyph) {
        glyph.style.setProperty('width', '48px', 'important');
        glyph.style.setProperty('height', '48px', 'important');
        glyph.style.setProperty('flex', '0 0 48px', 'important');
        glyph.style.setProperty('margin', '0 auto 5px', 'important');
      }
      const label = el.querySelector('.label');
      if (label) {
        label.style.setProperty('width', '96px', 'important');
        label.style.setProperty('max-width', '96px', 'important');
        label.style.setProperty('min-height', '38px', 'important');
        label.style.setProperty('margin', '0', 'important');
        label.style.setProperty('text-align', 'center', 'important');
        label.style.setProperty('white-space', 'normal', 'important');
        label.style.setProperty('line-height', '1.15', 'important');
        label.style.setProperty('overflow', 'visible', 'important');
        label.style.setProperty('word-break', 'normal', 'important');
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

  function resetOnce() {
    if (localStorage.getItem(VERSION_KEY) !== VERSION) {
      write(POS_KEY, {});
      localStorage.setItem(VERSION_KEY, VERSION);
      return true;
    }
    return false;
  }

  function start() {
    resetOnce();
    apply();
    setTimeout(apply, 500);
    setTimeout(apply, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

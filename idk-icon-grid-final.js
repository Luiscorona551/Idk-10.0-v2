(() => {
  'use strict';
  const ROOT = '#icons';
  const VERSION_KEY = 'idkDesktopLayoutVersion';
  const VERSION = '7-real-two-column-grid';
  const COL_W = 124;
  const ROW_H = 126;
  const START_X = 18;
  const START_Y = 112;
  let applying = false;
  let timer = 0;

  function getRoot() { return document.querySelector(ROOT); }
  function textOf(el) { return (el.querySelector('.label,.icon-label,.desktop-icon-label')?.textContent || el.textContent || '').trim(); }
  function keyOf(el) { return String(el.dataset.appId || el.dataset.app || el.dataset.id || textOf(el)).trim().toLowerCase(); }
  function isDesktopIcon(el) { return el instanceof HTMLElement && !el.matches('#busy-cursor,.desktop-toolbar,.desktop-overlay'); }

  function removeDuplicateApps(r) {
    [...r.children].filter(isDesktopIcon).forEach(el => {
      const key = keyOf(el);
      if (key === 'apps' || textOf(el).toLowerCase() === 'apps') el.remove();
    });
  }

  function arrange() {
    if (applying) return;
    const r = getRoot();
    if (!r) return;
    applying = true;
    removeDuplicateApps(r);
    const list = [...r.children].filter(isDesktopIcon);

    r.style.setProperty('position','absolute','important');
    r.style.setProperty('left','0','important');
    r.style.setProperty('top','0','important');
    r.style.setProperty('width','310px','important');
    r.style.setProperty('height','calc(100% - 120px)','important');
    r.style.setProperty('overflow','visible','important');

    list.forEach((el, i) => {
      const x = START_X + (i % 2) * COL_W;
      const y = START_Y + Math.floor(i / 2) * ROW_H;
      el.style.setProperty('position','absolute','important');
      el.style.setProperty('left',`${x}px`,'important');
      el.style.setProperty('top',`${y}px`,'important');
      el.style.setProperty('right','auto','important');
      el.style.setProperty('bottom','auto','important');
      el.style.setProperty('transform','none','important');
      el.style.setProperty('width','104px','important');
      el.style.setProperty('height','112px','important');
      el.style.setProperty('min-width','104px','important');
      el.style.setProperty('min-height','112px','important');
      el.style.setProperty('margin','0','important');
      el.style.setProperty('padding','3px 2px','important');
      el.style.setProperty('box-sizing','border-box','important');
      el.style.setProperty('display','flex','important');
      el.style.setProperty('flex-direction','column','important');
      el.style.setProperty('align-items','center','important');
      el.style.setProperty('justify-content','flex-start','important');
      el.style.setProperty('overflow','visible','important');

      const glyph = el.querySelector('.glyph');
      if (glyph) {
        glyph.style.setProperty('width','48px','important');
        glyph.style.setProperty('height','48px','important');
        glyph.style.setProperty('flex','0 0 48px','important');
        glyph.style.setProperty('margin','0 0 6px','important');
      }
      const label = el.querySelector('.label,.icon-label,.desktop-icon-label');
      if (label) {
        label.style.setProperty('width','104px','important');
        label.style.setProperty('max-width','104px','important');
        label.style.setProperty('min-height','38px','important');
        label.style.setProperty('margin','0','important');
        label.style.setProperty('text-align','center','important');
        label.style.setProperty('white-space','normal','important');
        label.style.setProperty('line-height','1.15','important');
        label.style.setProperty('overflow','visible','important');
        label.style.setProperty('word-break','normal','important');
      }
    });

    try {
      localStorage.setItem(VERSION_KEY, VERSION);
      localStorage.removeItem('idkDesktopIconPositions');
    } catch {}
    applying = false;
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = 0; arrange(); }, 100);
  }

  function boot() {
    arrange();
    const r = getRoot();
    if (r) new MutationObserver(mutations => {
      if (!applying && mutations.some(m => m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length))) schedule();
    }).observe(r, { childList:true });
    [300,800,1500,3000].forEach(ms => setTimeout(arrange, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();

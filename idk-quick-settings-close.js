(() => {
  'use strict';

  const SELECTORS = [
    '#idk-complete-quick',
    '.quick-settings',
    '.quick-settings-panel',
    '.idk-quick-settings',
    '.control-center',
    '.idk-control-center'
  ];

  function findPanels() {
    const found = [];
    SELECTORS.forEach(sel => document.querySelectorAll(sel).forEach(el => found.push(el)));
    document.querySelectorAll('[role="dialog"]').forEach(el => {
      if (/quick settings|control center/i.test(el.textContent || '')) found.push(el);
    });
    return [...new Set(found)];
  }

  function install(panel) {
    if (!(panel instanceof HTMLElement)) return;
    panel.style.position = panel.style.position || 'fixed';
    if (panel.querySelector(':scope > .idk-quick-close')) return;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'idk-quick-close';
    close.setAttribute('aria-label', 'Close Quick Settings');
    close.title = 'Close Quick Settings';
    close.textContent = '×';
    close.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      panel.dataset.idkClosed = '1';
      panel.hidden = true;
      panel.style.display = '';
      panel.setAttribute('aria-hidden', 'true');
    });
    panel.appendChild(close);
  }

  function refresh() {
    findPanels().forEach(panel => {
      // If the normal Quick Settings launcher makes the panel visible again,
      // clear our temporary closed state so it can reopen normally.
      if (panel.dataset.idkClosed === '1' && !panel.hidden && panel.style.display === 'none') {
        panel.style.display = '';
      }
      if (panel.dataset.idkClosed === '1' && !panel.hidden) {
        panel.dataset.idkClosed = '';
        panel.removeAttribute('aria-hidden');
      }
      install(panel);
    });
  }

  const css = document.createElement('style');
  css.textContent = `
    .idk-quick-close {
      position: absolute !important;
      top: 9px !important;
      right: 9px !important;
      z-index: 2147483647 !important;
      width: 34px !important;
      height: 34px !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 1px solid rgba(255,255,255,.45) !important;
      border-radius: 8px !important;
      background: rgba(10,25,55,.9) !important;
      color: #fff !important;
      font: 700 25px/30px Arial,sans-serif !important;
      cursor: pointer !important;
      display: grid !important;
      place-items: center !important;
      box-shadow: 0 2px 8px rgba(0,0,0,.4) !important;
    }
    .idk-quick-close:hover { background: rgba(55,105,185,.98) !important; }
    .idk-quick-close:focus-visible { outline: 2px solid #8bc5ff !important; outline-offset: 2px !important; }
  `;
  document.head.appendChild(css);

  const observer = new MutationObserver(refresh);
  function boot() {
    refresh();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class', 'aria-hidden'] });
    setTimeout(refresh, 300);
    setTimeout(refresh, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

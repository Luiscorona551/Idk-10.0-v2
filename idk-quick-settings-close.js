(() => {
  'use strict';

  const BUTTON_ID = 'idk-quick-close-final';

  function findPanel() {
    const selectors = [
      '#idk-complete-quick',
      '.quick-settings',
      '.quick-settings-panel',
      '.idk-quick-settings',
      '.control-center',
      '.idk-control-center',
      '[role="dialog"]'
    ];

    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (el instanceof HTMLElement && /IDK Quick Settings/i.test(el.textContent || '')) return el;
      }
    }

    // Fallback: find the visible element that actually owns the Quick Settings heading.
    const heading = [...document.querySelectorAll('h1,h2,h3,h4,strong,b,div,section,aside')]
      .find(el => /IDK Quick Settings/i.test((el.textContent || '').trim()) && el.children.length < 8);
    if (!heading) return null;

    let el = heading;
    for (let i = 0; i < 5 && el.parentElement; i++, el = el.parentElement) {
      const text = el.textContent || '';
      if (/Wi-Fi|Do Not Disturb|Notification Center|App Store|IDK Search/i.test(text) && el.clientWidth > 200 && el.clientHeight > 150) {
        return el;
      }
    }
    return null;
  }

  function install() {
    const panel = findPanel();
    if (!(panel instanceof HTMLElement)) return;
    if (panel.querySelector(`#${BUTTON_ID}`)) return;

    if (getComputedStyle(panel).position === 'static') panel.style.position = 'relative';

    const close = document.createElement('button');
    close.id = BUTTON_ID;
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close Quick Settings');
    close.title = 'Close Quick Settings';
    close.style.cssText = [
      'position:absolute!important',
      'top:8px!important',
      'right:8px!important',
      'z-index:2147483647!important',
      'width:36px!important',
      'height:36px!important',
      'padding:0!important',
      'margin:0!important',
      'border:2px solid rgba(255,255,255,.8)!important',
      'border-radius:8px!important',
      'background:#17366f!important',
      'color:#fff!important',
      'font:700 26px/30px Arial,sans-serif!important',
      'cursor:pointer!important',
      'display:grid!important',
      'place-items:center!important',
      'box-sizing:border-box!important'
    ].join(';');

    close.addEventListener('pointerdown', e => e.stopPropagation());
    close.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.dataset.idkQuickClosed = '1';
    });

    panel.appendChild(close);
  }

  function boot() {
    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden']
    });
    setTimeout(install, 250);
    setTimeout(install, 750);
    setTimeout(install, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

(() => {
  'use strict';
  // Keep Idk Messenger as the only chat experience without rescanning the whole page.
  const legacyTerms = /^(bot chat|bot dm|direct bot chat|bot direct message|chat with bot|bot chat room)$/i;
  const selector = 'button,[role="button"],.desktop-icon,.app-icon,.app-item,.recent-app,.program-item';

  function clean(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll(selector).forEach(el => {
      const text = String(el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '')
        .replace(/\s+/g, ' ').trim();
      if (legacyTerms.test(text) && !/idk messenger/i.test(text)) el.remove();
    });
  }

  function init() {
    clean(document);
    const targets = ['icons', 'start-apps', 'start-recent']
      .map(id => document.getElementById(id))
      .filter(Boolean);
    if (!targets.length) return;

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        targets.forEach(clean);
      });
    });
    targets.forEach(target => observer.observe(target, { childList: true, subtree: true }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

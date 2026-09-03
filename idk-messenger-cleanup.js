(() => {
  'use strict';

  const legacyTerms = /^(bot chat|bot dm|direct bot chat|bot direct message|chat with bot|bot chat room)$/i;

  function clean(root = document) {
    root.querySelectorAll('button,[role="button"],.desktop-icon,.app-icon').forEach(el => {
      const text = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      if (legacyTerms.test(text)) el.remove();
    });
    root.querySelectorAll('.app-item,.recent-app,.program-item').forEach(el => {
      const text = (el.textContent || '').trim();
      if (legacyTerms.test(text) && !/idk messenger/i.test(text)) el.remove();
    });
  }

  function init() {
    clean();
    // Legacy cleanup is startup-only. The old body-wide observer caused every
    // desktop mutation to rescan the entire document and could cascade with
    // the other desktop managers.
    requestAnimationFrame(() => clean());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

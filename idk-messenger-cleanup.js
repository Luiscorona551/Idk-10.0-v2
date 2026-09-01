(() => {
  'use strict';
  // Keep Idk Messenger as the only chat experience. Remove legacy bot-chat/DM launchers
  // without touching the original desktop/window system.
  const legacyTerms = /^(bot chat|bot dm|direct bot chat|bot direct message|chat with bot|bot chat room)$/i;
  function clean(root = document) {
    root.querySelectorAll('button,[role="button"],.desktop-icon,.app-icon').forEach(el => {
      const text = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      if (legacyTerms.test(text)) el.remove();
    });
    // Remove legacy app entries by their visible labels, while leaving Idk Messenger intact.
    root.querySelectorAll('*').forEach(el => {
      if (el.children.length) return;
      const text = (el.textContent || '').trim();
      if (!legacyTerms.test(text)) return;
      const item = el.closest('button,.desktop-icon,.app-icon,[role="button"],.app-item,.recent-app,.program-item');
      if (item && !/idk messenger/i.test(item.textContent || '')) item.remove();
    });
  }
  function init() {
    clean();
    const observer = new MutationObserver(() => clean());
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

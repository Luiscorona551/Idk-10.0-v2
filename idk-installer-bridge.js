(() => {
  'use strict';

  function removeLegacyInstallerIcon() {
    document.querySelectorAll('#icons .desktop-icon[data-app="installer"]').forEach(el => el.remove());
  }

  function openInstallerFromMenu(event) {
    const target = event.target.closest('#start-apps .start-app, #start-recent .recent-app, [data-app="installer"]');
    if (!target || !/program installer/i.test(target.textContent || target.getAttribute('aria-label') || target.getAttribute('title') || '')) return;

    const icon = document.querySelector('#icons .idk-program-installer-icon');
    if (!icon) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    icon.click();
  }

  function init() {
    removeLegacyInstallerIcon();
    document.addEventListener('click', openInstallerFromMenu, true);
    const observer = new MutationObserver(removeLegacyInstallerIcon);
    observer.observe(document.getElementById('icons') || document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

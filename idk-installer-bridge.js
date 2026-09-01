(() => {
  'use strict';

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
    document.addEventListener('click', openInstallerFromMenu, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

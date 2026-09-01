(() => {
  'use strict';

  function removeLegacyInstaller() {
    // The rebuilt installer is owned by idk-installer-launcher.js.
    // Remove the legacy apps.js installer entry/controls so there is only one path.
    try {
      if (window.APPS && window.APPS.installer) delete window.APPS.installer;
    } catch {}

    document.querySelectorAll('[data-app="installer"]').forEach(node => node.remove());
    document.querySelectorAll('#start-apps .start-app, #start-recent .recent-app').forEach(node => {
      const text = node.textContent || '';
      if (/program installer/i.test(text)) node.remove();
    });
  }

  function openInstallerFromMenu(event) {
    const target = event.target.closest('#start-apps .start-app, #start-recent .recent-app');
    if (!target || !/program installer/i.test(target.textContent || '')) return;

    const icon = document.querySelector('#icons .idk-program-installer-icon');
    if (!icon) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    icon.click();
  }

  function init() {
    removeLegacyInstaller();
    document.addEventListener('click', openInstallerFromMenu, true);
    const observer = new MutationObserver(removeLegacyInstaller);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(removeLegacyInstaller, 0);
    setTimeout(removeLegacyInstaller, 500);
    setTimeout(removeLegacyInstaller, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

(() => {
  'use strict';

  function removeLegacyInstaller() {
    // Keep the shared APPS registry intact. The rebuilt installer owns the
    // visible installer shortcut; only remove the legacy desktop/start-menu UI.
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

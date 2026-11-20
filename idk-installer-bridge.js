(() => {
  'use strict';

  function removeLegacyInstaller(root = document) {
    // Keep the shared APPS registry intact. The rebuilt installer owns the
    // visible installer shortcut; only remove the legacy desktop/start-menu UI.
    root.querySelectorAll('[data-app="installer"]').forEach(node => node.remove());
    root.querySelectorAll('.start-app, .recent-app').forEach(node => {
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
    const targets = ['icons', 'start-apps', 'start-recent']
      .map(id => document.getElementById(id))
      .filter(Boolean);
    const observer = new MutationObserver(records => {
      const changed = new Set(records.map(record => record.target.closest?.('#icons,#start-apps,#start-recent')).filter(Boolean));
      changed.forEach(removeLegacyInstaller);
    });
    targets.forEach(target => observer.observe(target, { childList: true, subtree: true }));
    setTimeout(removeLegacyInstaller, 0);
    setTimeout(removeLegacyInstaller, 500);
    setTimeout(removeLegacyInstaller, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

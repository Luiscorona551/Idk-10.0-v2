/* Installer polish: use the IDK Desktop as the virtual install destination. */
(() => {
  'use strict';
  const DESKTOP_LABEL = 'Desktop';
  const apply = () => {
    const destination = document.querySelector('.idk-install-destination');
    if (!destination) return;
    const span = destination.querySelector('span');
    const name = destination.querySelector('#idk-destination-name');
    if (span) {
      span.innerHTML = `${DESKTOP_LABEL}\\<b id="idk-destination-name">${name?.textContent || 'Program'}</b>`;
    }
    const button = destination.querySelector('button');
    if (button) {
      button.textContent = 'Desktop';
      button.title = 'Programs installed here are represented by desktop shortcuts in IDK 10.0.';
      button.onclick = () => window.OS?.notify?.('Program Installer', 'IDK installs HTML programs to the Desktop as launchable shortcuts.');
    }
  };
  new MutationObserver(apply).observe(document.documentElement, {childList:true, subtree:true});
  document.addEventListener('input', event => { if (event.target?.id === 'idk-program-name') setTimeout(apply, 0); });
  apply();
})();

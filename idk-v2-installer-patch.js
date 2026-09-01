/* Installer polish: use the IDK Desktop as the virtual install destination. */
(() => {
  'use strict';
  const DESKTOP_LABEL = 'Desktop';

  const apply = () => {
    const destination = document.querySelector('.idk-install-destination');
    if (!destination) return;

    const span = destination.querySelector('span');
    const name = destination.querySelector('#idk-destination-name');
    const programName = name?.textContent || 'Program';
    const desiredHTML = `${DESKTOP_LABEL}\\<b id="idk-destination-name">${programName}</b>`;

    // IMPORTANT: do not rewrite the DOM when nothing changed. The old code
    // rewrote innerHTML on every MutationObserver callback, which generated
    // another mutation and caused an infinite observer loop that froze IDK
    // as soon as the Program Installer was opened.
    if (span && span.innerHTML !== desiredHTML) {
      span.innerHTML = desiredHTML;
    }

    const button = destination.querySelector('button');
    if (button) {
      if (button.textContent !== DESKTOP_LABEL) button.textContent = DESKTOP_LABEL;
      button.title = 'Programs installed here are represented by desktop shortcuts in IDK 10.0.';
      if (!button.dataset.idkDesktopDestination) {
        button.dataset.idkDesktopDestination = 'true';
        button.onclick = () => window.OS?.notify?.(
          'Program Installer',
          'IDK installs HTML programs to the Desktop as launchable shortcuts.'
        );
      }
    }
  };

  const observer = new MutationObserver(() => apply());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('input', event => {
    if (event.target?.id === 'idk-program-name') setTimeout(apply, 0);
  });

  apply();
})();

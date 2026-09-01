/* Installer polish: use the IDK Desktop as the virtual install destination. */
(() => {
  'use strict';
  const DESKTOP_LABEL = 'Desktop';

  // The installer re-renders its wizard steps. A permanent MutationObserver
  // is unsafe here because changing the installer DOM creates more mutations.
  // Patch the destination once when that step exists, then disconnect.
  let patched = false;
  let observer = null;

  const apply = () => {
    if (patched) return true;

    const destination = document.querySelector('.idk-install-destination');
    if (!destination) return false;

    const span = destination.querySelector('span');
    const name = destination.querySelector('#idk-destination-name');
    const programName = name?.textContent || 'Program';
    const desiredHTML = `${DESKTOP_LABEL}\\<b id="idk-destination-name">${programName}</b>`;

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

    // Disconnect immediately after the installer destination has been
    // patched. This prevents the patch itself from triggering an observer loop.
    patched = true;
    observer?.disconnect();
    return true;
  };

  observer = new MutationObserver(() => apply());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  apply();

  document.addEventListener('input', event => {
    if (!patched && event.target?.id === 'idk-program-name') {
      queueMicrotask(apply);
    }
  });
})();

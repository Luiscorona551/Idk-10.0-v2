(() => {
  'use strict';

  const desktop = document.getElementById('desktop');
  const windows = document.getElementById('windows');
  if (!desktop || !windows) return;

  const EDGE = 28;
  let draggingTitlebar = false;
  let pointerId = null;
  let preview = null;

  function ensurePreview() {
    if (preview) return preview;
    preview = document.createElement('div');
    preview.className = 'idk-snap-preview';
    preview.setAttribute('aria-hidden', 'true');
    desktop.append(preview);
    return preview;
  }

  function clearPreview() {
    if (!preview) return;
    preview.className = 'idk-snap-preview';
    preview.textContent = '';
  }

  function updatePreview(event) {
    if (!draggingTitlebar || !preview || window.innerWidth < 700) return;
    const rect = desktop.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    let side = '';
    if (y <= EDGE) side = 'max';
    else if (x <= EDGE) side = 'left';
    else if (x >= width - EDGE) side = 'right';

    if (!side) {
      clearPreview();
      return;
    }

    preview.className = `idk-snap-preview ${side}`;
    preview.textContent = side === 'max' ? 'Maximize' : 'Snap';
  }

  windows.addEventListener('pointerdown', event => {
    if (window.innerWidth < 700 || event.button !== 0) return;
    const titlebar = event.target.closest('.titlebar');
    const win = event.target.closest('.window');
    if (!titlebar || !win || event.target.closest('.ctrl')) return;

    draggingTitlebar = true;
    pointerId = event.pointerId;
    ensurePreview();
    updatePreview(event);
  });

  window.addEventListener('pointermove', updatePreview, { passive: true });

  function finish(event) {
    if (!draggingTitlebar || (pointerId !== null && event.pointerId !== pointerId)) return;
    draggingTitlebar = false;
    pointerId = null;
    clearPreview();
  }

  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  window.addEventListener('blur', () => {
    draggingTitlebar = false;
    pointerId = null;
    clearPreview();
  });

  window.addEventListener('resize', clearPreview);
})();
(() => {
  'use strict';

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  function enhanceAccountOverlay() {
    const overlay = document.getElementById('idk-account-overlay');
    if (!overlay || overlay.dataset.idkBatchTwo) return Boolean(overlay);
    overlay.dataset.idkBatchTwo = '1';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'idk-account-title');
    const row = overlay.querySelector('.idk-account-row');
    if (!row) return true;
    const local = document.createElement('button');
    local.type = 'button';
    local.id = 'idk-account-local';
    local.className = 'idk-account-secondary idk-account-local';
    local.textContent = 'Continue locally';
    local.title = 'Use IDK without an online account';
    local.addEventListener('click', () => {
      try { localStorage.setItem('idkGuestSession', 'true'); } catch {}
      overlay.remove();
      window.IDKNext?.setFocus?.('guest', true);
      window.dispatchEvent(new CustomEvent('idk-account-guest'));
      setTimeout(() => window.IDKProductFeatures?.welcome?.(), 250);
    });
    row.append(local);
    setTimeout(() => overlay.querySelector('#idk-account-user')?.focus(), 40);
    return true;
  }

  function coordinateOnboarding() {
    const account = document.getElementById('idk-account-overlay');
    const tour = document.getElementById('idk-onboarding');
    if (account && tour) tour.remove();
    if (!account && !read('idkOnboardingComplete', false) && !document.getElementById('idk-onboarding')) {
      window.IDKProductFeatures?.welcome?.();
    }
  }

  function improveControls() {
    document.getElementById('desktop')?.setAttribute('role', 'application');
    const labels = { min: 'Minimize window', max: 'Maximize window', close: 'Close window', snap: 'Snap window' };
    document.querySelectorAll('#windows .ctrl').forEach(control => {
      const key = Object.keys(labels).find(name => control.classList.contains(name));
      if (key && !control.getAttribute('aria-label')) control.setAttribute('aria-label', labels[key]);
    });
    document.querySelectorAll('iframe').forEach(frame => { frame.loading ||= 'lazy'; frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin'); });
    document.querySelectorAll('img').forEach(image => { image.decoding ||= 'async'; });
  }

  function install() {
    const observer = new MutationObserver(() => {
      enhanceAccountOverlay();
      coordinateOnboarding();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    enhanceAccountOverlay();
    setTimeout(coordinateOnboarding, 2000);
    const idle = task => window.requestIdleCallback ? requestIdleCallback(task, { timeout: 1600 }) : setTimeout(task, 0);
    idle(improveControls);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.IDKBatchTwo = { improveControls, coordinateOnboarding };
})();

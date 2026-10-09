/* IDK Welcome Center: replaces the redundant sign-in interstitial with useful desktop onboarding. */
(() => {
  'use strict';
  const STORAGE_KEY = 'idkWelcomeCenterDismissedV1';
  const mount = () => {
    if (document.getElementById('idk-welcome-backdrop')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'idk-welcome-backdrop';
    backdrop.className = 'idk-welcome-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="idk-welcome-card" role="dialog" aria-modal="true" aria-labelledby="idk-welcome-title">
        <div class="idk-welcome-top">
          <img class="idk-welcome-logo" src="ugs-icon.jpeg" alt="">
          <div><div class="idk-welcome-eyebrow">Your workspace, refreshed</div><h1 id="idk-welcome-title">Welcome to IDK 10.0</h1></div>
        </div>
        <p class="idk-welcome-lede">You’re in. No extra desktop sign-in screen—just a quick guide to help you get started.</p>
        <div class="idk-welcome-grid">
          <div class="idk-welcome-tip"><div class="idk-welcome-icon" aria-hidden="true">▦</div><div><strong>Find your apps</strong><span>Open the IDK menu to search and launch installed apps.</span></div></div>
          <div class="idk-welcome-tip"><div class="idk-welcome-icon" aria-hidden="true">✦</div><div><strong>Ask Echo</strong><span>Use IDK Echo for desktop actions and quick help.</span></div></div>
          <div class="idk-welcome-tip"><div class="idk-welcome-icon" aria-hidden="true">⚙</div><div><strong>Make it yours</strong><span>Open Settings to personalize your desktop and theme.</span></div></div>
          <div class="idk-welcome-tip"><div class="idk-welcome-icon" aria-hidden="true">▤</div><div><strong>Manage windows</strong><span>Move, resize, or close app windows as you work.</span></div></div>
        </div>
        <div class="idk-welcome-actions">
          <label><input id="idk-welcome-skip-next" type="checkbox"> Don’t show this again</label>
          <div class="idk-welcome-buttons"><button type="button" id="idk-welcome-explore">Explore apps</button><button type="button" class="primary" id="idk-welcome-done">Let’s go</button></div>
        </div>
      </section>`;
    document.body.append(backdrop);
    const close = () => {
      if (document.getElementById('idk-welcome-skip-next').checked) {
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
      }
      backdrop.hidden = true;
      document.getElementById('start-toggle')?.focus({ preventScroll: true });
    };
    document.getElementById('idk-welcome-done').addEventListener('click', close);
    document.getElementById('idk-welcome-explore').addEventListener('click', () => {
      close();
      document.getElementById('start-toggle')?.click();
      const search = document.getElementById('start-search');
      if (search) setTimeout(() => search.focus(), 80);
    });
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
    document.addEventListener('keydown', event => {
      if (backdrop.hidden) return;
      if (event.key === 'Escape') close();
    });
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') backdrop.hidden = false;
    } catch (_) {
      backdrop.hidden = false;
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();

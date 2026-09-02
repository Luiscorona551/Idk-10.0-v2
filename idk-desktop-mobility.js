(() => {
  'use strict';

  // Desktop icons are intentionally NOT draggable.
  // idk-icon-grid-final.js owns their layout and the scrollable desktop.
  function getIconsRoot() { return document.querySelector('#icons, .desktop-icons, .desktop-icon-area'); }

  function closeQuickSettings() {
    const direct = document.querySelector('#idk-complete-quick');
    const candidates = direct ? [direct] : [...document.querySelectorAll('[role="dialog"], .quick-settings, .quick-settings-panel, .idk-quick-settings, .control-center, .idk-control-center')];
    const panel = candidates.find(el => el && el.offsetParent !== null && (el.id === 'idk-complete-quick' || /quick settings|control center/i.test(el.textContent || '')));
    if (!panel || panel.querySelector('.idk-qs-close')) return;
    panel.style.position = panel.style.position || 'fixed';
    const btn = document.createElement('button');
    btn.className = 'idk-qs-close';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Close Quick Settings');
    btn.title = 'Close Quick Settings';
    btn.textContent = '×';
    btn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:20;width:32px;height:32px;padding:0;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(10,25,55,.78);color:#fff;font:700 24px/28px Arial,sans-serif;cursor:pointer;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.35);';
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); panel.style.display = 'none'; });
    panel.appendChild(btn);
  }

  function normalizeTV() {
    const root = getIconsRoot();
    if (!root) return;
    const els = [...root.querySelectorAll('*')].filter(el => el instanceof HTMLElement);
    const tv = els.find(el => /\bTV\b|television/i.test((el.textContent || '').trim()) || /\bTV\b|television/i.test(`${el.getAttribute('aria-label') || ''} ${el.title || ''}`));
    if (!tv) return;
    const icon = tv.closest('.desktop-icon,[data-app-id],[data-app],[data-id]') || tv;
    if (!root.contains(icon)) return;
    icon.style.setProperty('right', 'auto', 'important');
    icon.style.setProperty('bottom', 'auto', 'important');
    icon.style.setProperty('transform', 'none', 'important');
  }

  function boot() {
    closeQuickSettings();
    normalizeTV();
    [250, 800, 1500].forEach(ms => setTimeout(() => { closeQuickSettings(); normalizeTV(); }, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

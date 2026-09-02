(() => {
  'use strict';

  const POS_KEY = 'idkDesktopIconPositions';
  const SUITE_KEY = 'idkCompleteSuiteState';
  const GRID_VERSION_KEY = 'idkDesktopLayoutVersion';
  const GRID_VERSION = '5-clean-two-column-no-overlap';
  let dragState = null;

  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
  };
  const writeJSON = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  function savePositions(positions) {
    writeJSON(POS_KEY, positions);
    const suite = readJSON(SUITE_KEY, {});
    suite.desktopIconPositions = positions;
    writeJSON(SUITE_KEY, suite);
    try { window.IDKAccount?.sync?.(); } catch {}
  }

  function iconKey(el) {
    return el.dataset.appId || el.dataset.app || el.getAttribute('data-id') || el.getAttribute('aria-label') || el.title ||
      (el.querySelector('.icon-label,.label,.desktop-icon-label')?.textContent || '').trim();
  }
  function getIconsRoot() { return document.querySelector('#icons, .desktop-icons, .desktop-icon-area'); }
  function desktopIcons(root) {
    return [...root.children].filter(el => el instanceof HTMLElement && (el.classList.contains('desktop-icon') || el.dataset.appId || el.dataset.app || el.getAttribute('data-id')));
  }
  function applySaved(el, root, positions) {
    const key = iconKey(el);
    if (!key || !positions[key]) return;
    const p = positions[key];
    const maxX = Math.max(0, root.clientWidth - el.offsetWidth);
    const maxY = Math.max(0, root.clientHeight - el.offsetHeight);
    el.style.left = `${Math.max(0, Math.min(maxX, Number(p.left) || 0))}px`;
    el.style.top = `${Math.max(0, Math.min(maxY, Number(p.top) || 0))}px`;
  }
  function normalizePositions(root, icons) {
    const saved = readJSON(POS_KEY, {});
    const rootRect = root.getBoundingClientRect();
    const positions = { ...saved };
    icons.forEach(el => {
      const key = iconKey(el);
      if (!key || positions[key]) return;
      const r = el.getBoundingClientRect();
      positions[key] = { left: Math.max(0, Math.round(r.left - rootRect.left)), top: Math.max(0, Math.round(r.top - rootRect.top)) };
    });
    savePositions(positions);
    return positions;
  }

  function makeDraggable(el, root, positions) {
    if (el.dataset.idkDraggable === '1') return;
    el.dataset.idkDraggable = '1';
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    el.style.userSelect = 'none';
    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('width', '96px', 'important');
    el.style.setProperty('min-width', '96px', 'important');
    el.style.setProperty('height', '108px', 'important');
    el.style.setProperty('min-height', '108px', 'important');
    el.style.setProperty('display', 'flex', 'important');
    el.style.setProperty('flex-direction', 'column', 'important');
    el.style.setProperty('align-items', 'center', 'important');
    el.style.setProperty('justify-content', 'flex-start', 'important');
    el.style.setProperty('padding', '4px 2px', 'important');
    el.style.setProperty('text-align', 'center', 'important');
    el.style.setProperty('line-height', '1.15', 'important');
    el.style.setProperty('overflow', 'visible', 'important');

    const glyph = el.querySelector('.glyph');
    const label = el.querySelector('.label');
    if (glyph) {
      glyph.style.setProperty('display', 'block', 'important');
      glyph.style.setProperty('width', '48px', 'important');
      glyph.style.setProperty('height', '48px', 'important');
      glyph.style.setProperty('flex', '0 0 48px', 'important');
      glyph.style.setProperty('margin', '0 auto 5px', 'important');
    }
    if (label) {
      label.style.setProperty('display', 'block', 'important');
      label.style.setProperty('width', '96px', 'important');
      label.style.setProperty('max-width', '96px', 'important');
      label.style.setProperty('min-height', '38px', 'important');
      label.style.setProperty('white-space', 'normal', 'important');
      label.style.setProperty('overflow', 'visible', 'important');
      label.style.setProperty('text-overflow', 'clip', 'important');
      label.style.setProperty('word-break', 'normal', 'important');
    }

    const key = iconKey(el);
    applySaved(el, root, positions);

    el.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      dragState = { el, key, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
        offsetX: e.clientX - elRect.left, offsetY: e.clientY - elRect.top,
        rootLeft: rootRect.left, rootTop: rootRect.top, moved: false };
      try { el.setPointerCapture(e.pointerId); } catch {}
    });
    el.addEventListener('pointermove', e => {
      if (!dragState || dragState.el !== el || dragState.pointerId !== e.pointerId) return;
      const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(dx, dy) < 5) return;
      dragState.moved = true;
      el.classList.add('idk-dragging');
      el.style.cursor = 'grabbing';
      const maxX = Math.max(0, root.clientWidth - el.offsetWidth), maxY = Math.max(0, root.clientHeight - el.offsetHeight);
      el.style.setProperty('left', `${Math.max(0, Math.min(maxX, e.clientX - dragState.rootLeft - dragState.offsetX))}px`, 'important');
      el.style.setProperty('top', `${Math.max(0, Math.min(maxY, e.clientY - dragState.rootTop - dragState.offsetY))}px`, 'important');
      e.preventDefault();
    });
    const finish = e => {
      if (!dragState || dragState.el !== el || dragState.pointerId !== e.pointerId) return;
      if (dragState.moved) {
        positions[key] = { left: parseInt(el.style.left, 10) || 0, top: parseInt(el.style.top, 10) || 0 };
        savePositions(positions);
        el.dataset.idkDragged = '1';
        setTimeout(() => { delete el.dataset.idkDragged; }, 120);
      }
      el.classList.remove('idk-dragging');
      el.style.cursor = 'grab';
      try { el.releasePointerCapture(e.pointerId); } catch {}
      dragState = null;
    };
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
    el.addEventListener('click', e => { if (el.dataset.idkDragged === '1') { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  }

  function setupDragging() {
    const root = getIconsRoot();
    if (!root) return false;
    const iconList = desktopIcons(root);
    if (!iconList.length) return false;
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    root.style.overflow = 'visible';

    // The final grid script owns the initial positions. Do not recalculate them here.
    const positions = localStorage.getItem(GRID_VERSION_KEY) === GRID_VERSION
      ? readJSON(POS_KEY, {})
      : normalizePositions(root, iconList);
    iconList.forEach(el => makeDraggable(el, root, positions));
    return true;
  }

  function closeQuickSettings() {
    const direct = document.querySelector('#idk-complete-quick');
    const candidates = direct ? [direct] : [...document.querySelectorAll('[role="dialog"], .quick-settings, .quick-settings-panel, .idk-quick-settings, .control-center, .idk-control-center')];
    const panel = candidates.find(el => el && el.offsetParent !== null && (el.id === 'idk-complete-quick' || /quick settings|control center/i.test(el.textContent || '')));
    if (!panel || panel.querySelector('.idk-qs-close')) return;
    panel.style.position = panel.style.position || 'fixed';
    const btn = document.createElement('button');
    btn.className = 'idk-qs-close'; btn.type = 'button'; btn.setAttribute('aria-label', 'Close Quick Settings'); btn.title = 'Close Quick Settings'; btn.textContent = '×';
    btn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:20;width:32px;height:32px;padding:0;border:1px solid rgba(255,255,255,.3);border-radius:7px;background:rgba(10,25,55,.78);color:#fff;font:700 24px/28px Arial,sans-serif;cursor:pointer;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.35);';
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); panel.style.display = 'none'; });
    panel.appendChild(btn);
  }

  function normalizeTV() {
    const root = getIconsRoot(); if (!root) return;
    const els = [...root.querySelectorAll('*')].filter(el => el instanceof HTMLElement);
    const tv = els.find(el => /\bTV\b|television/i.test((el.textContent || '').trim()) || /\bTV\b|television/i.test(`${el.getAttribute('aria-label') || ''} ${el.title || ''}`));
    if (!tv) return;
    const icon = tv.closest('.desktop-icon,[data-app-id],[data-app],[data-id]') || tv;
    if (!root.contains(icon)) return;
    icon.style.setProperty('right', 'auto', 'important');
    icon.style.setProperty('bottom', 'auto', 'important');
    icon.style.setProperty('transform', 'none', 'important');
    icon.style.setProperty('position', 'absolute', 'important');
  }

  function boot() {
    const run = () => { setupDragging(); closeQuickSettings(); normalizeTV(); };
    run(); setTimeout(run, 250); setTimeout(run, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

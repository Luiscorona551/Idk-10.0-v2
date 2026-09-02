(() => {
  'use strict';

  const POS_KEY = 'idkDesktopIconPositions';
  const SUITE_KEY = 'idkCompleteSuiteState';
  let dragState = null;
  let initialized = false;

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
    return el.dataset.appId || el.dataset.app || el.getAttribute('data-id') ||
      el.getAttribute('aria-label') || el.title ||
      (el.querySelector('.icon-label,.label,.desktop-icon-label')?.textContent || '').trim();
  }

  function getIconsRoot() {
    return document.querySelector('#icons, .desktop-icons, .desktop-icon-area');
  }

  function desktopIcons(root) {
    return [...root.children].filter(el => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.matches('[data-window], .window, .taskbar, .dock, .start-menu')) return false;
      return !!(el.dataset.appId || el.dataset.app || el.getAttribute('data-id') ||
        el.querySelector('.icon-label,.label,.desktop-icon-label') ||
        /^(app|icon|desktop)/i.test(el.className || ''));
    });
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
      positions[key] = {
        left: Math.max(0, Math.round(r.left - rootRect.left)),
        top: Math.max(0, Math.round(r.top - rootRect.top))
      };
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
    el.style.position = 'absolute';

    const key = iconKey(el);
    applySaved(el, root, positions);

    el.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('button,input,textarea,select,a')) return;
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      dragState = {
        el, key, pointerId: e.pointerId,
        startX: e.clientX, startY: e.clientY,
        offsetX: e.clientX - elRect.left, offsetY: e.clientY - elRect.top,
        rootLeft: rootRect.left, rootTop: rootRect.top,
        moved: false
      };
      try { el.setPointerCapture(e.pointerId); } catch {}
    });

    el.addEventListener('pointermove', e => {
      if (!dragState || dragState.el !== el || dragState.pointerId !== e.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(dx, dy) < 5) return;
      dragState.moved = true;
      el.classList.add('idk-dragging');
      el.style.cursor = 'grabbing';
      const maxX = Math.max(0, root.clientWidth - el.offsetWidth);
      const maxY = Math.max(0, root.clientHeight - el.offsetHeight);
      const left = Math.max(0, Math.min(maxX, e.clientX - dragState.rootLeft - dragState.offsetX));
      const top = Math.max(0, Math.min(maxY, e.clientY - dragState.rootTop - dragState.offsetY));
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      e.preventDefault();
    });

    const finish = e => {
      if (!dragState || dragState.el !== el || dragState.pointerId !== e.pointerId) return;
      const wasMoved = dragState.moved;
      if (wasMoved) {
        positions[key] = { left: parseInt(el.style.left, 10) || 0, top: parseInt(el.style.top, 10) || 0 };
        savePositions(positions);
        el.dataset.idkDragged = '1';
        setTimeout(() => { delete el.dataset.idkDragged; }, 80);
      }
      el.classList.remove('idk-dragging');
      el.style.cursor = 'grab';
      try { el.releasePointerCapture(e.pointerId); } catch {}
      dragState = null;
    };
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
    el.addEventListener('click', e => {
      if (el.dataset.idkDragged === '1') { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
  }

  function setupDragging() {
    const root = getIconsRoot();
    if (!root) return false;
    const icons = desktopIcons(root);
    if (!icons.length) return false;
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    root.style.overflow = 'hidden';
    const positions = normalizePositions(root, icons);
    icons.forEach(el => makeDraggable(el, root, positions));
    initialized = true;
    return true;
  }

  function closeQuickSettings() {
    const candidates = [...document.querySelectorAll('[role="dialog"], .quick-settings, .quick-settings-panel, .idk-quick-settings, .control-center, .idk-control-center')];
    const panel = candidates.find(el => /quick settings|control center/i.test(el.textContent || '') && el.offsetParent !== null);
    if (!panel || panel.querySelector('.idk-qs-close')) return;
    const header = panel.querySelector('header,.panel-header,.title,.quick-settings-header') || panel.firstElementChild || panel;
    const btn = document.createElement('button');
    btn.className = 'idk-qs-close';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Close Quick Settings');
    btn.textContent = '×';
    btn.style.cssText = 'float:right;margin:0 0 0 8px;border:0;background:transparent;color:inherit;font-size:24px;line-height:1;cursor:pointer;padding:2px 7px;border-radius:7px;';
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); panel.style.display = 'none'; });
    header.appendChild(btn);
  }

  function normalizeTV() {
    const els = [...document.querySelectorAll('#icons *')].filter(el => el instanceof HTMLElement);
    const tv = els.find(el => {
      const text = (el.textContent || '').trim();
      const label = `${el.getAttribute('aria-label') || ''} ${el.title || ''}`;
      return /\bTV\b|television/i.test(text) || /\bTV\b|television/i.test(label);
    });
    if (!tv) return;
    let icon = tv.closest('[data-app-id],[data-app],[data-id]') || tv.closest('.desktop-icon,.app-icon,.icon') || tv;
    const root = getIconsRoot();
    if (!root || !root.contains(icon)) return;
    icon.style.right = 'auto';
    icon.style.bottom = 'auto';
    icon.style.transform = 'none';
    icon.style.position = 'absolute';
    if (!icon.style.left && !icon.style.top) {
      const occupied = desktopIcons(root).filter(x => x !== icon);
      const index = Math.min(occupied.length, 6);
      icon.style.left = `${20 + (index % 2) * 92}px`;
      icon.style.top = `${20 + Math.floor(index / 2) * 92}px`;
    }
  }

  function observe() {
    const observer = new MutationObserver(() => {
      closeQuickSettings();
      normalizeTV();
      if (!initialized) setupDragging();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class'] });
    window.addEventListener('resize', () => { if (setupDragging()) normalizeTV(); });
    window.addEventListener('idk-account-restored', () => setTimeout(() => { initialized = false; setupDragging(); }, 100));
  }

  function boot() {
    const run = () => { setupDragging(); closeQuickSettings(); normalizeTV(); };
    run();
    setTimeout(run, 250);
    setTimeout(run, 1000);
    observe();
  }

  const style = document.createElement('style');
  style.textContent = '#icons .idk-dragging{z-index:9999!important;filter:brightness(1.08);transform:scale(1.03);transition:none!important}.idk-qs-close:hover{background:rgba(127,127,127,.18)!important}';
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

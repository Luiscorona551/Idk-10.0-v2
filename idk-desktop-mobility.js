(() => {
  'use strict';

  const POS_KEY = 'idkDesktopIconPositions';
  const SUITE_KEY = 'idkCompleteSuiteState';
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
    return el.dataset.appId || el.dataset.app || el.getAttribute('data-id') ||
      el.getAttribute('aria-label') || el.title ||
      (el.querySelector('.icon-label,.label,.desktop-icon-label')?.textContent || '').trim();
  }

  function getIconsRoot() {
    return document.querySelector('#icons, .desktop-icons, .desktop-icon-area');
  }

  function desktopIcons(root) {
    return [...root.children].filter(el => el instanceof HTMLElement && (
      el.classList.contains('desktop-icon') || el.dataset.appId || el.dataset.app || el.getAttribute('data-id')
    ));
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
    el.style.width = '84px';
    el.style.minWidth = '84px';
    el.style.minHeight = '78px';
    el.style.height = 'auto';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'flex-start';
    el.style.padding = '6px 4px 5px';
    el.style.textAlign = 'center';
    el.style.lineHeight = '1.15';
    el.style.overflow = 'visible';

    const glyph = el.querySelector('.glyph');
    const label = el.querySelector('.label');
    if (glyph) {
      glyph.style.display = 'block';
      glyph.style.width = '44px';
      glyph.style.height = '44px';
      glyph.style.flex = '0 0 44px';
      glyph.style.margin = '0 auto 4px';
    }
    if (label) {
      label.style.display = 'block';
      label.style.width = '100%';
      label.style.maxWidth = '84px';
      label.style.minHeight = '30px';
      label.style.whiteSpace = 'normal';
      label.style.overflow = 'visible';
      label.style.textOverflow = 'clip';
      label.style.wordBreak = 'normal';
    }

    const key = iconKey(el);
    applySaved(el, root, positions);

    el.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
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
      el.style.left = `${Math.max(0, Math.min(maxX, e.clientX - dragState.rootLeft - dragState.offsetX))}px`;
      el.style.top = `${Math.max(0, Math.min(maxY, e.clientY - dragState.rootTop - dragState.offsetY))}px`;
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
    root.style.overflow = 'visible';
    const positions = normalizePositions(root, icons);
    icons.forEach(el => makeDraggable(el, root, positions));
    return true;
  }

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
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      panel.style.display = 'none';
    });
    panel.appendChild(btn);
  }

  function normalizeTV() {
    const root = getIconsRoot();
    if (!root) return;
    const els = [...root.querySelectorAll('*')].filter(el => el instanceof HTMLElement);
    const tv = els.find(el => {
      const text = (el.textContent || '').trim();
      const label = `${el.getAttribute('aria-label') || ''} ${el.title || ''}`;
      return /\bTV\b|television/i.test(text) || /\bTV\b|television/i.test(label);
    });
    if (!tv) return;
    const icon = tv.closest('.desktop-icon,[data-app-id],[data-app],[data-id]') || tv;
    if (!root.contains(icon)) return;
    icon.style.right = 'auto';
    icon.style.bottom = 'auto';
    icon.style.transform = 'none';
    icon.style.position = 'absolute';
    icon.style.width = '84px';
    icon.style.minWidth = '84px';
  }

  function observe() {
    const observer = new MutationObserver(() => {
      closeQuickSettings();
      normalizeTV();
      setupDragging();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class','hidden'] });
    window.addEventListener('resize', () => { setupDragging(); normalizeTV(); });
    window.addEventListener('idk-account-restored', () => setTimeout(() => { setupDragging(); closeQuickSettings(); }, 100));
  }

  function boot() {
    const run = () => { setupDragging(); closeQuickSettings(); normalizeTV(); };
    run();
    setTimeout(run, 250);
    setTimeout(run, 1000);
    observe();
  }

  const style = document.createElement('style');
  style.textContent = '#icons .desktop-icon.idk-dragging{z-index:9999!important;filter:brightness(1.08);transform:scale(1.03);transition:none!important}.idk-qs-close:hover{background:rgba(60,110,190,.95)!important}.idk-qs-close:focus-visible{outline:2px solid #7eb8ff;outline-offset:2px}';
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();

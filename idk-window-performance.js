(() => {
  'use strict';
  if (window.IDKWindowManager) return;

  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const MODE_KEY = 'idkPerformanceMode';
  const SESSION_KEY = 'idkWindowSession';
  let saveTimer = 0;
  let cycleIndex = -1;

  const allWindows = () => [...document.querySelectorAll('#windows .window')];
  const visibleWindows = () => allWindows().filter(win => !win.hidden && !win.classList.contains('minimized'));
  const activeWindow = () => visibleWindows().sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0] || null;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveSession, 140); };

  function saveSession() {
    const windows = allWindows().map(win => ({ appId: win.dataset.app, left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height, classes: ['minimized', 'maximized', 'snapped-left', 'snapped-right'].filter(name => win.classList.contains(name)) })).filter(item => item.appId);
    write(SESSION_KEY, { version: 1, updatedAt: Date.now(), windows });
  }

  function focus(win) {
    if (!win) return;
    if (window.OS?.focus) {
      window.OS.focus(win);
      cycleIndex = -1;
      saveSoon();
      return;
    }
    const highest = Math.max(10, ...allWindows().map(item => Number(item.style.zIndex || 0)));
    allWindows().forEach(item => item.classList.remove('focused'));
    win.style.zIndex = String(highest + 1);
    win.classList.add('focused');
    win.classList.remove('minimized');
    cycleIndex = -1;
    saveSoon();
  }

  function free(win) {
    if (!win) return;
    const saved = win.dataset.idkFreeGeometry ? JSON.parse(win.dataset.idkFreeGeometry) : null;
    win.classList.remove('idk-tile-window', 'minimized', 'maximized', 'snapped-left', 'snapped-right');
    if (saved) Object.entries(saved).forEach(([key, value]) => { win.style[key] = value; });
    delete win.dataset.idkFreeGeometry;
  }

  function slot(win, geometry) {
    if (!win.dataset.idkFreeGeometry) win.dataset.idkFreeGeometry = JSON.stringify({ left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height });
    win.classList.remove('maximized', 'snapped-left', 'snapped-right', 'minimized');
    win.classList.add('idk-tile-window');
    Object.entries(geometry).forEach(([key, value]) => { win.style[key] = value; });
  }

  function tileLayout(mode = 'grid') {
    const windows = visibleWindows();
    if (!windows.length) return notify('Window layout', 'Open at least one window first.');
    const active = activeWindow();
    if (mode === 'focus') {
      windows.forEach(win => { if (win === active) slot(win, { left: '0px', top: '0px', width: '100%', height: 'calc(100% - 84px)' }); else win.classList.add('minimized'); });
    } else if (mode === 'split' && windows.length > 1) {
      const ordered = [active, ...windows.filter(win => win !== active)];
      slot(ordered[0], { left: '0px', top: '0px', width: '50%', height: 'calc(100% - 84px)' });
      const side = ordered.slice(1), height = `calc(${100 / side.length}% - ${Math.round(84 / side.length)}px)`;
      side.forEach((win, index) => slot(win, { left: '50%', top: index ? `calc(${index * 100 / side.length}% - ${Math.round(index * 84 / side.length)}px)` : '0px', width: '50%', height }));
    } else {
      const columns = windows.length <= 1 ? 1 : windows.length <= 4 ? 2 : 3;
      const rows = Math.ceil(windows.length / columns);
      windows.forEach((win, index) => { const row = Math.floor(index / columns), column = index % columns; slot(win, { left: `${column * 100 / columns}%`, top: row ? `calc(${row * 100 / rows}% - ${Math.round(row * 84 / rows)}px)` : '0px', width: `${100 / columns}%`, height: `calc(${100 / rows}% - ${Math.round(84 / rows)}px)` }); });
    }
    write('idkWindowLayout', mode);
    saveSession();
    notify('Window layout', `${mode[0].toUpperCase()}${mode.slice(1)} layout applied.`, 'success');
  }

  function restoreGeometry() {
    allWindows().forEach(win => { win.classList.remove('idk-tile-window'); free(win); });
    write('idkWindowLayout', 'free');
    saveSession();
  }

  function minimizeAll() { visibleWindows().forEach(win => win.classList.add('minimized')); saveSession(); notify('Window manager', 'All windows minimized.', 'success'); }
  function restoreAll() { allWindows().forEach(win => win.classList.remove('minimized')); saveSession(); }

  function cycle(reverse = false) {
    const windows = allWindows().sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0));
    if (!windows.length) return;
    cycleIndex = cycleIndex < 0 ? 0 : (cycleIndex + (reverse ? 1 : -1) + windows.length) % windows.length;
    focus(windows[cycleIndex]);
  }

  function handleShortcut(event) {
    if (event.altKey && event.key === 'Tab') { event.preventDefault(); event.stopImmediatePropagation(); cycle(event.shiftKey); return true; }
    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'm') { event.preventDefault(); event.stopImmediatePropagation(); minimizeAll(); return true; }
    if (event.ctrlKey && event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); event.stopImmediatePropagation(); tileLayout('split'); return true; }
    if (event.ctrlKey && event.altKey && event.key === 'ArrowRight') { event.preventDefault(); event.stopImmediatePropagation(); tileLayout('grid'); return true; }
    if (event.ctrlKey && event.altKey && event.key === 'ArrowUp') { event.preventDefault(); event.stopImmediatePropagation(); tileLayout('focus'); return true; }
    if (event.ctrlKey && event.altKey && event.key === 'ArrowDown') { event.preventDefault(); event.stopImmediatePropagation(); restoreGeometry(); return true; }
    return false;
  }

  function performanceMode() { return read(MODE_KEY, 'balanced'); }
  function applyPerformance() {
    const mode = performanceMode();
    document.documentElement.dataset.idkPerformance = mode;
    const desktop = document.getElementById('desktop');
    desktop?.classList.toggle('idk-performance-saver', mode === 'saver');
    document.querySelectorAll('iframe').forEach(frame => { frame.loading ||= 'lazy'; });
    document.querySelectorAll('img').forEach(image => { if (!image.closest('#flag-badge,#echo-companion')) image.loading ||= 'lazy'; image.decoding ||= 'async'; });
    if (mode === 'saver') document.querySelectorAll('.window.minimized audio,.window.minimized video').forEach(media => media.pause());
  }

  async function metrics() {
    const storage = await navigator.storage?.estimate?.().catch?.(() => ({})) || {};
    const memory = performance.memory;
    return { mode: performanceMode(), windows: allWindows().length, visibleWindows: visibleWindows().length, domNodes: document.getElementsByTagName('*').length, storage: storage.quota ? `${Math.round((storage.usage || 0) / storage.quota * 100)}% used` : 'Unavailable', heap: memory ? `${Math.round(memory.usedJSHeapSize / 1024 / 1024)} MB JS heap` : 'Browser does not expose JS heap', deviceMemory: navigator.deviceMemory ? `${navigator.deviceMemory} GB device estimate` : 'Unavailable' };
  }

  function openPerformanceCenter() {
    document.getElementById('idk-performance-center')?.remove();
    const root = document.createElement('section'); root.id = 'idk-performance-center'; root.className = 'idk-performance-modal'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.innerHTML = '<div class="idk-performance-card"><header><div><strong>Performance Center</strong><small>Window layout, resource usage, and recovery</small></div><button type="button" data-close aria-label="Close">×</button></header><div class="idk-performance-body"><label>Performance mode<select class="field" data-mode><option value="saver">Saver</option><option value="balanced">Balanced</option><option value="performance">Performance</option></select></label><div class="idk-performance-metrics" data-metrics></div><div class="idk-performance-actions"><button class="btn" data-split>Split layout</button><button class="btn tab" data-grid>Grid layout</button><button class="btn tab" data-focus>Focus window</button><button class="btn tab" data-free>Free layout</button><button class="btn tab" data-minimize>Minimize all</button><button class="btn tab" data-restore>Restore windows</button><button class="btn tab" data-session>Restore last session</button></div><p class="idk-performance-status" data-status>Ready</p></div></div>';
    document.body.append(root);
    const mode = root.querySelector('[data-mode]'), metricsView = root.querySelector('[data-metrics]'), status = root.querySelector('[data-status]');
    mode.value = performanceMode();
    const render = () => metrics().then(data => { metricsView.innerHTML = Object.entries(data).map(([name, value]) => `<article><strong>${esc(value)}</strong><small>${esc(name)}</small></article>`).join(''); });
    root.querySelector('[data-close]').onclick = () => root.remove();
    mode.onchange = () => { write(MODE_KEY, mode.value); applyPerformance(); status.textContent = `${mode.value} mode applied.`; render(); };
    root.querySelector('[data-split]').onclick = () => tileLayout('split');
    root.querySelector('[data-grid]').onclick = () => tileLayout('grid');
    root.querySelector('[data-focus]').onclick = () => tileLayout('focus');
    root.querySelector('[data-free]').onclick = restoreGeometry;
    root.querySelector('[data-minimize]').onclick = minimizeAll;
    root.querySelector('[data-restore]').onclick = restoreAll;
    root.querySelector('[data-session]').onclick = () => { const session = read(SESSION_KEY, null); if (!session?.windows?.length) return status.textContent = 'No saved window session is available.'; write('idkWorkspace', session.windows); window.OS?.restoreWorkspace?.({ quiet: false }); status.textContent = 'The last window session is being restored.'; };
    render();
    return root;
  }

  function installStatusTools() {
    const status = document.getElementById('idk-perfect-status');
    if (!status || status.querySelector('[data-window-layout]')) return;
    const layout = document.createElement('button'); layout.type = 'button'; layout.dataset.windowLayout = 'true'; layout.textContent = 'Grid'; layout.title = 'Apply grid window layout'; layout.onclick = () => tileLayout('grid');
    const performanceButton = document.createElement('button'); performanceButton.type = 'button'; performanceButton.dataset.performance = 'true'; performanceButton.textContent = 'Performance'; performanceButton.onclick = openPerformanceCenter;
    status.append(layout, performanceButton);
  }

  function install() {
    applyPerformance();
    installStatusTools();
    document.addEventListener('keydown', handleShortcut, true);
    document.addEventListener('pointerdown', event => { const win = event.target.closest?.('#windows .window'); if (!win) return; if (win.classList.contains('idk-tile-window') && event.target.closest('.titlebar')) free(win); focus(win); }, true);
    const observer = new MutationObserver(() => { applyPerformance(); saveSoon(); });
    const layer = document.getElementById('windows');
    if (layer) observer.observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('pagehide', saveSession);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveSession(); });
    if (window.requestIdleCallback) requestIdleCallback(applyPerformance, { timeout: 1500 });
  }

  window.IDKWindowManager = { tileLayout, minimizeAll, restoreAll, restoreGeometry, cycle, handleShortcut, openPerformanceCenter, metrics, saveSession };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

(() => {
  'use strict';

  const card = (label, value, detail = '') => {
    const item = document.createElement('article');
    item.className = 'idk-monitor-card';
    const name = document.createElement('small');
    name.textContent = label;
    const main = document.createElement('strong');
    main.textContent = value;
    item.append(name, main);
    if (detail) item.append(Object.assign(document.createElement('small'), { textContent: detail }));
    return item;
  };

  const button = (label, action, className = 'btn tab') => {
    const item = document.createElement('button');
    item.className = className;
    item.type = 'button';
    item.textContent = label;
    item.addEventListener('click', action);
    return item;
  };

  const formatBytes = value => {
    if (!Number.isFinite(value) || value <= 0) return 'Unavailable';
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  async function readHealth() {
    const health = await window.IDKDataLayer?.health?.().catch?.(() => ({})) || {};
    const metrics = await window.IDKWindowManager?.metrics?.().catch?.(() => ({})) || {};
    return { health, metrics, apps: health.apps || {} };
  }

  function systemMonitorApp() {
    const root = document.createElement('div');
    root.className = 'app idk-monitor';
    const refresh = button('Refresh', () => render(), 'btn');
    const grid = document.createElement('div');
    grid.className = 'idk-monitor-grid';
    const stamp = document.createElement('p');
    stamp.className = 'idk-monitor-note';
    const actions = document.createElement('div');
    actions.className = 'idk-monitor-actions';
    actions.append(
      button('Performance Center', () => window.IDKWindowManager?.openPerformanceCenter?.()),
      button('Cloud Sync', () => window.IDKDataLayer?.openSyncCenter?.()),
      button('Save Workspace', () => window.OS?.saveWorkspace?.()),
      button('Open Files', () => window.OS?.open?.('files'))
    );
    root.append(
      Object.assign(document.createElement('header'), { className: 'idk-monitor-header' }),
      grid,
      actions,
      stamp
    );
    const header = root.querySelector('.idk-monitor-header');
    const heading = document.createElement('div');
    heading.append(Object.assign(document.createElement('h2'), { textContent: 'System Monitor' }), Object.assign(document.createElement('p'), { textContent: 'A live view of the IDK desktop and browser storage.' }));
    header.append(heading, refresh);

    let rendering = false;
    async function render() {
      if (rendering) return;
      rendering = true;
      refresh.disabled = true;
      const { health, metrics, apps } = await readHealth();
      const usage = health.quota ? `${Math.round((health.usage || 0) / health.quota * 100)}%` : 'Unavailable';
      const sync = !health.online ? 'Offline' : health.account ? (health.pending ? `${health.pending} pending` : 'Cloud ready') : 'Local only';
      grid.replaceChildren(
        card('Open windows', String(metrics.windows ?? document.querySelectorAll('#windows .window').length), `${metrics.visibleWindows ?? 0} visible`),
        card('Storage', usage, `${formatBytes(health.usage)} used of ${formatBytes(health.quota)}`),
        card('Sync', sync, health.online ? 'Network available' : 'Changes stay local'),
        card('Files', String(apps.files ?? health.files ?? 0), `${apps.folders ?? 0} folders`),
        card('Work queue', String(apps.activeTasks ?? 0), `${apps.tasks ?? 0} total tasks · ${apps.notes ?? 0} notes`),
        card('Browser', String(apps.browserHistory ?? 0), `${apps.browserBookmarks ?? 0} bookmarks`),
        card('DOM nodes', String(metrics.domNodes ?? 'Unavailable'), 'Browser-observable UI size'),
        card('Memory', metrics.heap || 'Unavailable', 'Browser-reported JavaScript heap')
      );
      stamp.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}. CPU and process-level metrics are not exposed by the browser.`;
      refresh.disabled = false;
      rendering = false;
    }
    const queueRender = () => setTimeout(render, 0);
    const timer = setInterval(render, 10000);
    window.addEventListener('idk-data-changed', queueRender);
    window.addEventListener('idk-sync-status', queueRender);
    root.cleanup = () => { clearInterval(timer); window.removeEventListener('idk-data-changed', queueRender); window.removeEventListener('idk-sync-status', queueRender); };
    render();
    return root;
  }

  function installTaskbar() {
    const desktop = document.getElementById('desktop');
    const layer = document.getElementById('windows');
    if (!desktop || !layer || document.getElementById('idk-taskbar')) return;
    const taskbar = document.createElement('div');
    taskbar.id = 'idk-taskbar';
    taskbar.setAttribute('role', 'toolbar');
    taskbar.setAttribute('aria-label', 'Open windows');
    desktop.append(taskbar);
    const render = () => {
      taskbar.replaceChildren();
      [...layer.querySelectorAll('.window')].forEach(win => {
        const item = document.createElement('button');
        item.className = `idk-taskbar-item${win.classList.contains('focused') ? ' active' : ''}${win.classList.contains('minimized') ? ' minimized' : ''}`;
        item.type = 'button';
        item.title = win.querySelector('.title')?.textContent || win.dataset.app || 'Window';
        item.append(Object.assign(document.createElement('span'), { className: 'idk-taskbar-glyph', textContent: '□' }), Object.assign(document.createElement('span'), { textContent: item.title }));
        item.onclick = () => window.OS?.focus?.(win);
        taskbar.append(item);
      });
    };
    const observer = new MutationObserver(render);
    observer.observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', render, { passive: true });
    render();
  }

  window.IDKBatchFive = { systemMonitor: systemMonitorApp, installTaskbar };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installTaskbar, { once: true });
  else installTaskbar();
})();

(() => {
  'use strict';
  if (window.IDKFinalUpgrades) return;

  const read = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const one = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const notify = (title, message) => window.OS?.notify?.(title, message);
  let menu = null;
  let widgetTimer = 0;
  let widgetPanel = null;

  function button(text, action, className = '') {
    const b = document.createElement('button');
    b.type = 'button'; b.className = className; b.textContent = text; b.addEventListener('click', action); return b;
  }

  function widgetConfig() {
    const saved = read('idkWidgetConfig', {});
    return { clock: true, tasks: true, note: true, system: true, ...saved };
  }

  function widgetValues() {
    const tasks = read('idkTodos', []);
    const feature = read('idkFeaturePackState', {});
    return {
      clock: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      tasks: Array.isArray(tasks) ? tasks.filter(task => !task.done).length : 0,
      note: feature.note || 'No quick note yet.',
      system: navigator.onLine ? 'Online · local apps ready' : 'Offline · local apps available'
    };
  }

  function renderWidgets() {
    if (widgetPanel) { widgetPanel.remove(); widgetPanel = null; clearInterval(widgetTimer); widgetTimer = 0; return; }
    const config = widgetConfig();
    widgetPanel = document.createElement('aside');
    widgetPanel.id = 'idk-upgrade-widgets';
    widgetPanel.setAttribute('aria-label', 'Desktop widgets');
    widgetPanel.innerHTML = `<div class="idk-upgrade-widget-head"><strong>Desktop widgets</strong><button type="button" data-close aria-label="Close widgets">×</button></div><div class="idk-upgrade-widget-list"></div>`;
    const list = widgetPanel.querySelector('.idk-upgrade-widget-list');
    const render = () => {
      const values = widgetValues();
      list.replaceChildren();
      [['clock', 'Time', values.clock], ['tasks', 'Tasks', `${values.tasks} open`], ['note', 'Quick note', values.note], ['system', 'System', values.system]].forEach(([id, title, value]) => {
        if (!config[id]) return;
        const card = document.createElement('section'); card.className = `idk-upgrade-widget idk-widget-${id}`;
        card.innerHTML = `<strong>${esc(title)}</strong><span>${esc(value)}</span>`; list.append(card);
      });
      const edit = button('Edit widgets', openWidgetEditor, 'idk-upgrade-widget-edit'); list.append(edit);
    };
    widgetPanel.querySelector('[data-close]').onclick = () => renderWidgets();
    document.body.append(widgetPanel); render(); widgetTimer = window.setInterval(render, 30000);
  }

  function openWidgetEditor() {
    document.getElementById('idk-widget-editor')?.remove();
    const config = widgetConfig();
    const editor = document.createElement('section'); editor.id = 'idk-widget-editor'; editor.setAttribute('role', 'dialog'); editor.setAttribute('aria-label', 'Edit desktop widgets');
    editor.innerHTML = '<div class="idk-upgrade-editor-head"><strong>Edit widgets</strong><button type="button" data-close aria-label="Close">×</button></div><p>Choose what appears on your desktop.</p><div class="idk-widget-checks"></div>';
    const checks = editor.querySelector('.idk-widget-checks');
    [['clock', 'Time'], ['tasks', 'Open tasks'], ['note', 'Quick note'], ['system', 'System status']].forEach(([id, label]) => {
      const row = document.createElement('label'); row.innerHTML = `<span>${label}</span><input type="checkbox" ${config[id] ? 'checked' : ''}>`;
      row.querySelector('input').onchange = event => { config[id] = event.target.checked; write('idkWidgetConfig', config); };
      checks.append(row);
    });
    editor.querySelector('[data-close]').onclick = () => editor.remove(); document.body.append(editor);
  }

  function toggleContrast() {
    const active = !document.body.classList.contains('idk-high-contrast');
    document.body.classList.toggle('idk-high-contrast', active); write('idkHighContrast', active); notify('Accessibility', active ? 'High contrast is on.' : 'High contrast is off.');
  }

  function showMenu(x, y, items) {
    menu?.remove(); menu = document.createElement('menu'); menu.id = 'idk-upgrade-context'; menu.setAttribute('role', 'menu');
    items.forEach(item => { const b = button(item.label, () => { menu?.remove(); menu = null; item.action(); }, 'idk-context-item'); b.setAttribute('role', 'menuitem'); menu.append(b); });
    menu.style.left = `${Math.min(x, innerWidth - 230)}px`; menu.style.top = `${Math.min(y, innerHeight - items.length * 40 - 20)}px`; document.body.append(menu);
  }

  function renameIcon(icon) {
    const current = icon.querySelector('.label,.icon-label,.desktop-icon-label,:scope > label')?.textContent?.trim() || icon.title || 'Shortcut';
    const next = window.prompt('Rename shortcut', current); if (!next?.trim()) return;
    const label = icon.querySelector('.label,.icon-label,.desktop-icon-label,:scope > label');
    if (label) label.textContent = next.trim(); icon.title = next.trim(); icon.setAttribute('aria-label', next.trim());
    const id = icon.dataset.app || icon.dataset.finalApp || current; const labels = read('idkDesktopLabels', {}); labels[id] = next.trim(); write('idkDesktopLabels', labels);
  }

  function iconMenu(icon, event) {
    const app = icon.dataset.app;
    const finalApp = icon.dataset.finalApp;
    const items = [{ label: 'Open', action: () => app ? window.OS?.open(app) : finalApp === 'sheets' ? window.IDKSheets?.open?.() : window.IdkMessenger?.open?.() }, { label: 'Rename', action: () => renameIcon(icon) }];
    if (icon.classList.contains('idk-installed-shortcut')) items.push({ label: 'Remove shortcut', action: () => { icon.remove(); notify('Desktop', 'Shortcut removed.'); } });
    showMenu(event.clientX, event.clientY, items);
  }

  function desktopMenu(event) {
    const icon = event.target.closest('#icons .desktop-icon,#icons .idk-installed-shortcut,#icons .idk-final-desktop-icon');
    if (icon) { event.preventDefault(); event.stopPropagation(); iconMenu(icon, event); return; }
    if (event.target.closest('#windows,#dock,#start-menu,#idk-upgrade-widgets,#idk-widget-editor')) return;
    event.preventDefault();
    showMenu(event.clientX, event.clientY, [
      { label: 'Open widgets', action: renderWidgets },
      { label: 'Edit widgets', action: openWidgetEditor },
      { label: 'Command palette', action: openPalette },
      { label: 'Settings', action: () => window.OS?.open('settings') },
      { label: 'Switch to Desktop 1', action: () => window.IDKFeaturePack?.switchSpace(1) },
      { label: 'Switch to Desktop 2', action: () => window.IDKFeaturePack?.switchSpace(2) },
      { label: 'Switch to Desktop 3', action: () => window.IDKFeaturePack?.switchSpace(3) },
      { label: document.body.classList.contains('idk-high-contrast') ? 'Turn off high contrast' : 'Turn on high contrast', action: toggleContrast },
      { label: 'Reset desktop layout', action: () => { localStorage.removeItem('desktopOrder'); localStorage.removeItem('idkDesktopIconPositions'); location.reload(); } }
    ]);
  }

  function openPalette() {
    document.getElementById('idk-command-palette')?.remove();
    const panel = document.createElement('section'); panel.id = 'idk-command-palette'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Command palette');
    panel.innerHTML = '<div class="idk-upgrade-editor-head"><strong>Command palette</strong><button type="button" data-close aria-label="Close">×</button></div><input class="field" data-query placeholder="Search apps or actions…" autocomplete="off"><div class="idk-command-results"></div>';
    const query = panel.querySelector('[data-query]'); const results = panel.querySelector('.idk-command-results');
    const actions = [
      { title: 'Open widgets', run: renderWidgets }, { title: 'Edit widgets', run: openWidgetEditor }, { title: 'Open Settings', run: () => window.OS?.open('settings') },
      { title: 'Open Files', run: () => window.OS?.open('files') }, { title: 'Open Browser', run: () => window.OS?.open('proxy') }, { title: 'Toggle high contrast', run: toggleContrast },
      ...Object.entries(APPS).filter(([id]) => id !== 'player').map(([id, app]) => ({ title: `Open ${app.title}`, run: () => window.OS?.open(id) }))
    ];
    const render = () => { const q = query.value.toLowerCase().trim(); results.replaceChildren(...actions.filter(item => !q || item.title.toLowerCase().includes(q)).slice(0, 20).map(item => button(item.title, () => { panel.remove(); item.run(); }, 'idk-command-item'))); };
    query.addEventListener('input', render); panel.querySelector('[data-close]').onclick = () => panel.remove(); document.body.append(panel); render(); query.focus();
  }

  function enhanceSettings(win) {
    if (win.dataset.idkUpgradeSettings) return;
    const app = win.querySelector('.content .app'); if (!app || win.dataset.app !== 'settings') return;
    win.dataset.idkUpgradeSettings = '1';
    const bar = document.createElement('div'); bar.className = 'idk-settings-upgrades';
    bar.append(button('Reset appearance', () => { localStorage.removeItem('theme'); localStorage.removeItem('idkCustomTheme'); location.reload(); }), button('Reset desktop layout', () => { localStorage.removeItem('desktopOrder'); localStorage.removeItem('idkDesktopIconPositions'); location.reload(); }));
    app.append(bar);
  }

  function enhanceMessenger(root) {
    if (root.dataset.idkUpgradeMessenger) return;
    root.dataset.idkUpgradeMessenger = '1';
    const members = root.querySelector('.idk-live-members'); const dmTab = root.querySelector('[data-tab="dm"]'); const dmPane = root.querySelector('[data-pane="dm"]');
    if (!members || !dmTab || !dmPane) return;
    const search = document.createElement('input'); search.className = 'field idk-dm-search'; search.placeholder = 'Find a person…'; search.setAttribute('aria-label', 'Find a person'); members.insertBefore(search, members.querySelector('[data-members]'));
    const badge = document.createElement('b'); badge.className = 'idk-dm-unread'; badge.hidden = true; badge.textContent = '0'; dmTab.append(badge);
    const filter = () => { const q = search.value.toLowerCase(); members.querySelectorAll('.idk-live-member').forEach(item => { item.hidden = !item.textContent.toLowerCase().includes(q); }); }; search.addEventListener('input', filter);
    let unread = 0; dmTab.addEventListener('click', () => { unread = 0; badge.hidden = true; });
    const decorate = () => { dmPane.querySelectorAll('.idk-live-message').forEach(message => { if (message.querySelector('.idk-reaction')) return; const reaction = button('♡ 0', () => { const active = reaction.classList.toggle('active'); reaction.textContent = `${active ? '♥' : '♡'} ${active ? 1 : 0}`; }, 'idk-reaction'); message.append(reaction); }); if (dmPane.hidden && dmPane.querySelector('.idk-live-message')) { unread += 1; badge.textContent = String(unread); badge.hidden = false; } };
    new MutationObserver(decorate).observe(dmPane, { childList: true, subtree: true });
  }

  function install() {
    const desktop = one('#desktop'); if (!desktop) return;
    document.body.classList.toggle('idk-high-contrast', read('idkHighContrast', false));
    const widgets = document.createElement('button'); widgets.id = 'idk-upgrade-widgets-toggle'; widgets.type = 'button'; widgets.textContent = '▦'; widgets.title = 'Desktop widgets'; widgets.setAttribute('aria-label', 'Desktop widgets'); widgets.onclick = renderWidgets; desktop.append(widgets);
    desktop.addEventListener('contextmenu', desktopMenu, true);
    desktop.addEventListener('click', () => { menu?.remove(); menu = null; });
    desktop.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); desktop.classList.add('idk-drop-target'); } }, true);
    desktop.addEventListener('dragleave', event => { if (!desktop.contains(event.relatedTarget)) desktop.classList.remove('idk-drop-target'); }, true);
    desktop.addEventListener('drop', async event => { const files = [...(event.dataTransfer?.files || [])]; if (!files.length || event.target.closest('#windows input,textarea,select')) return; event.preventDefault(); desktop.classList.remove('idk-drop-target'); try { await window.SYSTEM_APPS?.importFiles?.(files); window.OS?.open('files'); } catch (error) { notify('Files', error.message); } }, true);
    window.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); event.stopImmediatePropagation(); openPalette(); } if (event.key === 'Escape') { menu?.remove(); menu = null; } }, true);
    const windows = one('#windows'); if (windows) new MutationObserver(() => { windows.querySelectorAll('.window').forEach(enhanceSettings); document.querySelectorAll('.idk-live-messenger').forEach(enhanceMessenger); }).observe(windows, { childList: true });
    new MutationObserver(() => document.querySelectorAll('.idk-live-messenger').forEach(enhanceMessenger)).observe(document.body, { childList: true });
    document.querySelectorAll('#icons .desktop-icon').forEach(icon => { if (!icon.getAttribute('aria-label')) icon.setAttribute('aria-label', icon.title || icon.textContent.trim()); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
  window.IDKFinalUpgrades = { openPalette, renderWidgets, openWidgetEditor, toggleContrast };
})();

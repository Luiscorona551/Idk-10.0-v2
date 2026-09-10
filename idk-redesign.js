(() => {
  'use strict';
  if (window.IDKRedesign) return;

  const navItems = [
    ['home', '⌂', 'Home'],
    ['apps', '▦', 'Apps'],
    ['calls', '☎', 'Calls'],
    ['games', '◈', 'Games'],
    ['files', '□', 'Files']
  ];
  const appAliases = {
    apps: ['apps', 'appCenter', 'appsHub'],
    calls: ['calls'],
    games: ['games'],
    files: ['files']
  };
  const appRegistry = () => (typeof APPS !== 'undefined' ? APPS : {});

  const create = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    });
    node.append(...children);
    return node;
  };

  function openApp(id) {
    const apps = appRegistry();
    const target = (appAliases[id] || [id]).find(candidate => apps[candidate]);
    if (target) window.OS?.open?.(target);
  }

  function createHome() {
    if (document.getElementById('idk-redesign-home')) return document.getElementById('idk-redesign-home');
    const root = create('section', { id: 'idk-redesign-home', 'aria-label': 'IDK home' });
    root.innerHTML = '<div class="idk-redesign-home-card"><p class="idk-redesign-kicker">IDK 10.0 / workspace</p><h1>A calmer way to use your desktop.</h1><p>Open the tools you use most, keep your files close, and move between play, calls, and focus without losing your place.</p><div class="idk-redesign-quick-actions"><button class="idk-redesign-quick-action" data-redesign-open="calls"><span>☎</span>Start a call</button><button class="idk-redesign-quick-action" data-redesign-open="games"><span>◈</span>Play a game</button><button class="idk-redesign-quick-action" data-redesign-open="files"><span>□</span>Open Files</button><button class="idk-redesign-quick-action" data-redesign-open="downloads"><span>↓</span>Downloads</button></div><div class="idk-redesign-home-meta"><div><strong data-redesign-app-count>0</strong><span>available apps</span></div><div><strong data-redesign-recent-count>0</strong><span>recent spaces</span></div><div><strong>Local</strong><span>workspace ready</span></div></div></div>';
    root.querySelectorAll('[data-redesign-open]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.redesignOpen;
      if (id === 'downloads') window.OS?.open?.('downloads');
      else if (id === 'files') openApp('files');
      else openApp(id);
      setHomeVisible(false);
    }));
    document.getElementById('desktop')?.append(root);
    return root;
  }

  function createNav() {
    if (document.getElementById('idk-redesign-nav')) return document.getElementById('idk-redesign-nav');
    const nav = create('nav', { id: 'idk-redesign-nav', 'aria-label': 'IDK navigation' });
    const brand = create('div', { class: 'idk-redesign-brand' }, [
      create('span', { class: 'idk-redesign-mark', text: 'IDK' }),
      create('span', { class: 'idk-redesign-brand-copy' }, [create('strong', { text: 'IDK 10.0' }), create('small', { text: 'your workspace' })])
    ]);
    const list = create('div', { class: 'idk-redesign-nav-list' });
    navItems.forEach(([id, glyph, label], index) => {
      const button = create('button', { class: `idk-redesign-nav-button${index === 0 ? ' active' : ''}`, type: 'button', 'data-redesign-nav': id, 'aria-label': label }, [create('span', { text: glyph }), create('label', { text: label })]);
      button.addEventListener('click', () => {
        nav.querySelectorAll('.idk-redesign-nav-button').forEach(item => item.classList.toggle('active', item === button));
        if (id === 'home') setHomeVisible(true);
        else { openApp(id); setHomeVisible(false); }
      });
      list.append(button);
    });
    const status = create('div', { class: 'idk-redesign-nav-status' }, [create('i', { class: 'idk-redesign-status-dot' }), create('span', { text: 'Workspace ready' })]);
    nav.append(brand, list, status);
    document.getElementById('desktop')?.append(nav);
    return nav;
  }

  function setHomeVisible(visible) {
    const panel = document.getElementById('idk-redesign-home');
    if (!panel) return;
    panel.hidden = !visible;
    panel.setAttribute('aria-hidden', String(!visible));
  }

  function sync() {
    const home = document.getElementById('idk-redesign-home');
    if (!home) return;
    const openWindows = [...document.querySelectorAll('#windows .window')].some(windowNode => !windowNode.classList.contains('minimized'));
    if (openWindows && !home.dataset.manual) setHomeVisible(false);
    const appCount = home.querySelector('[data-redesign-app-count]');
    const recentCount = home.querySelector('[data-redesign-recent-count]');
    if (appCount) appCount.textContent = String(Object.keys(appRegistry()).length);
    if (recentCount) recentCount.textContent = String(JSON.parse(localStorage.getItem('recentApps') || '[]').length);
  }

  function install() {
    document.body.classList.add('idk-redesign');
    createNav();
    createHome();
    sync();
    document.addEventListener('idk-recent-changed', sync);
    new MutationObserver(sync).observe(document.getElementById('windows') || document.body, { childList: true, subtree: true });
    window.IDKRedesign = { openApp, showHome: () => { const home = document.getElementById('idk-redesign-home'); if (home) home.dataset.manual = '1'; setHomeVisible(true); } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

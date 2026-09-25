(() => {
  'use strict';

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

  const WALLPAPERS = [
    ['blue','Blue / Classic','https://cdn.phototourl.com/member/2026-09-25-8f19f079-9694-4973-af98-5f3add5f3868.png'],
    ['grape','Purple / Grape','https://cdn.phototourl.com/member/2026-09-25-e806c32c-31fd-4f54-a378-8eba729b9eda.jpg'],
    ['green','Green','https://cdn.phototourl.com/member/2026-09-25-b9324e05-93bd-445b-b799-c75b6ff7b455.jpg'],
    ['red','Red / Cherry','https://cdn.phototourl.com/member/2026-09-25-99dc02ce-44e6-4b64-965a-6674dcca4695.jpg'],
    ['yellow','Yellow / Lemon','https://cdn.phototourl.com/member/2026-09-25-8f011df4-5dcb-4f2d-98c8-f93aaa5fce6c.jpg']
  ];

  function applyAppearance() {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    desktop.dataset.appearanceDockStyle = read('idkAppearanceDockStyle','glass');
    desktop.dataset.appearanceTransparency = read('idkAppearanceTransparency','normal');
    desktop.dataset.appearanceBlur = read('idkAppearanceBlur','on');
    desktop.dataset.dnd = read('idkDND',false) ? 'on' : 'off';
    const root = document.documentElement;
    root.style.setProperty('--idk-window-blur', read('idkAppearanceBlur','on') === 'on' ? '18px' : '0px');
  }

  function closeAppearance() {
    document.getElementById('idk-appearance-center')?.remove();
  }

  function openAppearance() {
    const old = document.getElementById('idk-appearance-center');
    if (old) { old.hidden = false; return; }

    const modal = document.createElement('section');
    modal.id = 'idk-appearance-center';
    modal.setAttribute('aria-label','Appearance Center');
    const card = document.createElement('div');
    card.className = 'idk-appearance-card';
    card.innerHTML = `
      <div class="idk-appearance-head">
        <div><h2>Appearance Center</h2><p>Customize how your IDK desktop looks and behaves.</p></div>
        <button type="button" class="idk-appearance-close" aria-label="Close">×</button>
      </div>
      <div class="idk-appearance-grid">
        <section class="idk-appearance-section">
          <h3>Wallpaper</h3>
          <label class="idk-appearance-field">Preset<select id="idk-appearance-wallpaper"></select></label>
          <label class="idk-appearance-field">Custom image or CSS gradient<input id="idk-appearance-wallpaper-url" class="field" type="text" placeholder="Image URL or CSS gradient"></label>
        </section>
        <section class="idk-appearance-section">
          <h3>Interface color</h3>
          <label class="idk-appearance-field">UI color<select id="idk-appearance-color"></select></label>
          <p class="idk-appearance-note">Auto follows the wallpaper palette. Manual colors override the wallpaper palette.</p>
        </section>
        <section class="idk-appearance-section">
          <h3>Desktop</h3>
          <label class="idk-appearance-field">Icon size<select id="idk-appearance-icons"><option value="compact">Compact</option><option value="normal">Normal</option><option value="large">Large</option></select></label>
          <label class="idk-appearance-field">Dock style<select id="idk-appearance-dock"><option value="glass">Glass</option><option value="solid">Solid</option><option value="minimal">Minimal</option></select></label>
        </section>
        <section class="idk-appearance-section">
          <h3>Effects</h3>
          <label class="idk-appearance-field">Transparency<select id="idk-appearance-transparency"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
          <label class="idk-appearance-field">Window blur<select id="idk-appearance-blur"><option value="on">On</option><option value="off">Off</option></select></label>
          <label class="idk-appearance-field">Animations<select id="idk-appearance-motion"><option value="on">On</option><option value="off">Reduce motion</option></select></label>
        </section>
        <section class="idk-appearance-section full">
          <h3>Lock screen</h3>
          <label class="idk-appearance-field">Auto-lock after inactivity<select id="idk-appearance-autolock"><option value="0">Off</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></label>
          <p class="idk-appearance-note">You can also lock immediately from the Start menu or with Ctrl + Alt + L. An optional local lock PIN is available in the IDK Control Center privacy settings.</p>
        </section>
      </div>
      <div class="idk-appearance-actions">
        <button type="button" class="btn" id="idk-appearance-apply">Apply changes</button>
        <button type="button" class="btn tab" id="idk-appearance-lock">Lock now</button>
        <button type="button" class="btn tab" id="idk-appearance-reset">Reset appearance</button>
      </div>`;
    card.querySelector('.idk-appearance-close').onclick = closeAppearance;
    modal.onclick = event => { if (event.target === modal) closeAppearance(); };
    modal.append(card);
    document.body.append(modal);

    const wallpaper = card.querySelector('#idk-appearance-wallpaper');
    WALLPAPERS.forEach(([value,label,url]) => wallpaper.append(new Option(label,url)));
    const currentWallpaper = read('wallpaper', WALLPAPERS[0][2]);
    wallpaper.value = WALLPAPERS.some(item => item[2] === currentWallpaper) ? currentWallpaper : '';
    const url = card.querySelector('#idk-appearance-wallpaper-url');
    url.value = currentWallpaper;
    wallpaper.onchange = () => { url.value = wallpaper.value; };

    const color = card.querySelector('#idk-appearance-color');
    [['auto','Auto — match wallpaper'],['blue','Blue / Classic'],['grape','Purple / Grape'],['green','Green'],['red','Red / Cherry'],['yellow','Yellow / Lemon']].forEach(([v,l]) => color.append(new Option(l,v)));
    color.value = read('idkUIColorTheme','auto');

    card.querySelector('#idk-appearance-icons').value = read('iconSize','normal');
    card.querySelector('#idk-appearance-dock').value = read('idkAppearanceDockStyle','glass');
    card.querySelector('#idk-appearance-transparency').value = read('idkAppearanceTransparency','normal');
    card.querySelector('#idk-appearance-blur').value = read('idkAppearanceBlur','on');
    card.querySelector('#idk-appearance-motion').value = read('motion','on');
    card.querySelector('#idk-appearance-autolock').value = String(read('idkAutoLockMinutes',0));

    card.querySelector('#idk-appearance-apply').onclick = () => {
      const wallpaperURL = url.value.trim();
      write('wallpaper', wallpaperURL);
      write('idkUIColorTheme', color.value);
      write('iconSize', card.querySelector('#idk-appearance-icons').value);
      write('idkAppearanceDockStyle', card.querySelector('#idk-appearance-dock').value);
      write('idkAppearanceTransparency', card.querySelector('#idk-appearance-transparency').value);
      write('idkAppearanceBlur', card.querySelector('#idk-appearance-blur').value);
      write('motion', card.querySelector('#idk-appearance-motion').value);
      write('idkAutoLockMinutes', Number(card.querySelector('#idk-appearance-autolock').value) || 0);
      window.applyWallpaper?.(wallpaperURL);
      window.IDKBackgroundTheme?.applyChoice?.(color.value, wallpaperURL);
      document.getElementById('desktop')?.setAttribute('data-icon-size', read('iconSize','normal'));
      document.getElementById('desktop')?.setAttribute('data-dock', read('dockPosition','bottom'));
      document.getElementById('desktop')?.setAttribute('data-motion', read('motion','on') === 'off' ? 'off' : 'on');
      applyAppearance();
      window.OS?.tickClock?.();
      window.OS?.notify?.('Appearance','Appearance Center settings applied.');
    };
    card.querySelector('#idk-appearance-lock').onclick = () => { closeAppearance(); window.IDKFeaturePack?.lockScreen?.(); };
    card.querySelector('#idk-appearance-reset').onclick = () => {
      write('idkUIColorTheme','auto'); write('idkAppearanceDockStyle','glass'); write('idkAppearanceTransparency','normal'); write('idkAppearanceBlur','on'); write('motion','on'); write('iconSize','normal');
      window.applyWallpaper?.(WALLPAPERS[0][2]); window.IDKBackgroundTheme?.applyChoice?.('auto',WALLPAPERS[0][2]); applyAppearance(); closeAppearance();
      window.OS?.notify?.('Appearance','Appearance settings reset.');
    };
  }

  function addAppearanceButton(root) {
    if (!root || root.querySelector('[data-idk-open-appearance]')) return;
    const section = document.createElement('div');
    section.className = 'settings-row';
    section.innerHTML = '<label>Appearance Center</label><button type="button" class="btn" data-idk-open-appearance>Open Appearance Center</button><small class="sub">Wallpaper, UI colors, desktop layout, effects, and lock settings.</small>';
    section.querySelector('button').onclick = openAppearance;
    root.append(section);
  }

  function addLockToStart() {
    const heading = document.querySelector('#start-menu .start-heading');
    if (!heading || heading.querySelector('[data-idk-lock]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.idkLock = '1';
    button.className = 'btn tab';
    button.textContent = 'Lock';
    button.style.marginLeft = 'auto';
    button.onclick = () => { window.IDKFeaturePack?.lockScreen?.(); document.getElementById('start-menu')?.setAttribute('hidden',''); };
    heading.append(button);
  }

  function installNotifications() {
    const panel = document.getElementById('notifications-panel');
    if (!panel || panel.dataset.idkNotifications20) return;
    panel.dataset.idkNotifications20 = '1';
    const tools = document.createElement('div');
    tools.className = 'idk-notification-tools';
    tools.innerHTML = `
      <div class="idk-notification-tools-row">
        <input class="field" type="search" placeholder="Search notifications…" aria-label="Search notifications" data-idk-notification-search>
        <select class="field" data-idk-notification-filter aria-label="Notification filter">
          <option value="all">All</option><option value="info">Info</option><option value="success">Success</option><option value="warning">Warnings</option><option value="danger">Alerts</option>
        </select>
      </div>
      <label class="idk-notification-dnd"><input type="checkbox" data-idk-dnd> Do Not Disturb — hide pop-up notifications</label>`;
    panel.querySelector('.notification-panel-heading')?.after(tools);
    const search = tools.querySelector('[data-idk-notification-search]');
    const filter = tools.querySelector('[data-idk-notification-filter]');
    const dnd = tools.querySelector('[data-idk-dnd]');
    dnd.checked = Boolean(read('idkDND',false));
    const applyDnd = () => { write('idkDND', dnd.checked); applyAppearance(); };
    dnd.onchange = applyDnd;
    const filterItems = () => {
      const q = search.value.trim().toLowerCase(), type = filter.value;
      panel.querySelectorAll('.notification-center-item').forEach(item => {
        const matchesText = !q || item.textContent.toLowerCase().includes(q);
        const matchesType = type === 'all' || item.classList.contains(type);
        item.hidden = !(matchesText && matchesType);
      });
    };
    search.oninput = filterItems; filter.onchange = filterItems;
    new MutationObserver(filterItems).observe(document.getElementById('notification-list'), { childList:true });
  }

  let autoLockTimer = 0;
  function armAutoLock() {
    clearTimeout(autoLockTimer);
    const minutes = Number(read('idkAutoLockMinutes',0)) || 0;
    if (minutes <= 0 || document.getElementById('idk-pack-lock')) return;
    autoLockTimer = setTimeout(() => {
      if (!document.getElementById('idk-pack-lock')) window.IDKFeaturePack?.lockScreen?.();
    }, minutes * 60000);
  }
  ['pointerdown','keydown','touchstart'].forEach(type => window.addEventListener(type, armAutoLock, { passive:true }));
  window.addEventListener('storage', applyAppearance);
  setInterval(armAutoLock, 30000);

  const observer = new MutationObserver(() => {
    addLockToStart();
    installNotifications();
    const settingsWindows = [...document.querySelectorAll('#windows .window')].filter(win => win.dataset.app === 'settings');
    settingsWindows.forEach(win => addAppearanceButton(win.querySelector('.content > .app') || win.querySelector('.content')));
  });
  observer.observe(document.body,{childList:true,subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { applyAppearance(); addLockToStart(); installNotifications(); armAutoLock(); }, { once:true });
  else { applyAppearance(); addLockToStart(); installNotifications(); armAutoLock(); }
  window.IDKAppearanceCenter = { open: openAppearance, apply: applyAppearance };
})();
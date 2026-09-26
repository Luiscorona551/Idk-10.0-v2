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
    if (window.OS?.open) {
      window.OS.open('settings', { tab: 'appearance' });
      return;
    }
  }

  function addAppearanceButton(root) {
    if (!root || root.querySelector('[data-idk-open-appearance]')) return;
    const section = document.createElement('div');
    section.className = 'settings-row';
    section.innerHTML = '<label>Appearance Center</label><button type="button" class="btn" data-idk-open-appearance>Open Appearance Center</button><small class="sub">Wallpaper, UI colors, desktop layout, effects, and lock settings.</small>';
    section.querySelector('button').onclick = () => window.OS?.open?.('settings', { tab: 'appearance' });
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

  });
  observer.observe(document.body,{childList:true,subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { applyAppearance(); addLockToStart(); installNotifications(); armAutoLock(); }, { once:true });
  else { applyAppearance(); addLockToStart(); installNotifications(); armAutoLock(); }
  window.IDKAppearanceCenter = { open: openAppearance, apply: applyAppearance };
})();
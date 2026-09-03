(() => {
  'use strict';
  if (window.IDKDesktopBugfixes) return;
  window.IDKDesktopBugfixes = true;

  const style = () => {
    if (document.getElementById('idk-desktop-bugfix-style')) return;
    const s = document.createElement('style');
    s.id = 'idk-desktop-bugfix-style';
    s.textContent = `
      #idk-clock-battery{display:inline-flex!important;align-items:center;gap:5px;margin-left:10px;padding:4px 8px;border:1px solid rgba(145,190,255,.38);border-radius:9px;background:rgba(12,35,76,.72);color:#fff;font:700 11px/1 system-ui,sans-serif;vertical-align:middle;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.12);position:relative;z-index:3}
      #idk-clock-battery .idk-battery-dot{font-size:12px;line-height:1}
      #dock .dock-btn[data-app="apps"],#dock .dock-btn[data-id="apps"],#dock .dock-btn[aria-label="Apps"],#dock [title="Apps"],#dock [aria-label="Apps"]{display:none!important}
      #dock [data-app="apps"],#dock [data-app-id="apps"],#dock [data-id="apps"]{display:none!important}
      @media(max-width:600px){#idk-clock-battery{margin-left:6px;padding:3px 6px;font-size:10px}}
    `;
    document.head.appendChild(s);
  };

  function textOf(el) { return String(el?.textContent || '').replace(/\s+/g, ' ').trim(); }

  function hideOldDockControls() {
    const dock = document.getElementById('dock');
    if (!dock) return;
    [...dock.children].forEach(item => {
      const text = textOf(item);
      const meta = `${item.getAttribute('aria-label') || ''} ${item.getAttribute('title') || ''} ${item.dataset.app || ''} ${item.dataset.appId || ''} ${item.dataset.id || ''} ${item.className || ''}`;
      const isApps = /^apps$/i.test(text) || /(?:^|[\s_-])apps(?:$|[\s_-])/i.test(meta);
      const isBattery = /battery|battery-status|battery-percent/i.test(meta) || /(?:^|\s)\d{1,3}%(?:\s|$)/.test(text);
      if (isApps || isBattery) item.remove();
    });
  }

  function ensureBattery() {
    const clock = document.getElementById('clock');
    if (!clock) return;
    style();
    let badge = document.getElementById('idk-clock-battery');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'idk-clock-battery';
      badge.setAttribute('aria-label', 'IDK battery status');
      badge.innerHTML = '<span class="idk-battery-dot">🔋</span><span>--%</span>';
      clock.appendChild(badge);
    }
    if (!navigator.getBattery || badge.dataset.idkBatteryBound === '1') return;
    badge.dataset.idkBatteryBound = '1';
    navigator.getBattery().then(battery => {
      const update = () => {
        const pct = Math.round(battery.level * 100);
        badge.querySelector('span:last-child').textContent = `${pct}%${battery.charging ? ' ⚡' : ''}`;
        badge.title = battery.charging ? `Battery ${pct}% · Charging` : `Battery ${pct}%`;
      };
      update();
      battery.addEventListener('levelchange', update);
      battery.addEventListener('chargingchange', update);
    }).catch(() => { badge.querySelector('span:last-child').textContent = 'Battery N/A'; });
  }

  function ensureFriendsIcon() {
    const root = document.getElementById('icons');
    if (!root || root.querySelector('[data-app-id="friends"],[data-app="friends"]')) return;
    const icon = document.createElement('div');
    icon.className = 'desktop-icon';
    icon.dataset.appId = 'friends';
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('aria-label', 'Friends');
    icon.title = 'Find and add friends';
    icon.innerHTML = '<div class="glyph" aria-hidden="true">👥</div><div class="label">Friends</div>';
    const openFriends = event => {
      event.preventDefault();
      event.stopPropagation();
      if (window.IdkFriends?.open) window.IdkFriends.open();
      else window.IdkMessenger?.open?.();
    };
    icon.addEventListener('click', openFriends);
    icon.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openFriends(e); });
    root.appendChild(icon);
  }

  function boot() {
    style();
    hideOldDockControls();
    ensureBattery();
    ensureFriendsIcon();
    setTimeout(() => {
      hideOldDockControls();
      ensureBattery();
      ensureFriendsIcon();
    }, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

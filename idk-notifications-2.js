(() => {
  'use strict';
  if (window.IDKNotifications2) return;

  const KEY = 'idk-notifications-v2';
  const MAX = 100;
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = items => { try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX))); } catch {} };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function add(title, message, kind='info', options={}) {
    const item = { id: crypto.randomUUID(), title: String(title || 'IDK'), message: String(message || ''), kind, at: Date.now(), read: false, app: options.app || '' };
    const items = read();
    items.unshift(item);
    write(items);
    render();
    return item.id;
  }

  function markRead(id) {
    const items = read().map(x => x.id === id ? {...x, read:true} : x);
    write(items); render();
  }

  function clearAll() { write([]); render(); }
  function unreadCount() { return read().filter(x => !x.read).length; }

  function render() {
    const list = document.getElementById('notification-list');
    const badge = document.getElementById('notification-count');
    if (!list) return;
    const items = read();
    const unread = items.filter(x => !x.read).length;
    if (badge) { badge.textContent = unread > 99 ? '99+' : String(unread); badge.hidden = unread === 0; }
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'idk-notif-empty';
      empty.textContent = 'You’re all caught up.';
      list.append(empty);
      return;
    }
    items.forEach(item => {
      const row = document.createElement('article');
      row.className = 'idk-notif-item ' + (item.read ? 'read' : 'unread') + ' ' + esc(item.kind);
      row.innerHTML = '<div class="idk-notif-copy"><strong>' + esc(item.title) + '</strong><p>' + esc(item.message) + '</p><small>' + new Date(item.at).toLocaleString([], {dateStyle:'short', timeStyle:'short'}) + (item.app ? ' · ' + esc(item.app) : '') + '</small></div><button class="btn tab" type="button">Mark read</button>';
      row.querySelector('button').onclick = () => markRead(item.id);
      list.append(row);
    });
  }

  function install() {
    const toggle = document.getElementById('notification-toggle');
    const panel = document.getElementById('notifications-panel');
    const clear = document.getElementById('notifications-clear');
    if (!toggle || !panel) return;
    toggle.onclick = () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) render();
    };
    clear && (clear.onclick = clearAll);
    window.OS = window.OS || {};
    const previousNotify = window.OS.notify;
    window.OS.notify = function(title, message, kind='info') {
      const result = typeof previousNotify === 'function' ? previousNotify.apply(this, arguments) : undefined;
      add(title, message, kind);
      return result;
    };
    window.IDKNotifications2 = { add, markRead, clearAll, unreadCount, render };
    render();
  }

  const style = document.createElement('style');
  style.textContent = '.idk-notif-item{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;padding:12px;border-bottom:1px solid rgba(255,255,255,.1)}.idk-notif-item.unread{background:rgba(89,134,218,.12)}.idk-notif-copy{min-width:0}.idk-notif-copy strong{display:block}.idk-notif-copy p{margin:4px 0;opacity:.8;overflow-wrap:anywhere}.idk-notif-copy small{opacity:.55}.idk-notif-empty{padding:24px;text-align:center;opacity:.65}#notifications-panel{position:fixed;right:16px;top:64px;width:min(420px,calc(100vw - 32px));max-height:min(70vh,560px);overflow:auto;z-index:10000;backdrop-filter:blur(18px)}@media(max-width:600px){#notifications-panel{right:8px;top:58px;width:calc(100vw - 16px)}}';
  document.head.append(style);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
})();
(() => {
  'use strict';

  const removeLegacyLaunchers = () => {
    document.querySelectorAll('[data-final-app="chat"],[data-final-app="dm"]').forEach(el => el.remove());
    document.querySelectorAll('.desktop-icon[data-app="chat"]').forEach(el => el.remove());
    document.querySelectorAll('.idk-chat-app,.idk-dm-app').forEach(el => el.closest('.idk-feature-overlay')?.remove());
  };

  const style = () => {
    if (document.getElementById('idk-messenger-final-style')) return;
    const s = document.createElement('style');
    s.id = 'idk-messenger-final-style';
    s.textContent = `
      .idk-live-tabs{display:flex!important;gap:8px!important;padding:8px 10px!important;border-bottom:1px solid rgba(255,255,255,.10)!important}
      .idk-live-tabs button{min-height:36px!important;padding:7px 14px!important;border-radius:10px!important}
      .idk-live-tabs button[data-tab="dm"]{font-weight:700}
      .idk-live-dm .idk-live-messages{background:linear-gradient(180deg,rgba(7,16,35,.35),rgba(4,10,24,.72));padding:18px!important}
      .idk-live-dm .idk-live-message{max-width:78%;margin:7px 0;padding:9px 13px;border-radius:18px;background:#263247;border:0;box-shadow:none}
      .idk-live-dm .idk-live-message.mine{margin-left:auto;background:#1687ff;color:#fff}
      .idk-live-dm .idk-live-message-meta{font-size:11px;opacity:.72;margin-bottom:3px}
      .idk-live-dm .idk-live-compose{padding:10px!important;border-top:1px solid rgba(255,255,255,.08)!important}
      .idk-live-dm .idk-live-compose .field{border-radius:18px!important}
    `;
    document.head.append(s);
  };

  const routeStartMessenger = event => {
    const target = event.target.closest('#start-apps .start-app, #start-recent .recent-app');
    if (!target || !/Idk Messenger/i.test(target.textContent || '')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.IdkMessenger?.open?.();
  };

  const refineMessenger = () => {
    removeLegacyLaunchers();
    style();
    const messenger = document.querySelector('.idk-live-messenger');
    if (!messenger) return;
    const dm = messenger.querySelector('[data-tab="dm"]');
    if (dm) dm.textContent = 'DM';
    const room = messenger.querySelector('[data-tab="room"]');
    if (room) room.textContent = '💬 Chat Room';
    const icon = document.querySelector('[data-live-messenger]');
    if (icon && !icon.dataset.singleClick) {
      icon.dataset.singleClick = '1';
      icon.ondblclick = null;
      icon.onclick = () => window.IdkMessenger?.open?.();
      icon.setAttribute('aria-label', 'Open Idk Messenger');
    }
  };

  const init = () => {
    document.addEventListener('click', routeStartMessenger, true);
    removeLegacyLaunchers();
    style();
    const observer = new MutationObserver(refineMessenger);
    observer.observe(document.body, { childList: true, subtree: true });
    refineMessenger();
    setTimeout(() => observer.disconnect(), 15000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

(() => {
  'use strict';

  const removeLegacyLaunchers = () => {
    document.querySelectorAll('[data-final-app="chat"],[data-final-app="dm"]').forEach(el => el.remove());
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
      .idk-live-dm .idk-live-main{min-width:0}
      @media(max-width:700px){.idk-live-body{grid-template-columns:1fr!important}.idk-live-members{max-height:150px;overflow:auto}.idk-live-compose{display:flex;gap:8px}.idk-live-compose .field{min-width:0;flex:1}}
    `;
    document.head.append(s);
  };

  const openMessenger = () => window.IdkMessenger?.open?.();

  const routeStartMessenger = event => {
    const target = event.target.closest?.('#start-apps .start-app, #start-recent .recent-app');
    if (!target || !/Idk Messenger/i.test(target.textContent || '')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMessenger();
  };

  const routeMessengerIcon = event => {
    const target = event.target.closest?.('[data-live-messenger], .idk-final-desktop-icon');
    if (!target || !/Idk Messenger/i.test(target.textContent || target.getAttribute('aria-label') || '')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMessenger();
  };

  const refineMessenger = () => {
    removeLegacyLaunchers();
    const messenger = document.querySelector('.idk-live-messenger');
    if (!messenger) return;
    const dm = messenger.querySelector('[data-tab="dm"]');
    if (dm) dm.textContent = 'DM';
    const room = messenger.querySelector('[data-tab="room"]');
    if (room) room.textContent = '💬 Chat Room';
    const icon = document.querySelector('[data-live-messenger]');
    if (icon) icon.setAttribute('aria-label', 'Open Idk Messenger');
  };

  const init = () => {
    document.addEventListener('click', routeStartMessenger, true);
    document.addEventListener('click', routeMessengerIcon, true);
    removeLegacyLaunchers();
    style();
    refineMessenger();
    // Give the live Messenger one follow-up pass after its own UI has mounted,
    // instead of observing every mutation on the whole document.
    setTimeout(refineMessenger, 1200);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

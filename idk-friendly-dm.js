(() => {
  'use strict';
  const STYLE_ID = 'idk-friendly-dm-style';
  const HEADER_ID = 'idk-friendly-dm-header';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .chat-app.idk-direct-mode{background:linear-gradient(180deg,#eef5ff 0%,#f7faff 55%,#edf4ff 100%)!important;color:#1b2a44!important;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(15,45,90,.22)}
      .chat-app.idk-direct-mode .idk-dm-header{display:flex;align-items:center;gap:11px;padding:14px 16px;background:linear-gradient(135deg,#2d78df,#5b9df2);color:white;border-bottom:1px solid rgba(255,255,255,.28)}
      .chat-app.idk-direct-mode .idk-dm-avatar{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.72);font-size:20px;font-weight:800}
      .chat-app.idk-direct-mode .idk-dm-name{font-size:15px;font-weight:800;line-height:1.2}.chat-app.idk-direct-mode .idk-dm-status{font-size:10px;opacity:.88;margin-top:2px}
      .chat-app.idk-direct-mode .idk-dm-heart{margin-left:auto;font-size:20px;opacity:.9}
      .chat-app.idk-direct-mode .chat-line.private{margin:6px 4px;padding:9px 11px;border:0;border-radius:14px;background:white!important;box-shadow:0 2px 9px rgba(40,75,120,.1);color:#243654!important}
      .chat-app.idk-direct-mode .chat-line.private b{color:#3578cf!important}.chat-app.idk-direct-mode .chat-private-label{color:#3578cf!important;font-size:9px}
      .chat-app.idk-direct-mode .chat-mode{display:none!important}.chat-app.idk-direct-mode .chat-recipient{order:-2;flex:1 1 100%!important;width:100%!important;border-radius:11px!important;background:white!important;color:#263956!important;border-color:#cbd9ed!important}
      .chat-app.idk-direct-mode .chat-input{border-radius:20px!important;border:1px solid #cbd9ed!important;background:white!important;color:#1b2a44!important;padding-left:15px!important}
      .chat-app.idk-direct-mode .btn{border-radius:18px!important}.chat-app.idk-direct-mode .chat-send{background:#357bd7!important;border-color:#357bd7!important}
      .chat-app.idk-direct-mode .chat-status{color:#50709a!important}
      .chat-app.idk-direct-mode .idk-dm-empty{padding:28px 18px;text-align:center;color:#617594;font-size:12px}.chat-app.idk-direct-mode .idk-dm-empty strong{display:block;color:#31547f;font-size:14px;margin-bottom:5px}
      @media(max-width:600px){.chat-app.idk-direct-mode .idk-dm-header{padding:11px 12px}.chat-app.idk-direct-mode .idk-dm-avatar{width:36px;height:36px}.chat-app.idk-direct-mode .chat-line.private{font-size:13px}}
    `;
    document.head.appendChild(s);
  }

  function textOf(el) { return String(el?.textContent || '').replace(/\s+/g,' ').trim(); }
  function findChatRoot(node) { return node?.closest?.('.chat-app') || document.querySelector('.chat-app'); }
  function findMode(root) { return root?.querySelector?.('.chat-mode'); }
  function recipientName(root) {
    const r = root?.querySelector?.('.chat-recipient');
    return textOf(r?.selectedOptions?.[0]) || textOf(r) || 'Personal chat';
  }

  function decorate(root) {
    if (!root) return;
    const mode = findMode(root);
    const direct = mode?.value === 'direct';
    root.classList.toggle('idk-direct-mode', direct);
    let header = root.querySelector('#' + HEADER_ID);
    if (!direct) { header?.remove(); return; }
    installStyle();
    if (!header) {
      header = document.createElement('div');
      header.id = HEADER_ID;
      header.className = 'idk-dm-header';
      header.innerHTML = '<div class="idk-dm-avatar" aria-hidden="true">♡</div><div><div class="idk-dm-name">Personal chat</div><div class="idk-dm-status">Private conversation · just between you two</div></div><div class="idk-dm-heart" aria-hidden="true">♥</div>';
      root.prepend(header);
    }
    const recipient = recipientName(root);
    const name = header.querySelector('.idk-dm-name');
    if (name && name.textContent !== recipient) name.textContent = recipient;
    const avatar = header.querySelector('.idk-dm-avatar');
    const initial = recipient.slice(0, 1).toUpperCase() || '♡';
    if (avatar && avatar.textContent !== initial) avatar.textContent = initial;
  }

  function watch(root) {
    if (!root || root.dataset.idkDmWatched === '1') return;
    root.dataset.idkDmWatched = '1';
    const mode = findMode(root);
    mode?.addEventListener('change', () => setTimeout(() => decorate(root), 0));
    root.addEventListener('change', e => { if (e.target?.classList?.contains('chat-recipient')) decorate(root); });
    new MutationObserver(() => decorate(root)).observe(root, { childList:true, subtree:true });
    decorate(root);
  }

  function boot() {
    installStyle();
    document.querySelectorAll('.chat-app').forEach(watch);
    new MutationObserver(() => document.querySelectorAll('.chat-app').forEach(watch)).observe(document.body,{childList:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();

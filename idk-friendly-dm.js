(() => {
  'use strict';
  const STYLE_ID = 'idk-friendly-dm-style';
  const HEADER_ID = 'idk-friendly-dm-header';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .chat-app.idk-direct-mode{background:linear-gradient(180deg,#f5f9ff 0%,#edf4ff 52%,#e7f0ff 100%)!important;color:#1b2a44!important;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(15,45,90,.22)}
      .chat-app.idk-direct-mode .idk-dm-header{display:flex;align-items:center;gap:11px;padding:13px 16px;background:linear-gradient(135deg,#2d78df,#62a4f5);color:white;border-bottom:1px solid rgba(255,255,255,.3);box-shadow:0 5px 18px rgba(45,120,223,.18)}
      .chat-app.idk-direct-mode .idk-dm-avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.78);font-size:19px;font-weight:800;box-shadow:0 3px 10px rgba(20,70,145,.2)}
      .chat-app.idk-direct-mode .idk-dm-name{font-size:15px;font-weight:800;line-height:1.2}.chat-app.idk-direct-mode .idk-dm-status{font-size:10px;opacity:.92;margin-top:3px}.chat-app.idk-direct-mode .idk-dm-status:before{content:'●';margin-right:5px;color:#b9ffd0;font-size:8px}
      .chat-app.idk-direct-mode .idk-dm-heart{margin-left:auto;font-size:20px;opacity:.92;filter:drop-shadow(0 2px 5px rgba(0,0,0,.16))}
      .chat-app.idk-direct-mode .chat-log{margin:0;padding:12px 10px;background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(210,226,250,.2));border:0}
      .chat-app.idk-direct-mode .chat-line.private{width:fit-content;max-width:86%;margin:7px 4px;padding:9px 12px;border:1px solid rgba(74,121,183,.12);border-radius:16px;background:rgba(255,255,255,.96)!important;box-shadow:0 3px 12px rgba(40,75,120,.1);color:#243654!important;line-height:1.45}
      .chat-app.idk-direct-mode .chat-line.private b{color:#3578cf!important}.chat-app.idk-direct-mode .chat-private-label{display:block;margin:0 0 3px;color:#3578cf!important;font-size:8px;letter-spacing:.8px;font-weight:800}
      .chat-app.idk-direct-mode .chat-mode{display:none!important}.chat-app.idk-direct-mode .chat-recipient{order:-2;flex:1 1 100%!important;width:100%!important;border-radius:12px!important;background:white!important;color:#263956!important;border-color:#cbd9ed!important;box-shadow:0 2px 8px rgba(30,65,110,.06)}
      .chat-app.idk-direct-mode .chat-input{border-radius:22px!important;border:1px solid #cbd9ed!important;background:white!important;color:#1b2a44!important;padding:10px 15px!important;box-shadow:0 3px 12px rgba(30,65,110,.08)}
      .chat-app.idk-direct-mode .chat-input:focus{border-color:#6ca7ed!important;outline:none;box-shadow:0 0 0 3px rgba(53,123,215,.13),0 3px 12px rgba(30,65,110,.08)}
      .chat-app.idk-direct-mode .btn{border-radius:18px!important}.chat-app.idk-direct-mode .chat-send{background:#357bd7!important;border-color:#357bd7!important;box-shadow:0 4px 10px rgba(53,123,215,.22)}
      .chat-app.idk-direct-mode .chat-status{color:#50709a!important}
      .chat-app.idk-direct-mode .idk-dm-empty{margin:12px;padding:30px 18px;text-align:center;color:#617594;font-size:12px;border-radius:16px;background:rgba(255,255,255,.62);border:1px solid rgba(74,121,183,.1)}.chat-app.idk-direct-mode .idk-dm-empty strong{display:block;color:#31547f;font-size:14px;margin-bottom:5px}
      @media(max-width:600px){.chat-app.idk-direct-mode .idk-dm-header{padding:11px 12px}.chat-app.idk-direct-mode .idk-dm-avatar{width:38px;height:38px}.chat-app.idk-direct-mode .chat-line.private{max-width:91%;font-size:13px}.chat-app.idk-direct-mode .chat-log{padding:10px 6px}}
    `;
    document.head.appendChild(s);
  }

  function textOf(el) { return String(el?.textContent || '').replace(/\s+/g,' ').trim(); }
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
    const name = header.querySelector('.idk-dm-name');
    if (name) name.textContent = recipientName(root);
    const avatar = header.querySelector('.idk-dm-avatar');
    if (avatar) avatar.textContent = recipientName(root).slice(0,1).toUpperCase() || '♡';
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

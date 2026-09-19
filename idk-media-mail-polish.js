(() => {
  'use strict';
  const STYLE_ID = 'idk-media-mail-polish';
  const installStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .idk-live-messenger { border:1px solid rgba(110,150,220,.28); box-shadow:0 24px 80px rgba(3,12,35,.45); }
      .idk-live-title { background:linear-gradient(135deg,#101c3b,#173d78 55%,#245da8)!important; }
      .idk-live-tabs button.active { box-shadow:inset 0 -3px 0 #69b7ff; }
      .idk-chat-attach,.idk-imessage-add { min-width:38px; height:38px; border-radius:12px; border:1px solid rgba(110,150,220,.3); background:rgba(255,255,255,.06); color:inherit; font-size:20px; cursor:pointer; }
      .idk-chat-attachments { display:flex; flex-wrap:wrap; gap:8px; margin-top:9px; }
      .idk-chat-attachment { display:inline-flex; align-items:center; gap:7px; padding:7px 10px; border-radius:11px; text-decoration:none; background:rgba(80,130,210,.12); color:inherit; border:1px solid rgba(100,150,220,.22); }
      .idk-chat-image,.idk-chat-video { display:block; max-width:min(360px,100%); max-height:280px; border-radius:12px; margin-top:8px; object-fit:contain; background:#081020; }
      #idk-mail-app { overflow:hidden; border-radius:18px; border:1px solid rgba(90,130,210,.25); background:linear-gradient(145deg,#091326,#0f1c38 58%,#142b50); color:#eaf2ff; box-shadow:0 24px 70px rgba(0,0,0,.35); }
      #idk-mail-app .idk-mail-top { display:flex; align-items:center; gap:10px; padding:18px 20px; background:linear-gradient(135deg,#123a72,#1c5fa8); border-bottom:1px solid rgba(255,255,255,.12); }
      #idk-mail-app .idk-mail-top strong { font-size:20px; letter-spacing:.2px; } #idk-mail-app .idk-mail-top small { opacity:.75; }
      #idk-mail-app .idk-mail-tabs { display:flex; gap:8px; padding:10px 12px; background:rgba(5,12,28,.55); }
      #idk-mail-app .idk-mail-tabs button { border:1px solid rgba(110,160,230,.22); background:rgba(255,255,255,.04); color:#dce9ff; border-radius:11px; padding:8px 12px; cursor:pointer; }
      #idk-mail-app .idk-mail-tabs button.active { background:#246bc0; border-color:#4f9bea; }
      #idk-mail-app .idk-mail-body { display:grid; grid-template-columns:minmax(180px,30%) 1fr; min-height:440px; }
      #idk-mail-app .idk-mail-list { padding:10px; background:rgba(3,10,24,.35); border-right:1px solid rgba(110,160,230,.14); overflow:auto; }
      #idk-mail-app .idk-mail-item { display:grid; width:100%; text-align:left; gap:4px; padding:12px; margin-bottom:7px; border:1px solid transparent; border-radius:12px; background:rgba(255,255,255,.035); color:#dce9ff; cursor:pointer; }
      #idk-mail-app .idk-mail-item:hover,#idk-mail-app .idk-mail-item.active { background:rgba(55,125,215,.18); border-color:rgba(100,160,230,.3); }
      #idk-mail-app .idk-mail-content { padding:20px; overflow:auto; } #idk-mail-app .idk-mail-content input,#idk-mail-app .idk-mail-content textarea { width:100%; box-sizing:border-box; background:#081326; color:#eef5ff; border:1px solid rgba(110,160,230,.25); border-radius:10px; padding:10px; }
      #idk-mail-app .idk-mail-compose { display:grid; gap:12px; } #idk-mail-app .idk-mail-compose label { display:grid; gap:6px; font-size:12px; color:#a9c3e8; }
      #idk-mail-app .idk-mail-message { background:rgba(255,255,255,.045); border:1px solid rgba(110,160,230,.16); border-radius:16px; padding:18px; }
      #idk-mail-app .idk-mail-message h3 { margin-top:0; color:#fff; } #idk-mail-app .idk-mail-status { color:#9fb8dc; }
      .cinema-proxy-frame { height:calc(100% - 46px); min-height:560px; }
      .cinema-proxy-frame iframe { width:100%; height:100%; min-height:560px; border:0; background:#050a14; }
      @media(max-width:650px){#idk-mail-app .idk-mail-body{grid-template-columns:1fr}#idk-mail-app .idk-mail-list{max-height:180px;border-right:0;border-bottom:1px solid rgba(110,160,230,.14)}}
    `;
    document.head.append(style);
  };
  const mediaExt = /\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv)$/i;
  function enhanceAttachmentViews(root=document) {
    root.querySelectorAll('.idk-chat-attachment').forEach(link => {
      if (link.dataset.mediaEnhanced === '1' || !link.href?.startsWith('blob:')) return;
      const name = link.download || link.textContent || '';
      if (!mediaExt.test(name)) return;
      link.dataset.mediaEnhanced = '1';
      const video = document.createElement('video');
      video.className = 'idk-chat-video'; video.controls = true; video.playsInline = true; video.preload = 'metadata'; video.src = link.href;
      link.parentElement?.append(video);
    });
  }
  function enhanceMessenger(root) {
    if (!root || root.dataset.idkMediaPolish === '1') return;
    root.dataset.idkMediaPolish = '1';
    root.querySelectorAll('.idk-chat-file-input').forEach(input => {
      input.accept = 'image/*,video/*,audio/*,.pdf,.txt,.md,.csv,.zip,.doc,.docx,.xls,.xlsx';
    });
    new MutationObserver(() => enhanceAttachmentViews(root)).observe(root,{childList:true,subtree:true});
    enhanceAttachmentViews(root);
  }
  function boot() {
    installStyle();
    new MutationObserver(() => {
      document.querySelectorAll('.idk-live-messenger').forEach(enhanceMessenger);
      enhanceAttachmentViews(document);
    }).observe(document.body,{childList:true,subtree:true});
    document.querySelectorAll('.idk-live-messenger').forEach(enhanceMessenger);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
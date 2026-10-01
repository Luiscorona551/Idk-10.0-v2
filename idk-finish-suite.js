(() => {
  'use strict';
  if (window.IDKFinishSuite) return;

  const addStyle = () => {
    if (document.getElementById('idk-finish-suite-style')) return;
    const style = document.createElement('style');
    style.id = 'idk-finish-suite-style';
    style.textContent = `
      .idk-finish-health { display:flex; flex-wrap:wrap; gap:7px; align-items:center; margin:10px 0; padding:9px 11px; border:1px solid rgba(105,183,255,.22); border-radius:12px; background:rgba(7,19,41,.48); color:#a9c3e8; font-size:10px; }
      .idk-finish-health strong { color:#fff; }
      .idk-finish-health .ok { color:#7ef6a8; }
      .idk-finish-health .warn { color:#ffcf70; }
      .idk-finish-actions { display:flex; flex-wrap:wrap; gap:6px; }
      .idk-ai-tools { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; }
      .idk-browser-retry { position:absolute; z-index:5; right:12px; top:52px; }
      .idk-game-ready { color:#7ef6a8; }
    `;
    document.head.append(style);
  };

  async function health() {
    try {
      const [server, ai, call] = await Promise.all([
        fetch('/api/status',{cache:'no-store'}).then(r=>r.json()),
        fetch('/api/ai/status',{cache:'no-store'}).then(r=>r.json()),
        fetch('/api/call/config',{cache:'no-store'}).then(r=>r.json())
      ]);
      return { server, ai, call };
    } catch (error) {
      return { server:{}, ai:{}, call:{}, error };
    }
  }

  function enhanceCalls(root) {
    if (!root || root.dataset.finishCalls) return;
    root.dataset.finishCalls='1';
    const box=document.createElement('div');
    box.className='idk-finish-health';
    box.innerHTML='<strong>Connection check</strong><span data-call-health>Checking…</span>';
    const section=root.querySelector('.idk-call-intro') || root.firstElementChild;
    section?.after(box);
    const run=async()=> {
      const data=await health();
      const call=data.call||{};
      const secure=location.protocol==='https:'||location.hostname==='localhost';
      const media=Boolean(navigator.mediaDevices?.getUserMedia);
      box.querySelector('[data-call-health]').innerHTML =
        `<span class="${secure?'ok':'warn'}">${secure?'HTTPS ready':'HTTPS required'}</span>
         <span class="${media?'ok':'warn'}">${media?'Microphone/camera ready':'Media API unavailable'}</span>
         <span class="${call.hasTurn?'ok':'warn'}">${call.hasTurn?'TURN relay configured':'STUN fallback'}</span>`;
    };
    const button=document.createElement('button');
    button.type='button'; button.className='btn tab'; button.textContent='Run check'; button.onclick=run;
    box.append(button); run();
  }

  function enhanceAI(root) {
    if (!root || root.dataset.finishAI) return;
    root.dataset.finishAI='1';
    const tools=document.createElement('div'); tools.className='idk-ai-tools';
    const save=document.createElement('button'); save.type='button'; save.className='btn tab'; save.textContent='Save chat';
    const clear=document.createElement('button'); clear.type='button'; clear.className='btn tab'; clear.textContent='Clear chat';
    const status=document.createElement('span'); status.className='count'; status.textContent='Local conversation backup';
    tools.append(save,clear,status);
    root.querySelector('.ai-log')?.before(tools);
    const key='idkAiConversation';
    save.onclick=()=>{ try { localStorage.setItem(key, JSON.stringify({savedAt:Date.now(),html:root.querySelector('.ai-log')?.innerHTML||''})); status.textContent='Saved on this device'; } catch { status.textContent='Could not save'; } };
    clear.onclick=()=>{ const log=root.querySelector('.ai-log'); if(log){ log.replaceChildren(); } status.textContent='Conversation cleared'; };
  }

  function enhanceBrowser(root) {
    if (!root || root.dataset.finishBrowser) return;
    root.dataset.finishBrowser='1';
    const observer=new MutationObserver(()=>{
      const frames=[...root.querySelectorAll('iframe')];
      frames.forEach(frame=>{
        if(frame.dataset.finishBrowser) return;
        if(!/\/uv\/service\//.test(frame.src||'')) return;
        frame.dataset.finishBrowser='1';
        frame.setAttribute('allowfullscreen','');
        frame.allow = frame.allow ? `${frame.allow}; fullscreen` : 'fullscreen';
        const toolbar = root.querySelector('.toolbar');
        if (toolbar && !toolbar.querySelector('.idk-browser-fullscreen')) {
          const fullscreen = document.createElement('button');
          fullscreen.className='btn tab idk-browser-fullscreen';
          fullscreen.type='button';
          fullscreen.textContent='Fullscreen';
          fullscreen.onclick=async()=> {
            try {
              if (document.fullscreenElement) {
                await document.exitFullscreen();
              } else if (frame.requestFullscreen) {
                await frame.requestFullscreen();
              } else {
                fullscreen.textContent='Fullscreen unavailable';
                setTimeout(()=>{ fullscreen.textContent='Fullscreen'; },1500);
              }
            } catch {
              fullscreen.textContent='Fullscreen unavailable';
              setTimeout(()=>{ fullscreen.textContent='Fullscreen'; },1500);
            }
          };
          toolbar.append(fullscreen);
        }
        frame.addEventListener('error',()=>{
          if(root.querySelector('.idk-browser-retry')) return;
          const retry=document.createElement('button');
          retry.className='btn tab idk-browser-retry'; retry.type='button'; retry.textContent='Retry proxy';
          retry.onclick=()=>{ window.PROXY?.reset?.(); const current=frame.src; frame.src='about:blank'; setTimeout(async()=>{ try{ frame.src=await window.PROXY.encode(current); retry.remove(); }catch{} },50); };
          root.style.position='relative'; root.append(retry);
        });
      });
    });
    observer.observe(root,{subtree:true,childList:true});
  }

  function scan() {
    document.querySelectorAll('.idk-calls-app').forEach(enhanceCalls);
    document.querySelectorAll('.ai-app').forEach(enhanceAI);
    document.querySelectorAll('.site-frame,.browser-app,.proxy-app').forEach(enhanceBrowser);
  }

  window.addEventListener('idk-game-availability', event => {
    if (event.detail?.ok) window.OS?.notify?.('Games', `${event.detail.name || 'Game'} is ready.`, 'success');
    else if (event.detail) window.OS?.notify?.('Games', event.detail.message || 'Game unavailable.', 'warning');
  });

  addStyle();
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',scan,{once:true}); else scan();
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  window.IDKFinishSuite={scan,health};
})();
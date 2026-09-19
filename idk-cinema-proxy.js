(() => {
  'use strict';
  const TARGET = 'https://cinema.army/';
  function app() {
    const root=document.createElement('div'); root.className='app cinema-proxy-app';
    root.innerHTML='<div class="toolbar"><strong class="count">IDK Cinema</strong><span style="flex:1"></span><span class="count" data-status>Starting Ultraviolet…</span><button class="btn tab" type="button" data-reload>Reload</button><button class="btn tab" type="button" data-fullscreen>Fullscreen</button></div><div class="site-frame cinema-proxy-frame"><iframe title="IDK Cinema" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-read; clipboard-write" allowfullscreen referrerpolicy="no-referrer"></iframe></div>';
    const frame=root.querySelector('iframe'), status=root.querySelector('[data-status]');
    const load=async()=>{ status.textContent='Starting Ultraviolet…'; try { const ok=await PROXY.backendAvailable(); if(!ok) throw new Error('Ultraviolet backend is unavailable.'); status.textContent='Loading through Ultraviolet…'; frame.src=await PROXY.encode(TARGET); frame.onload=()=>status.textContent='Connected through Ultraviolet'; } catch(e){ status.textContent=e.message||'Proxy failed to start.'; frame.removeAttribute('src'); } };
    root.querySelector('[data-reload]').onclick=load;
    root.querySelector('[data-fullscreen]').onclick=()=>frame.requestFullscreen?.().catch(()=>{});
    load(); return root;
  }
  function install(){ if(typeof APPS==='undefined') return; APPS.movies={...(APPS.movies||{}),title:'Movies',glyph:'🎬',desktop:false,dock:false,width:1100,height:720,render:app}; }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true}); else setTimeout(install,0);
})();
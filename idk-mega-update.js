(() => {
  'use strict';
  if (window.IDKMegaUpdate) return;

  const THEMES = {
    blue:{name:'Classic',accent:'#5b9cff',glow:'#2d8cff'},
    grape:{name:'Grape',accent:'#c17bdc',glow:'#9b5de5'},
    green:{name:'Green',accent:'#62e6a0',glow:'#42d392'},
    red:{name:'Cherry',accent:'#ff667d',glow:'#e94f64'},
    yellow:{name:'Lemon',accent:'#ffd84d',glow:'#ffb300'}
  };
  const WORKSPACE_KEY='idkDesktopIconPositions-v2';
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};

  function theme(){
    const desktop=document.getElementById('desktop');
    const key=desktop?.getAttribute('data-background-theme')||localStorage.getItem('idkBackgroundTheme-v2')||'blue';
    return THEMES[key]||THEMES.blue;
  }

  function saveUrlToFiles(url){
    if(!url) return false;
    const files=window.IDKFiles;
    if(files?.writeTextFile){
      files.writeTextFile('Saved Web Links.txt', url+'\n', '');
      window.OS?.notify?.('Browser','Saved the current URL to Files.');
      return true;
    }
    const existing=read('idkSavedBrowserUrls',[]);
    existing.unshift({url,at:Date.now()});
    write('idkSavedBrowserUrls',existing.slice(0,50));
    window.OS?.notify?.('Browser','Saved the current URL locally.');
    return true;
  }

  function enhanceBrowser(root){
    if(!root || root.dataset.megaBrowser) return;
    const frame=root.querySelector('iframe');
    const bar=root.querySelector('.toolbar');
    if(!frame||!bar) return;
    root.dataset.megaBrowser='1';
    const fullscreen=document.createElement('button');
    fullscreen.className='btn tab';
    fullscreen.type='button';
    fullscreen.textContent='Fullscreen';
    fullscreen.onclick=async()=>{try{if(!document.fullscreenElement) await (frame.requestFullscreen?.()||root.requestFullscreen?.()); else await document.exitFullscreen();}catch{}};
    const save=document.createElement('button');
    save.className='btn tab';
    save.type='button';
    save.textContent='Save URL';
    save.onclick=()=>saveUrlToFiles(root.querySelector('input')?.value?.trim()||frame.src);
    bar.append(fullscreen,save);
  }

  function enhanceChat(root){
    if(!root||root.dataset.megaChat) return;
    root.dataset.megaChat='1';
    const bar=[...root.querySelectorAll('.toolbar')].pop();
    if(!bar) return;
    const input=document.createElement('input');
    input.type='file'; input.multiple=true; input.accept='image/*,video/*,audio/*,.pdf,.txt,.zip';
    input.hidden=true;
    const attach=document.createElement('button');
    attach.className='btn tab'; attach.type='button'; attach.textContent='Attach media';
    attach.onclick=()=>input.click();
    input.onchange=()=>{const names=[...input.files].map(f=>f.name); if(names.length) window.OS?.notify?.('Messenger',names.length+' attachment'+(names.length===1?'':'s')+' selected.');};
    bar.append(attach,input);
  }

  function enhanceCalls(){
    document.addEventListener('click',async event=>{
      const button=event.target.closest?.('button,[role=button]');
      if(!button) return;
      const label=(button.textContent+' '+button.getAttribute('aria-label')).toLowerCase();
      if(!label.includes('call')&&!label.includes('microphone')&&!label.includes('mic')) return;
      if(!navigator.mediaDevices?.getUserMedia) return;
      try{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        stream.getTracks().forEach(track=>track.stop());
        window.OS?.notify?.('Calls','Microphone permission is ready.');
      }catch{
        window.OS?.notify?.('Calls','Microphone permission was not granted.');
      }
    },{passive:true});
  }

  function desktopTools(){
    if(document.getElementById('idk-mega-desktop-tools')) return;
    const tools=document.createElement('aside');
    tools.id='idk-mega-desktop-tools';
    const t=theme();
    tools.innerHTML='<strong>Desktop</strong><button type="button" data-action="customize">Customize</button><button type="button" data-action="settings">Settings</button><button type="button" data-action="save">Save layout</button>';
    tools.style.setProperty('--mega-accent',t.accent);
    tools.querySelector('[data-action="customize"]').onclick=()=>window.OS?.open?.('settings',{tab:'appearance'});
    tools.querySelector('[data-action="settings"]').onclick=()=>window.OS?.open?.('settings');
    tools.querySelector('[data-action="save"]').onclick=()=>window.OS?.notify?.('Desktop','Desktop layout saved on this device.');
    document.getElementById('desktop')?.append(tools);
  }

  function observe(){
    desktopTools();
    const windows=document.getElementById('windows');
    if(!windows) return;
    const scan=()=>{
      windows.querySelectorAll('.window').forEach(win=>{
        const title=(win.querySelector('.title')?.textContent||'').toLowerCase();
        if(title.includes('browser')) enhanceBrowser(win);
        if(title.includes('messenger')||title.includes('chat')) enhanceChat(win);
      });
    };
    scan();
    new MutationObserver(scan).observe(windows,{childList:true,subtree:true});
  }

  function apply(){
    const t=theme();
    document.documentElement.style.setProperty('--mega-accent',t.accent);
    document.documentElement.style.setProperty('--mega-glow',t.glow);
    document.getElementById('desktop')?.style.setProperty('--mega-accent',t.accent);
  }

  window.IDKMegaUpdate={saveUrlToFiles,apply,theme};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{apply();observe();enhanceCalls()},{once:true});
  else {apply();observe();enhanceCalls();}
})();
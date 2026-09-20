(() => {
  'use strict';
  const KEY='idkStartupApps-v1', WKEY='idkWidgets-v2', NKEY='idkNotificationPrefs-v1';
  const read=(k,f)=>{try{const v=localStorage.getItem(k);return v===null?f:JSON.parse(v)}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const notify=(t,m,k='info')=>window.OS?.notify?.(t,m,k);
  const appList=()=>Object.entries(typeof APPS==='undefined'?{}:APPS).filter(([id,a])=>id!=='player'&&a?.desktop!==false&&a?.action!==true);
  function startupApp(){
    const root=document.createElement('div'); root.className='app idk-startup-manager';
    const title=document.createElement('h2'); title.textContent='Startup Manager';
    const p=document.createElement('p'); p.textContent='Choose which desktop apps open automatically when IDK starts.';
    const list=document.createElement('div'); list.className='idk-polish-list';
    let saved=read(KEY,[]); if(!Array.isArray(saved))saved=[];
    appList().forEach(([id,a])=>{const cb=document.createElement('input');cb.type='checkbox';cb.checked=saved.includes(id);cb.addEventListener('change',()=>{saved=cb.checked?[...new Set([...saved,id])]:saved.filter(x=>x!==id);write(KEY,saved)});const row=document.createElement('label');row.className='idk-polish-row';row.append(Object.assign(document.createElement('span'),{textContent:(a.glyph||'◼')+' '+a.title}),cb);list.append(row)});
    root.append(title,p,list); return root;
  }
  function notificationsSettings(){
    const root=document.createElement('div');root.className='app idk-notification-settings';
    root.innerHTML='<h2>Notification Settings</h2><p>Control how IDK notifications behave on this device.</p>';
    const prefs={sound:true,toast:true,...read(NKEY,{})};
    [['toast','Show notification popups'],['sound','Notification sounds']].forEach(([key,label])=>{const row=document.createElement('label');row.className='idk-polish-row';const cb=document.createElement('input');cb.type='checkbox';cb.checked=prefs[key];cb.onchange=()=>{prefs[key]=cb.checked;write(NKEY,prefs)};row.append(Object.assign(document.createElement('span'),{textContent:label}),cb);root.append(row)});
    const dnd=document.createElement('button');dnd.className='idk-polish-button';dnd.textContent='Toggle Do Not Disturb';dnd.onclick=()=>{const on=!read('idkDND',false);write('idkDND',on);notify('Notifications',on?'Do Not Disturb is on.':'Do Not Disturb is off.');};root.append(dnd);return root;
  }
  function addWidgets(){
    const desktop=document.getElementById('desktop'); if(!desktop||document.getElementById('idk-widget-layer'))return;
    const layer=document.createElement('div');layer.id='idk-widget-layer';
    const saved=read(WKEY,{});
    const make=(id,title,content,x=18,y=90)=>{const w=document.createElement('section');w.className='idk-widget';w.dataset.widget=id;w.style.left=(saved[id]?.x??x)+'px';w.style.top=(saved[id]?.y??y)+'px';w.innerHTML='<header><strong></strong><button type="button" aria-label="Close widget">×</button></header><div></div>';w.querySelector('strong').textContent=title;w.querySelector('div').append(content);w.querySelector('button').onclick=()=>{w.hidden=true};let sx=0,sy=0,ox=0,oy=0;w.querySelector('header').onpointerdown=e=>{sx=e.clientX;sy=e.clientY;ox=w.offsetLeft;oy=w.offsetTop;w.setPointerCapture?.(e.pointerId);const move=q=>{w.style.left=Math.max(0,ox+q.clientX-sx)+'px';w.style.top=Math.max(0,oy+q.clientY-sy)+'px';};const up=()=>{w.onpointermove=null;write(WKEY,{...read(WKEY,{}),[id]:{x:w.offsetLeft,y:w.offsetTop}})};w.onpointermove=move;w.onpointerup=up};layer.append(w)};
    const clock=document.createElement('strong');clock.className='idk-widget-clock';const tick=()=>clock.textContent=new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});tick();setInterval(tick,1000);
    const note=document.createElement('textarea');note.placeholder='Quick note…';note.value=read('idkWidgetQuickNote','');note.oninput=()=>write('idkWidgetQuickNote',note.value);
    const status=document.createElement('span');status.textContent=navigator.onLine?'Online':'Offline';
    make('clock','Clock',clock);make('note','Quick Note',note,18,190);make('status','System',status,18,300);desktop.append(layer);
  }
  function register(){
    if(typeof APPS==='undefined')return;
    APPS['idk-startup-manager']={title:'Startup Manager',glyph:'🚀',desktop:false,dock:false,width:560,height:520,render:startupApp};
    APPS['idk-notification-settings']={title:'Notification Settings',glyph:'🔔',desktop:false,dock:false,width:560,height:440,render:notificationsSettings};
    window.IDKPolish={widgets:addWidgets,startupKey:KEY};
    addWidgets();
    const startup=read(KEY,[]); if(Array.isArray(startup)&&startup.length) setTimeout(()=>startup.filter(id=>APPS[id]).forEach((id,i)=>setTimeout(()=>window.OS?.open?.(id),500+i*350)),900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',register);else register();
})();
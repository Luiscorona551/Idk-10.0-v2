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
    const defs={
      clock:{title:'Clock',glyph:'🕒',x:18,y:90,content:()=>{const el=document.createElement('strong');el.className='idk-widget-clock';const tick=()=>el.textContent=new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});tick();setInterval(tick,1000);return el}},
      note:{title:'Quick Note',glyph:'📝',x:18,y:190,content:()=>{const el=document.createElement('textarea');el.placeholder='Quick note…';el.value=read('idkWidgetQuickNote','');el.oninput=()=>write('idkWidgetQuickNote',el.value);return el}},
      status:{title:'System',glyph:'💻',x:18,y:300,content:()=>{const el=document.createElement('span');el.textContent=navigator.onLine?'Online':'Offline';window.addEventListener('online',()=>el.textContent='Online');window.addEventListener('offline',()=>el.textContent='Offline');return el}}
    };
    const save=(id,w)=>write(WKEY,{...read(WKEY,{}),[id]:{x:w.offsetLeft,y:w.offsetTop}});
    const remove=(id,w)=>{w.remove();const next={...read(WKEY,{})};delete next[id];write(WKEY,next)};
    const make=(id,opts,x,y)=>{const w=document.createElement('section');w.className='idk-widget';w.dataset.widget=id;w.style.left=(x??opts.x)+'px';w.style.top=(y??opts.y)+'px';w.innerHTML='<header><strong></strong><button type="button" aria-label="Close widget">×</button></header><div></div>';w.querySelector('strong').textContent=opts.title;w.querySelector('div').append(opts.content());w.querySelector('button').onclick=()=>remove(id,w);let sx=0,sy=0,ox=0,oy=0;w.querySelector('header').onpointerdown=e=>{if(e.target.closest('button'))return;sx=e.clientX;sy=e.clientY;ox=w.offsetLeft;oy=w.offsetTop;w.querySelector('header').setPointerCapture?.(e.pointerId);const move=q=>{w.style.left=Math.max(0,ox+q.clientX-sx)+'px';w.style.top=Math.max(0,oy+q.clientY-sy)+'px'};const up=()=>{w.querySelector('header').onpointermove=null;save(id,w)};w.querySelector('header').onpointermove=move;w.querySelector('header').onpointerup=up};layer.append(w);return w};
    const openPicker=()=>{let picker=document.getElementById('idk-widget-picker');if(picker){picker.hidden=false;return}picker=document.createElement('section');picker.id='idk-widget-picker';picker.innerHTML='<header><strong>Widgets</strong><button type="button" aria-label="Close widgets">×</button></header><p>Drag a widget onto the desktop.</p><div class="idk-widget-picker-list"></div>';picker.querySelector('button').onclick=()=>picker.remove();const list=picker.querySelector('.idk-widget-picker-list');Object.entries(defs).forEach(([id,opts])=>{const item=document.createElement('button');item.type='button';item.className='idk-widget-picker-item';item.draggable=true;item.innerHTML='<span class="idk-widget-picker-icon"></span><span><strong></strong><small>Drag to desktop</small></span>';item.querySelector('.idk-widget-picker-icon').textContent=opts.glyph;item.querySelector('strong').textContent=opts.title;item.ondragstart=e=>{e.dataTransfer.setData('text/idk-widget',id);e.dataTransfer.effectAllowed='copy'};item.onclick=()=>{if(!document.querySelector('.idk-widget[data-widget="'+id+'"]'))make(id,opts);picker.remove()};list.append(item)});desktop.append(picker)};
    desktop.addEventListener('contextmenu',e=>{if(e.target.closest('.idk-widget,#idk-widget-picker'))return;e.preventDefault();openPicker()});
    desktop.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('text/idk-widget')){e.preventDefault();e.dataTransfer.dropEffect='copy'}});
    desktop.addEventListener('drop',e=>{const id=e.dataTransfer.getData('text/idk-widget'),opts=defs[id];if(!opts)return;e.preventDefault();if(document.querySelector('.idk-widget[data-widget="'+id+'"]'))return;const rect=desktop.getBoundingClientRect();make(id,opts,Math.max(0,e.clientX-rect.left-90),Math.max(0,e.clientY-rect.top-40));document.getElementById('idk-widget-picker')?.remove()});
    window.IDKWidgetPicker={open:openPicker,add:id=>{if(defs[id]&&!document.querySelector('.idk-widget[data-widget="'+id+'"]'))make(id,defs[id])}};
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
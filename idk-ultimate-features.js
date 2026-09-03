/* IDK 10.0 Ultimate Features Pack - additive, no core app rewrites. */
(() => {
  'use strict';
  if (window.IDKUltimate) return;
  const KEY='idkUltimateState';
  const state=Object.assign({wallpaper:'',theme:'system',iconSize:'normal',notes:'',apps:[],tasks:[],shortcuts:[]},JSON.parse(localStorage.getItem(KEY)||'{}'));
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const notify=(title,msg)=>window.OS?.notify?.(title,msg) || window.showNotification?.(title,msg);
  function inject(html){ const d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstElementChild; }
  function win(title,body,cls='idk-u-window'){
    const el=inject(`<section class="${cls}"><header><strong>${esc(title)}</strong><button aria-label="Close">×</button></header><div class="idk-u-body">${body}</div></section>`);
    document.body.appendChild(el); el.querySelector('header button').onclick=()=>el.remove();
    const head=el.querySelector('header'); let sx=0,sy=0,ox=0,oy=0,drag=false;
    head.addEventListener('pointerdown',e=>{drag=true;sx=e.clientX;sy=e.clientY;const r=el.getBoundingClientRect();ox=r.left;oy=r.top;head.setPointerCapture(e.pointerId)});
    head.addEventListener('pointermove',e=>{if(!drag)return;el.style.left=Math.max(4,ox+e.clientX-sx)+'px';el.style.top=Math.max(4,oy+e.clientY-sy)+'px';el.style.transform='none'});
    head.addEventListener('pointerup',()=>drag=false);
    return el;
  }
  function appTile(name,icon,fn){ const b=document.createElement('button'); b.className='idk-u-tile'; b.innerHTML=`<span>${icon}</span><b>${esc(name)}</b>`; b.onclick=fn; return b; }
  function openHub(){
    const body=`<div class="idk-u-hub-grid"></div><div class="idk-u-hub-foot">IDK 10.0 • Ultimate Feature Pack</div>`;
    const el=win('IDK Applications',body); const g=el.querySelector('.idk-u-hub-grid');
    [['Settings','⚙',openSettings],['App Store','🛍',openStore],['Notes','📝',openNotes],['Calendar','📅',openCalendar],['Terminal','⌨',openTerminal],['Paint','🎨',openPaint],['Media','▶',openMedia],['Control Center','☰',openControl],['Tasks','✓',openTasks],['About IDK','ⓘ',openAbout]].forEach(x=>g.append(appTile(...x)));
  }
  function openSettings(){
    const body=`<div class="idk-u-tabs"><button data-t="appearance">Appearance</button><button data-t="desktop">Desktop</button><button data-t="system">System</button></div><div class="idk-u-setting-pane"></div>`;
    const el=win('IDK Settings',body); const pane=el.querySelector('.idk-u-setting-pane');
    const render=t=>{ if(t==='desktop') pane.innerHTML=`<label>Icon size <select id="u-size"><option>small</option><option>normal</option><option>large</option></select></label><label>Wallpaper URL <input id="u-wall" placeholder="https://…"></label><button id="u-apply">Apply desktop</button>`;
      else if(t==='system') pane.innerHTML=`<h3>System</h3><p>Browser OS • IDK 10.0</p><p>Storage: local browser storage + installed program databases.</p><button id="u-export">Export settings</button> <button id="u-reset">Reset Ultimate settings</button>`;
      else pane.innerHTML=`<label>Theme <select id="u-theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><button id="u-theme-apply">Apply theme</button>`;
      const s=pane.querySelector('#u-size'); if(s)s.value=state.iconSize; const w=pane.querySelector('#u-wall'); if(w)w.value=state.wallpaper; const th=pane.querySelector('#u-theme');if(th)th.value=state.theme;
      pane.querySelector('#u-apply')?.addEventListener('click',()=>{state.iconSize=s.value;state.wallpaper=w.value;save();applyDesktop();});
      pane.querySelector('#u-theme-apply')?.addEventListener('click',()=>{state.theme=th.value;save();applyTheme()});
      pane.querySelector('#u-export')?.addEventListener('click',()=>download('idk-settings.json',JSON.stringify(state,null,2),'application/json'));
      pane.querySelector('#u-reset')?.addEventListener('click',()=>{localStorage.removeItem(KEY);location.reload()});
    };
    el.querySelectorAll('.idk-u-tabs button').forEach(b=>b.onclick=()=>render(b.dataset.t)); render('appearance');
  }
  function applyTheme(){document.documentElement.dataset.idkTheme=state.theme;}
  function applyDesktop(){document.body.style.backgroundImage=state.wallpaper?`url("${state.wallpaper.replace(/"/g,'')}")`:'';document.body.classList.toggle('idk-u-large-icons',state.iconSize==='large');document.body.classList.toggle('idk-u-small-icons',state.iconSize==='small');}
  function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
  function openNotes(){
    const el=win('IDK Notes',`<textarea class="idk-u-notes" placeholder="Start typing…">${esc(state.notes)}</textarea><div class="idk-u-actions"><button id="save">Save</button><button id="export">Export</button></div>`);
    el.querySelector('#save').onclick=()=>{state.notes=el.querySelector('textarea').value;save();notify('IDK Notes','Saved')}; el.querySelector('#export').onclick=()=>download('IDK-Notes.txt',el.querySelector('textarea').value,'text/plain');
  }
  function openCalendar(){
    const now=new Date(), y=now.getFullYear(),m=now.getMonth(); const first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate(); let cells=''; for(let i=0;i<first;i++)cells+='<span></span>';for(let d=1;d<=days;d++)cells+=`<button>${d}</button>`;
    const el=win('IDK Calendar',`<div class="idk-u-cal-title">${now.toLocaleString(undefined,{month:'long'})} ${y}</div><div class="idk-u-week"><b>Sun</b><b>Mon</b><b>Tue</b><b>Wed</b><b>Thu</b><b>Fri</b><b>Sat</b></div><div class="idk-u-cal">${cells}</div><input id="event" placeholder="Event / reminder"><button id="add">Add task</button>`);
    el.querySelector('#add').onclick=()=>{const v=el.querySelector('#event').value.trim();if(v){state.tasks.push({text:v,done:false});save();notify('Calendar',`Added: ${v}`);el.querySelector('#event').value=''}};
  }
  function openTasks(){
    const el=win('IDK Tasks',`<form class="idk-u-task-add"><input placeholder="New task" required><button>Add</button></form><div class="idk-u-task-list"></div>`); const list=el.querySelector('.idk-u-task-list');
    const render=()=>{list.innerHTML='';state.tasks.forEach((t,i)=>{const r=document.createElement('label');r.className='idk-u-task';r.innerHTML=`<input type="checkbox" ${t.done?'checked':''}><span>${esc(t.text)}</span><button type="button">×</button>`;r.querySelector('input').onchange=e=>{t.done=e.target.checked;save()};r.querySelector('button').onclick=()=>{state.tasks.splice(i,1);save();render()};list.append(r)})};
    el.querySelector('form').onsubmit=e=>{e.preventDefault();const i=e.target.querySelector('input');state.tasks.push({text:i.value,done:false});i.value='';save();render()};render();
  }
  function openTerminal(){
    const el=win('IDK Terminal',`<div class="idk-u-terminal-out">IDK Terminal v1.0<br>Type <b>help</b> for commands.</div><form class="idk-u-term"><input autocomplete="off" autofocus><button>Run</button></form>`); const out=el.querySelector('.idk-u-terminal-out'); const input=el.querySelector('input');
    const commands={help:'help, clear, apps, date, time, echo, settings, notes, store, tasks, about',apps:'Settings • App Store • Notes • Calendar • Terminal • Paint • Media • Tasks',date:new Date().toDateString(),time:new Date().toLocaleTimeString(),settings:'Opening Settings…',notes:'Opening Notes…',store:'Opening App Store…',tasks:'Opening Tasks…',about:'IDK 10.0 browser operating system'};
    el.querySelector('form').onsubmit=e=>{e.preventDefault();const raw=input.value.trim(),[c,...a]=raw.split(' ');if(c==='clear'){out.innerHTML='';input.value='';return}let r=commands[c]||`Unknown command: ${esc(c)}`;if(c==='echo')r=esc(a.join(' '));out.innerHTML+=`<div>$ ${esc(raw)}</div><div>${r}</div>`;if(c==='settings')openSettings();if(c==='notes')openNotes();if(c==='store')openStore();if(c==='tasks')openTasks();input.value='';out.scrollTop=out.scrollHeight};
  }
  function openStore(){
    const el=win('IDK App Store',`<input class="idk-u-store-search" placeholder="Search apps and games…"><div class="idk-u-store-grid"></div>`); const grid=el.querySelector('.idk-u-store-grid');
    const built=[['IDK Notes','📝','Write and save notes'],['IDK Calendar','📅','Events and reminders'],['IDK Terminal','⌨','Power-user terminal'],['IDK Paint','🎨','Draw on a canvas'],['IDK Media','▶','Play local media'],['IDK Tasks','✓','Task manager'],['IDK Settings','⚙','Customize IDK']];
    const render=q=>{grid.innerHTML='';built.filter(x=>x[0].toLowerCase().includes(q.toLowerCase())).forEach(x=>{const c=document.createElement('article');c.className='idk-u-store-card';c.innerHTML=`<span>${x[1]}</span><b>${x[0]}</b><small>${x[2]}</small><button>Open</button>`;c.querySelector('button').onclick=()=>({ 'IDK Notes':openNotes,'IDK Calendar':openCalendar,'IDK Terminal':openTerminal,'IDK Paint':openPaint,'IDK Media':openMedia,'IDK Tasks':openTasks,'IDK Settings':openSettings}[x[0]]());grid.append(c)})};el.querySelector('input').oninput=e=>render(e.target.value);render('');
  }
  function openPaint(){
    const el=win('IDK Paint',`<canvas class="idk-u-canvas" width="700" height="430"></canvas><div><input type="color" id="pc"><input type="range" id="ps" min="1" max="30" value="5"><button id="clear">Clear</button><button id="save">Save PNG</button></div>`);const c=el.querySelector('canvas'),x=c.getContext('2d');let down=false;const pos=e=>{const r=c.getBoundingClientRect();return[(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};c.onpointerdown=e=>{down=true;c.setPointerCapture(e.pointerId);const p=pos(e);x.beginPath();x.moveTo(...p)};c.onpointerup=()=>down=false;c.onpointermove=e=>{if(!down)return;const p=pos(e);x.strokeStyle=el.querySelector('#pc').value;x.lineWidth=+el.querySelector('#ps').value;x.lineCap='round';x.lineTo(...p);x.stroke()};el.querySelector('#clear').onclick=()=>x.clearRect(0,0,c.width,c.height);el.querySelector('#save').onclick=()=>{const a=document.createElement('a');a.download='IDK-Paint.png';a.href=c.toDataURL();a.click()};
  }
  function openMedia(){
    const el=win('IDK Media',`<div class="idk-u-media"><input id="file" type="file" accept="audio/*,video/*"><p>Select a local audio or video file.</p><video id="video" controls hidden></video><audio id="audio" controls hidden></audio></div>`);el.querySelector('#file').onchange=e=>{const f=e.target.files[0];if(!f)return;const u=URL.createObjectURL(f);if(f.type.startsWith('video/')){const v=el.querySelector('video');v.hidden=false;v.src=u}else{const a=el.querySelector('audio');a.hidden=false;a.src=u}};
  }
  function openControl(){
    const body=`<div class="idk-u-quick"><button id="dark">Dark</button><button id="light">Light</button><button id="full">Fullscreen</button><button id="clear-notify">Clear notifications</button><button id="refresh">Refresh</button></div><hr><strong>System status</strong><p>Online • Local storage ready • ${navigator.onLine?'Network online':'Offline'}</p>`;const el=win('Control Center',body);el.querySelector('#dark').onclick=()=>{state.theme='dark';save();applyTheme()};el.querySelector('#light').onclick=()=>{state.theme='light';save();applyTheme()};el.querySelector('#full').onclick=()=>document.documentElement.requestFullscreen?.();el.querySelector('#refresh').onclick=()=>location.reload();el.querySelector('#clear-notify').onclick=()=>{document.querySelector('#notifications-panel')?.querySelector('#notifications-clear')?.click();el.remove()};
  }
  function openAbout(){win('About IDK 10.0',`<h2>IDK 10.0</h2><p>A browser-based desktop operating system.</p><p>Ultimate features enabled: settings, app store, notes, calendar, tasks, terminal, paint, media, control center, desktop customization and keyboard shortcuts.</p>`)}
  function contextMenu(e){
    e.preventDefault();document.querySelector('.idk-u-context')?.remove();const m=inject(`<menu class="idk-u-context"><button data-a="apps">Applications</button><button data-a="control">Control Center</button><button data-a="settings">Settings</button><button data-a="notes">New Note</button><button data-a="refresh">Refresh</button></menu>`);m.style.left=Math.min(e.clientX,innerWidth-210)+'px';m.style.top=Math.min(e.clientY,innerHeight-180)+'px';document.body.append(m);m.onclick=x=>{const a=x.target.dataset.a;if(a==='apps')openHub();if(a==='control')openControl();if(a==='settings')openSettings();if(a==='notes')openNotes();if(a==='refresh')location.reload();m.remove()};setTimeout(()=>document.addEventListener('pointerdown',()=>m.remove(),{once:true}),0);
  }
  function shortcuts(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openHub()}if(e.key==='Escape'){document.querySelectorAll('.idk-u-window,.idk-u-context').forEach(x=>x.remove())}if(e.altKey&&e.key.toLowerCase()==='t'){e.preventDefault();openTerminal()}}
  function addLauncher(){if(document.querySelector('#idk-ultimate-launcher'))return;const b=document.createElement('button');b.id='idk-ultimate-launcher';b.title='IDK Applications';b.innerHTML='<span>◈</span><small>Apps</small>';b.onclick=openHub;document.body.append(b)}
  function init(){applyTheme();applyDesktop();document.addEventListener('contextmenu',e=>{if(e.target.closest('#desktop')||e.target.id==='desktop')contextMenu(e)});document.addEventListener('keydown',shortcuts);window.IDKUltimate={openHub,openSettings,openStore,openNotes,openCalendar,openTerminal,openPaint,openMedia,openControl,openTasks};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

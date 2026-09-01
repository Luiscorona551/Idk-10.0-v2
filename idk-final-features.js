(() => {
  'use strict';
  const installedKey='idkInstalledPrograms';
  const cardsKey='idkDesktopCards';
  const sheetKey='idkSheetsData';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=(k,f)=>{try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch{return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};

  function css(){if($('#idk-final-style'))return;const l=document.createElement('link');l.id='idk-final-style';l.rel='stylesheet';l.href='idk-final-features.css';document.head.append(l)}
  function notify(t,m,k='info'){if(window.OS?.notify)OS.notify(t,m,k);else console.info(t,m)}

  function modal(title,body,wide=false){
    const o=document.createElement('div');o.className='idk-feature-overlay';
    const w=document.createElement('section');w.className='idk-feature-window'+(wide?' wide':'');
    w.innerHTML=`<header class="idk-feature-titlebar"><strong>${esc(title)}</strong><button type="button" class="idk-feature-close">×</button></header><div class="idk-feature-content"></div>`;
    $('.idk-feature-content',w).append(body);o.append(w);document.body.append(o);
    $('.idk-feature-close',w).onclick=()=>o.remove();o.addEventListener('pointerdown',e=>{if(e.target===o)o.remove()});return o;
  }

  function openSheets(){
    const root=document.createElement('div');root.className='idk-sheets-app';
    let data=read(sheetKey,null);if(!Array.isArray(data)||!data.length)data=Array.from({length:12},(_,r)=>Array.from({length:6},(_,c)=>r===0?`Column ${String.fromCharCode(65+c)}`:''));
    const render=()=>{const table=$('.idk-sheet-table',root);table.innerHTML='';data.forEach((row,r)=>{const tr=document.createElement('tr');for(let c=0;c<6;c++){const td=document.createElement('td');td.contentEditable='true';td.dataset.r=r;td.dataset.c=c;td.textContent=row[c]??'';tr.append(td)}table.append(tr)});};
    root.innerHTML=`<div class="idk-sheet-toolbar"><button class="btn" data-s="new">＋ New</button><button class="btn tab" data-s="import">Import CSV</button><button class="btn tab" data-s="export">Export CSV</button><button class="btn tab" data-s="sum">Σ Sum</button><button class="btn tab" data-s="avg">Average</button><span class="idk-sheet-result">Ready</span><input class="idk-sheet-file" type="file" accept=".csv,text/csv" hidden></div><div class="idk-sheet-scroll"><table class="idk-sheet-table"></table></div><div class="idk-sheet-status">Editable spreadsheet · changes save automatically in this browser.</div>`;
    render();
    root.addEventListener('input',e=>{const td=e.target.closest('td');if(!td)return;data[+td.dataset.r][+td.dataset.c]=td.textContent;write(sheetKey,data)});
    $('[data-s="new"]',root).onclick=()=>{data=Array.from({length:12},()=>Array.from({length:6},()=>''));render();write(sheetKey,data)};
    $('[data-s="import"]',root).onclick=()=>$('.idk-sheet-file',root).click();
    $('.idk-sheet-file',root).onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const text=await f.text();data=text.split(/\r?\n/).filter(Boolean).map(line=>line.split(',').map(x=>x.replace(/^"|"$/g,'')));while(data.length<12)data.push(Array(6).fill(''));render();write(sheetKey,data)};
    $('[data-s="export"]',root).onclick=()=>{const csv=data.map(row=>row.map(x=>`"${String(x??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='idk-sheet.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
    const calc=(avg)=>{const nums=data.flat().map(Number).filter(Number.isFinite);const v=nums.length?(avg?nums.reduce((a,b)=>a+b,0)/nums.length:nums.reduce((a,b)=>a+b,0)):0;$('.idk-sheet-result',root).textContent=(avg?'Average: ':'Sum: ')+v.toLocaleString(undefined,{maximumFractionDigits:4})};
    $('[data-s="sum"]',root).onclick=()=>calc(false);$('[data-s="avg"]',root).onclick=()=>calc(true);
    modal('Idk Sheets',root,true)
  }

  function openDM(){
    const root=document.createElement('div');root.className='idk-dm-app';root.innerHTML=`<div class="idk-dm-user"><span class="idk-dm-avatar">L</span><div><strong>Luna</strong><small>Online · Direct message</small></div><span class="idk-dm-more">•••</span></div><div class="idk-dm-messages"><div class="idk-dm-bubble them">Hey! 👋<small>9:40 AM</small></div><div class="idk-dm-bubble me">Hey Luna! How are you?<small>9:41 AM</small></div><div class="idk-dm-bubble them">I'm good! Just working on some new ideas ✨<small>9:41 AM</small></div></div><form class="idk-dm-compose"><input class="field" placeholder="Type a message…" autocomplete="off"><button class="btn" type="submit">➤</button></form>`;
    $('.idk-dm-compose',root).onsubmit=e=>{e.preventDefault();const i=$('input',root);const v=i.value.trim();if(!v)return;const b=document.createElement('div');b.className='idk-dm-bubble me';b.innerHTML=`${esc(v)}<small>now</small>`;$('.idk-dm-messages',root).append(b);i.value='';$('.idk-dm-messages',root).scrollTop=99999};modal('Direct DM',root)
  }
  function openChat(){
    const root=document.createElement('div');root.className='idk-chat-app';root.innerHTML=`<aside><strong># Channels</strong><button class="active"># general</button><button># gaming</button><button># tech</button><button># media</button><button># off-topic</button><hr><strong>Voice</strong><button>◉ General</button><button>◉ Gaming</button></aside><main><div class="idk-chat-head"><strong>Chat Room</strong><small>5 people online</small></div><div class="idk-chat-messages"><p><b>Alex</b> Good morning everyone! 👋</p><p><b>Jordan</b> Anyone up for a game later?</p><p><b>Taylor</b> I just finished the new update, it's amazing!</p><p><b>Morgan</b> Check out this cool screenshot!</p></div><form class="idk-chat-compose"><input class="field" placeholder="Message #general…"><button class="btn" type="submit">➤</button></form></main>`;
    $('.idk-chat-compose',root).onsubmit=e=>{e.preventDefault();const i=$('input',root);if(!i.value.trim())return;const p=document.createElement('p');p.innerHTML=`<b>You</b> ${esc(i.value.trim())}`;$('.idk-chat-messages',root).append(p);i.value=''};modal('Chat Room',root,true)
  }

  function openBrowser(q=''){
    const root=document.createElement('div');root.className='idk-browser-app';root.innerHTML=`<div class="idk-browser-bar"><button class="btn tab" data-b="back">←</button><button class="btn tab">→</button><input class="field" value="${esc(q)}" placeholder="Ask IDK or browse GitHub…"><button class="btn" data-b="go">Search</button></div><div class="idk-browser-note"><strong>IDK Browser · GitHub Search</strong><span>Search GitHub repositories and public project discussions for an answer or starting point.</span></div><iframe class="idk-browser-frame" title="GitHub browser" loading="lazy"></iframe>`;
    const go=()=>{const v=$('.idk-browser-bar input',root).value.trim();if(!v)return;$('.idk-browser-frame',root).src='https://github.com/search?q='+encodeURIComponent(v)+'&type=repositories';};
    $('[data-b="go"]',root).onclick=go;$('.idk-browser-bar input',root).onkeydown=e=>{if(e.key==='Enter')go()};modal('IDK Browser',root,true);if(q)go()
  }

  const cardTypes={
    weather:{label:'Weather',icon:'☁️'},news:{label:'News',icon:'📰'},calendar:{label:'Calendar',icon:'📅'},stocks:{label:'Stocks',icon:'📈'},sports:{label:'Sports Scores',icon:'🏆'}
  };
  function makeCard(type){const c=document.createElement('article');c.className='idk-glance-card';c.dataset.cardType=type;c.innerHTML=`<header><span>${cardTypes[type].icon} ${cardTypes[type].label}</span><button title="Refresh">↻</button></header><div class="idk-card-body"><span class="idk-card-loading">Loading…</span></div>`;$('.idk-card-body',c).innerHTML='';refreshCard(c,type);$('.idk-glance-card header button',c).onclick=()=>refreshCard(c,type);return c}
  async function refreshCard(card,type){const b=$('.idk-card-body',card);b.innerHTML='<span class="idk-card-loading">Updating…</span>';
    try{
      if(type==='weather'){let lat=34.05,lon=-118.25,name='Local area';try{const p=await new Promise(r=>navigator.geolocation.getCurrentPosition(x=>r(x.coords),()=>r(null),{timeout:2500}));if(p){lat=p.latitude;lon=p.longitude}}catch{}const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m`);const d=await r.json();b.innerHTML=`<strong>${Math.round(d.current.temperature_2m)}°${d.current_units.temperature_2m==='°C'?'C':'F'}</strong><span>Current conditions · wind ${Math.round(d.current.wind_speed_10m)} km/h</span>`}
      else if(type==='calendar'){const now=new Date();b.innerHTML=`<strong>${now.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</strong><span>${now.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} · No synced meetings</span>`}
      else if(type==='news'){const r=await fetch('https://api.allorigins.win/raw?url='+encodeURIComponent('https://feeds.bbci.co.uk/news/rss.xml'));const t=await r.text();const doc=new DOMParser().parseFromString(t,'text/xml');const items=[...doc.querySelectorAll('item')].slice(0,3);b.innerHTML=items.length?items.map(x=>`<div class="idk-card-line"><b>${esc(x.querySelector('title')?.textContent||'Headline')}</b></div>`).join(''):'<span>News unavailable right now.</span>'}
      else if(type==='stocks'){const syms=['AAPL','MSFT','GOOGL'];const rows=await Promise.all(syms.map(async s=>{const r=await fetch(`https://stooq.com/q/l/?s=${s.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`);const txt=await r.text();const line=txt.split(/\r?\n/)[1]||'';const p=line.split(',');return `${s}: ${p[6]||'—'}`}));b.innerHTML=rows.map(x=>`<div class="idk-card-line">${esc(x)}</div>`).join('')}
      else if(type==='sports'){const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');const d=await r.json();const games=(d.events||[]).slice(0,3);b.innerHTML=games.length?games.map(g=>{const c=g.competitions?.[0]?.competitors||[];return `<div class="idk-card-line"><b>${esc(c[0]?.team?.abbreviation||'TBD')} ${esc(c[0]?.score||'—')}</b> · ${esc(c[1]?.team?.abbreviation||'TBD')} ${esc(c[1]?.score||'—')}</div>`}).join(''):'<span>No games scheduled.</span>'}
    }catch(e){b.innerHTML='<span>Live data unavailable. Tap ↻ to try again.</span>'}
  }

  function cardMenu(x,y){const old=$('.idk-card-menu');old?.remove();const m=document.createElement('div');m.className='idk-card-menu';m.style.left=Math.min(x,innerWidth-190)+'px';m.style.top=Math.min(y,innerHeight-260)+'px';m.innerHTML=`<strong>Add App Card</strong>${Object.entries(cardTypes).map(([k,v])=>`<button data-card-add="${k}">${v.icon} ${v.label}</button>`).join('')}<hr><button data-card-clear>Remove all cards</button>`;document.body.append(m);$$('[data-card-add]',m).forEach(b=>b.onclick=()=>{addCard(b.dataset.cardAdd);m.remove()});$('[data-card-clear]',m).onclick=()=>{$$('.idk-glance-card').forEach(e=>e.remove());write(cardsKey,[]);m.remove()};setTimeout(()=>document.addEventListener('pointerdown',()=>m.remove(),{once:true}),0)}
  function addCard(type){const types=read(cardsKey,[]);if(types.includes(type))return;types.push(type);write(cardsKey,types);const desk=$('#desktop');if(desk&&!$('.idk-glance-layer')){const layer=document.createElement('div');layer.className='idk-glance-layer';desk.append(layer)}$('.idk-glance-layer')?.append(makeCard(type))}
  function initCards(){const desk=$('#desktop');if(!desk)return;const layer=document.createElement('div');layer.className='idk-glance-layer';desk.append(layer);read(cardsKey,[]).forEach(t=>cardTypes[t]&&layer.append(makeCard(t)));desk.addEventListener('contextmenu',e=>{if(e.target.closest('button,.window,#start-menu,#dock'))return;e.preventDefault();cardMenu(e.clientX,e.clientY)});}

  function addDesktopIcon(id,label,icon,action){const layer=$('#icons');if(!layer||$$('#icons [data-final-app]').some(x=>x.dataset.finalApp===id))return;const b=document.createElement('button');b.type='button';b.className='idk-final-desktop-icon';b.dataset.finalApp=id;b.innerHTML=`<span>${icon}</span><label>${esc(label)}</label>`;b.ondblclick=action;layer.append(b)}
  function trash(){const programs=read(installedKey,[]);const o=modal('Trash',document.createElement('div'));const root=$('.idk-feature-content',o);root.innerHTML=`<div class="idk-trash-head">Installed games & programs</div><div class="idk-trash-list"></div><p class="idk-trash-note">Deleting removes the saved program and its desktop shortcut from IDK 10.0.</p>`;const list=$('.idk-trash-list',root);if(!programs.length)list.innerHTML='<div class="idk-file-empty">Trash is empty.</div>';programs.forEach(p=>{const row=document.createElement('div');row.className='idk-trash-row';row.innerHTML=`<span>${esc(p.icon||'🎮')}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.fileName||'HTML program')}</small></div><button class="btn tab">Delete</button>`;$('button',row).onclick=()=>{const next=read(installedKey,[]).filter(x=>x.id!==p.id);write(installedKey,next);$$('[data-installed-program="'+CSS.escape(p.id)+'"]').forEach(x=>x.remove());row.remove();if(!list.children.length)list.innerHTML='<div class="idk-file-empty">Trash is empty.</div>'};list.append(row)})}

  function addIcons(){addDesktopIcon('sheets','Idk Sheets','📊',openSheets);addDesktopIcon('chat','Chat Room','💬',openChat);addDesktopIcon('dm','Direct DM','➤',openDM);const existingTrash=$('#idk-trash-icon');if(!existingTrash){const b=document.createElement('button');b.id='idk-trash-icon';b.className='idk-final-trash';b.type='button';b.title='Trash';b.innerHTML='<span>🗑️</span><label>Trash</label>';b.onclick=trash;$('#desktop')?.append(b)}}

  function enhanceStartSearch(){const input=$('#start-search');if(!input||input.dataset.finalSearch)return;input.dataset.finalSearch='1';const wrap=document.createElement('div');wrap.className='idk-start-browser-row';wrap.innerHTML='<button type="button" class="btn">⌕ Ask IDK (Powered by GitHub)</button>';input.insertAdjacentElement('afterend',wrap);$('.btn',wrap).onclick=()=>openBrowser(input.value.trim());input.addEventListener('keydown',e=>{if(e.key==='Enter'&&input.value.trim())openBrowser(input.value.trim())})}

  function installerDestinationPatch(){const observer=new MutationObserver(()=>{$$('.idk-install-destination span').forEach(s=>{if(/C:\\\\IDK|C:\\IDK|IDK\\Programs/i.test(s.textContent))s.innerHTML='<b>Desktop</b> · IDK 10.0 Desktop';});});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),120000)}
  function init(){css();initCards();addIcons();enhanceStartSearch();installerDestinationPatch();setTimeout(addIcons,1000);setInterval(()=>$$('.idk-glance-card').forEach(c=>refreshCard(c,c.dataset.cardType)),300000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

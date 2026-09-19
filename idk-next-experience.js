(() => {
  'use strict';
  if (window.IDKNextExperience) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notify = (t,m,k='info') => window.OS?.notify?.(t,m,k);
  const read = (k,d) => { try { const v=localStorage.getItem(k); return v===null?d:JSON.parse(v); } catch { return d; } };
  const write = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} };
  const get = async u => { const r=await fetch(u,{credentials:'same-origin',cache:'no-store'}); const d=await r.json().catch(()=>({})); if(!r.ok) throw Error(d.error||r.status); return d; };
  const post = async (u,b={}) => { const r=await fetch(u,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(b)}); const d=await r.json().catch(()=>({})); if(!r.ok) throw Error(d.error||r.status); return d; };

  const browser = {
    tabs: read('idk-browser-tabs',[{id:'home',title:'New tab',url:'https://duckduckgo.com/'}]),
    current: read('idk-browser-current','home'),
    history: read('idk-browser-history',[]),
    save(){ write('idk-browser-tabs',this.tabs.slice(-20)); write('idk-browser-current',this.current); write('idk-browser-history',this.history.slice(-200)); }
  };

  function browserBar(root){
    const state=document.createElement('div'); state.className='idk-next-browserbar';
    state.innerHTML='<div class="idk-next-tabs"></div><form class="idk-next-address"><button type="button" data-new>＋</button><input class="field" name="url" placeholder="Search or enter address"><button class="btn" type="submit">Go</button><button class="btn tab" type="button" data-retry>Retry proxy</button></form><div class="idk-next-browser-status">Proxy: checking…</div>';
    root.prepend(state);
    const tabs=state.querySelector('.idk-next-tabs'), address=state.querySelector('[name=url]'), status=state.querySelector('.idk-next-browser-status');
    const render=()=>{ tabs.replaceChildren(...browser.tabs.map(t=>{const b=document.createElement('button');b.className='btn tab'+(t.id===browser.current?' active':'');b.textContent=t.title||'Tab';b.onclick=()=>{browser.current=t.id;address.value=t.url;browser.save();render();};return b;})); const t=browser.tabs.find(x=>x.id===browser.current)||browser.tabs[0]; address.value=t?.url||''; };
    const navigate=async value=>{let url=value.trim(); if(!url)return; const t=browser.tabs.find(x=>x.id===browser.current)||browser.tabs[0]; try{const encoded=await window.PROXY.encode(url); t.url=url;t.title=url.replace(/^https?:\/\//,'').slice(0,32)||'New tab'; browser.history.push({url,time:Date.now()});browser.save(); render(); return encoded;}catch(e){status.textContent='Proxy error: '+e.message; notify('Browser','Proxy connection failed. Tap Retry proxy.','warning');}};
    state.querySelector('form').onsubmit=async e=>{e.preventDefault();const encoded=await navigate(address.value);if(encoded){let frame=root.querySelector('iframe[data-browser-frame]');if(!frame){frame=document.createElement('iframe');frame.dataset.browserFrame='1';frame.className='idk-next-browserframe';frame.allow='fullscreen; autoplay';root.append(frame);}frame.src=encoded;}};
    state.querySelector('[data-new]').onclick=()=>{const id='tab-'+Date.now();browser.tabs.push({id,title:'New tab',url:'https://duckduckgo.com/'});browser.current=id;browser.save();render();};
    state.querySelector('[data-retry]').onclick=async()=>{window.PROXY.reset?.();try{const s=await get('/api/status');status.textContent=s.proxy?'Proxy: online':'Proxy: offline';}catch{status.textContent='Proxy: offline';}};
    get('/api/status').then(s=>status.textContent=s.proxy?'Proxy: online · Wisp ready':'Proxy: offline').catch(()=>status.textContent='Proxy: offline');
    render();
  }

  function filesPanel(root){
    root.innerHTML='<header class="idk-next-head"><div><b>FILES 2.0</b><h2>Your files</h2><p>PostgreSQL-backed storage with previews and quick actions.</p></div><button class="btn" data-upload>Upload</button></header><div class="idk-next-file-status">Loading…</div><div class="idk-next-file-grid"></div>';
    const status=root.querySelector('.idk-next-file-status'), grid=root.querySelector('.idk-next-file-grid');
    const render=files=>{grid.replaceChildren(...files.map(f=>{const el=document.createElement('article');el.className='idk-next-file';el.innerHTML='<strong>'+esc(f.name)+'</strong><small>'+esc(f.mime)+' · '+Math.round((f.size||0)/1024)+' KB</small><div><button class="btn tab" data-open>Open</button><button class="btn tab" data-delete>Delete</button></div>';el.querySelector('[data-open]').onclick=()=>window.open('/api/account/files/'+encodeURIComponent(f.id)+'/content','_blank');el.querySelector('[data-delete]').onclick=async()=>{if(!confirm('Delete this file?'))return;await fetch('/api/account/files/'+encodeURIComponent(f.id),{method:'DELETE',credentials:'same-origin'});load();};return el;}));};
    const load=async()=>{try{const d=await get('/api/account/files');render(d.files||[]);status.textContent=(d.files||[]).length+' file(s)';}catch(e){status.textContent='Sign in to use cloud files.';grid.replaceChildren();}};
    root.querySelector('[data-upload]').onclick=()=>{const input=document.createElement('input');input.type='file';input.multiple=true;input.onchange=async()=>{for(const file of input.files){if(file.size>15*1024*1024){notify('Files',file.name+' is larger than 15 MB.','warning');continue;}const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});try{await post('/api/account/files',{id:crypto.randomUUID(),name:file.name,mime:file.type||'application/octet-stream',contentBase64:b64});}catch(e){notify('Files',e.message,'warning');}}load();};input.click();}; load();
  }

  function aiPanel(root){
    const chats=read('idk-ai-conversations',[]); let active=chats[0]?.id||'';
    root.innerHTML='<header class="idk-next-head"><div><b>AI WORKSPACE</b><h2>Saved conversations</h2><p>Keep useful chats on this device and sync account state when available.</p></div><button class="btn" data-new>New chat</button></header><div class="idk-next-ai-layout"><aside data-list></aside><section><input class="field" data-title placeholder="Conversation name"><textarea class="field" data-input rows="6" placeholder="Ask AI…"></textarea><button class="btn" data-save>Save conversation</button><p data-status></p></section></div>';
    const list=root.querySelector('[data-list]'), title=root.querySelector('[data-title]'), input=root.querySelector('[data-input]'), st=root.querySelector('[data-status]');
    const render=()=>{list.replaceChildren(...chats.map(c=>{const b=document.createElement('button');b.className='btn tab';b.textContent=c.title||'Untitled';b.onclick=()=>{active=c.id;title.value=c.title;input.value=c.text;};return b;}));};
    root.querySelector('[data-new]').onclick=()=>{active='';title.value='';input.value='';};
    root.querySelector('[data-save]').onclick=()=>{const c={id:active||crypto.randomUUID(),title:title.value.trim()||'Untitled chat',text:input.value,updatedAt:Date.now()};const i=chats.findIndex(x=>x.id===c.id);if(i>=0)chats[i]=c;else chats.unshift(c);write('idk-ai-conversations',chats);active=c.id;render();st.textContent='Saved locally.';notify('AI','Conversation saved.','success');};
    render();
  }

  function securityPanel(root){
    root.innerHTML='<header class="idk-next-head"><div><b>SECURITY CENTER</b><h2>Account protection</h2><p>Review your account, devices, recovery, and backend health.</p></div><button class="btn" data-refresh>Refresh</button></header><div class="idk-next-security-grid"><article><b>Backend</b><p data-backend>Checking…</p></article><article><b>Database</b><p data-db>Checking…</p></article><article><b>Devices</b><p data-devices>Checking…</p></article><article><b>Recovery</b><p>Generate recovery codes from your account settings.</p></article></div><div class="idk-next-security-actions"><button class="btn tab" data-revoke>Revoke other devices</button><button class="btn tab" data-codes>Generate recovery codes</button></div><pre data-output></pre>';
    const refresh=async()=>{try{const h=await get('/api/health');root.querySelector('[data-backend]').textContent=h.proxy?'Ultraviolet/Wisp online':'Proxy offline';root.querySelector('[data-db]').textContent=h.database?.configured?'PostgreSQL connected':'Database not configured';}catch(e){root.querySelector('[data-backend]').textContent='Backend unavailable';}try{const d=await get('/api/account/devices');root.querySelector('[data-devices]').textContent=(d.devices||[]).filter(x=>!x.revokedAt).length+' active device(s)';}catch{root.querySelector('[data-devices]').textContent='Sign in to view devices';}};
    root.querySelector('[data-refresh]').onclick=refresh;
    root.querySelector('[data-revoke]').onclick=async()=>{try{const d=await post('/api/account/devices/revoke-others');notify('Security',(d.revokedDevices||0)+' device(s) revoked.','success');refresh();}catch(e){notify('Security',e.message,'warning');}};
    root.querySelector('[data-codes]').onclick=async()=>{try{const d=await post('/api/account/recovery-codes');root.querySelector('[data-output]').textContent=(d.codes||[]).join('\n');notify('Security','New recovery codes generated. Store them somewhere safe.','success');}catch(e){notify('Security',e.message,'warning');}};
    refresh();
  }

  function gamesPanel(root){
    root.innerHTML='<header class="idk-next-head"><div><b>GAMES 2.0</b><h2>Game Center</h2><p>Launcher and emulator diagnostics.</p></div><button class="btn" data-check>Check emulator</button></header><div class="idk-next-game-grid"><article><b>Emulator</b><p data-status>Not checked.</p></article><article><b>Fullscreen</b><p>Use the game window fullscreen control.</p></article><article><b>Save states</b><p>Ready for browser-supported emulator saves.</p></article></div>';
    root.querySelector('[data-check]').onclick=async()=>{try{const r=await fetch('/game.html',{credentials:'same-origin',cache:'no-store'});root.querySelector('[data-status]').textContent=r.ok?'Game runtime reachable.':'Game runtime returned '+r.status;}catch(e){root.querySelector('[data-status]').textContent='Game runtime unavailable.';}};
  }

  const css=document.createElement('style'); css.textContent='.idk-next-head{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px;border-bottom:1px solid rgba(255,255,255,.12)}.idk-next-head h2{margin:.2rem 0}.idk-next-head p{margin:.2rem 0;opacity:.72}.idk-next-browserbar{display:grid;gap:8px;padding:10px}.idk-next-tabs{display:flex;gap:6px;overflow:auto}.idk-next-browserframe{width:100%;height:calc(100vh - 180px);border:0;background:#fff}.idk-next-browser-status{font-size:12px;opacity:.75}.idk-next-file-grid,.idk-next-game-grid,.idk-next-security-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:16px}.idk-next-file,.idk-next-game-grid article,.idk-next-security-grid article{padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.05)}.idk-next-file small{display:block;opacity:.7;margin:6px 0 12px}.idk-next-security-actions{display:flex;gap:8px;padding:0 16px;flex-wrap:wrap}.idk-next-ai-layout{display:grid;grid-template-columns:220px 1fr;gap:14px;padding:16px}.idk-next-ai-layout aside{display:flex;flex-direction:column;gap:6px}.idk-next-ai-layout textarea{width:100%;min-height:180px}.idk-next-ai-layout input{width:100%;margin-bottom:8px}.idk-next-security-grid pre{white-space:pre-wrap}@media(max-width:700px){.idk-next-ai-layout{grid-template-columns:1fr}.idk-next-browserframe{height:65vh}}';
  document.head.append(css);

  function install(){
    if(typeof APPS==='undefined') return;
    APPS.files={...(APPS.files||{}),title:'Files 2.0',glyph:'▣',desktop:true,dock:true,width:980,height:720,render:()=>{const r=document.createElement('div');r.className='app';filesPanel(r);return r;}};
    APPS.ai={...(APPS.ai||{}),title:'AI Workspace',render:()=>{const r=document.createElement('div');r.className='app';aiPanel(r);return r;}};
    APPS.games={...(APPS.games||{}),title:'Game Center',render:()=>{const r=document.createElement('div');r.className='app';gamesPanel(r);return r;}};
    APPS.security={title:'Security Center',glyph:'🔐',desktop:false,dock:false,width:850,height:650,render:()=>{const r=document.createElement('div');r.className='app';securityPanel(r);return r;}};
    APPS.browser={...(APPS.browser||{}),title:'Browser 2.0',glyph:'🌐',render:options=>{const r=document.createElement('div');r.className='app';browserBar(r);return r;}};
  }
  window.IDKNextExperience={browser,refresh:()=>location.reload()};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();
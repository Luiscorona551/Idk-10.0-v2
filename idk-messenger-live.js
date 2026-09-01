(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = 'idkMessengerProfile';
  const profile = () => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };
  const save = p => { try { localStorage.setItem(key, JSON.stringify(p)); } catch {} };
  let socket = null, state = { users: [], room: '', me: '', selected: null };

  function addStyles(){ if(document.getElementById('idk-live-messenger-style')) return; const l=document.createElement('link'); l.id='idk-live-messenger-style'; l.rel='stylesheet'; l.href='idk-messenger-live.css'; document.head.append(l); }
  function openMessenger(){
    addStyles(); document.querySelector('.idk-live-messenger-overlay')?.remove();
    const p=profile();
    const o=document.createElement('div'); o.className='idk-live-messenger-overlay';
    const w=document.createElement('section'); w.className='idk-live-messenger';
    w.innerHTML=`<header class="idk-live-title"><strong>Idk Messenger</strong><span class="idk-live-status">Offline</span><button class="idk-live-close">×</button></header>
      <div class="idk-live-connect"><input class="field" data-m-name maxlength="24" placeholder="Your name" value="${esc(p.name||'')}"><input class="field" data-m-room maxlength="32" placeholder="Room name" value="${esc(p.room||'general')}"><button class="btn" data-m-connect>Connect</button></div>
      <nav class="idk-live-tabs"><button class="active" data-tab="room">💬 Chat Room</button><button data-tab="dm">💙 Direct DMs</button></nav>
      <div class="idk-live-body"><aside class="idk-live-members"><strong>People in room</strong><div data-members><span class="muted">Connect to see people.</span></div></aside><main class="idk-live-main"><div class="idk-live-room" data-pane="room"><div class="idk-live-heading"><strong># <span data-room-title>general</span></strong><small>Messages are shared with everyone in this room.</small></div><div class="idk-live-messages" data-room-messages></div><form class="idk-live-compose" data-room-form><input class="field" placeholder="Message the room…" autocomplete="off"><button class="btn" type="submit">Send</button></form></div><div class="idk-live-dm" data-pane="dm" hidden><div class="idk-live-heading"><strong data-dm-title>Direct messages</strong><small>Private messages are sent only to the selected person.</small></div><div class="idk-live-messages" data-dm-messages><div class="idk-live-empty">Select someone from the room to start a private conversation.</div></div><form class="idk-live-compose" data-dm-form><input class="field" placeholder="Write a private message…" autocomplete="off" disabled><button class="btn" type="submit" disabled>Send</button></form></div></main></div>`;
    w.querySelector('.idk-live-close').onclick=()=>{o.remove(); if(socket){socket.close();socket=null;}};
    o.append(w); document.body.append(o);
    const status=w.querySelector('.idk-live-status'), name=w.querySelector('[data-m-name]'), room=w.querySelector('[data-m-room]'), members=w.querySelector('[data-members]'), roomMsgs=w.querySelector('[data-room-messages]'), dmMsgs=w.querySelector('[data-dm-messages]'), dmTitle=w.querySelector('[data-dm-title]'), dmInput=w.querySelector('[data-dm-form] input'), dmButton=w.querySelector('[data-dm-form] button');
    const roomTitle=w.querySelector('[data-room-title]');
    const addMessage=(target,payload,privateMsg=false)=>{const item=document.createElement('article'); const mine=payload.fromId===state.me || (!payload.fromId && payload.name===state.me); item.className='idk-live-message '+(mine?'mine':''); item.innerHTML=`<div class="idk-live-message-meta"><strong>${esc(payload.name||'anon')}</strong><time>${new Date(payload.at||Date.now()).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</time>${privateMsg?' · private':''}</div><div>${esc(payload.text)}</div>`; target.append(item); target.scrollTop=target.scrollHeight;};
    const renderUsers=()=>{members.replaceChildren(); if(!state.users.length){members.innerHTML='<span class="muted">No one else is connected.</span>';return;} state.users.forEach(u=>{const b=document.createElement('button');b.className='idk-live-member'+(state.selected===u.id?' selected':'');b.type='button';b.innerHTML=`<span class="idk-live-dot"></span><span><strong>${esc(u.name)}</strong><small>${u.id===state.me?'You':'Online'}</small></span>`; if(u.id!==state.me)b.onclick=()=>{state.selected=u.id;dmTitle.textContent='DM · '+u.name;dmInput.disabled=false;dmButton.disabled=false;dmMsgs.innerHTML='<div class="idk-live-empty">Private conversation with '+esc(u.name)+'.</div>';renderUsers();w.querySelector('[data-tab="dm"]').click();}; members.append(b);});};
    const connect=()=>{const n=name.value.trim()||'anon', r=room.value.trim().toLowerCase().replace(/[^a-z0-9 _-]/g,'').slice(0,32)||'general';save({name:n,room:r});state.me=n;state.room=r;roomTitle.textContent=r;status.textContent='Connecting…'; if(socket)socket.close(); const proto=location.protocol==='https:'?'wss':'ws'; socket=new WebSocket(`${proto}://${location.host}/chat`); socket.onopen=()=>socket.send(JSON.stringify({type:'join',name:n,room:r})); socket.onmessage=e=>{let d;try{d=JSON.parse(e.data)}catch{return}; if(d.type==='joined'){state.me=d.name;state.users=d.users||[];status.textContent=`Online · ${state.users.length} people`;roomMsgs.replaceChildren();(d.history||[]).forEach(m=>addMessage(roomMsgs,m));renderUsers();} else if(d.type==='presence'){state.users=d.users||[];status.textContent=`Online · ${state.users.length} people`;renderUsers();} else if(d.type==='message'){if(d.private){if((d.fromId===state.selected)||(d.toId===state.selected)){if(dmMsgs.querySelector('.idk-live-empty'))dmMsgs.replaceChildren();addMessage(dmMsgs,d,true)}} else addMessage(roomMsgs,d)} else if(d.type==='error'){status.textContent=d.text||'Messenger error';} else if(d.type==='kicked'){status.textContent=d.reason||'Disconnected';}}; socket.onclose=()=>{status.textContent='Offline';state.users=[];renderUsers();}; socket.onerror=()=>{status.textContent='Connection failed';};};
    w.querySelector('[data-m-connect]').onclick=connect;
    w.querySelector('[data-room-form]').onsubmit=e=>{e.preventDefault();const i=e.currentTarget.querySelector('input');const text=i.value.trim();if(!text||!socket||socket.readyState!==WebSocket.OPEN)return;socket.send(JSON.stringify({type:'message',text}));i.value='';};
    w.querySelector('[data-dm-form]').onsubmit=e=>{e.preventDefault();const text=dmInput.value.trim();if(!text||!state.selected||!socket||socket.readyState!==WebSocket.OPEN)return;socket.send(JSON.stringify({type:'direct-message',targetId:state.selected,text}));dmInput.value='';};
    w.querySelectorAll('[data-tab]').forEach(tab=>tab.onclick=()=>{w.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===tab));w.querySelectorAll('[data-pane]').forEach(x=>x.hidden=x.dataset.pane!==tab.dataset.tab);});
    if(p.name) setTimeout(connect,80);
  }

  function installIcon(){
    const layer=document.getElementById('icons'); if(!layer||layer.querySelector('[data-live-messenger]'))return;
    ['chat','dm'].forEach(id=>layer.querySelector(`[data-final-app="${id}"]`)?.remove());
    const b=document.createElement('button');b.type='button';b.dataset.liveMessenger='true';b.className='idk-final-desktop-icon';b.innerHTML='<span>💬</span><label>Idk Messenger</label>';b.ondblclick=openMessenger;layer.append(b);
  }
  function init(){addStyles();installIcon();setTimeout(installIcon,600);setTimeout(installIcon,1400);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.IdkMessenger={open:openMessenger};
})();

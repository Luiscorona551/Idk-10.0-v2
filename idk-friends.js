(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let panel = null, activeTab = 'friends', searchTimer = 0;
  const get = async url => { const r = await fetch(url,{credentials:'same-origin'}); return r.json(); };
  const post = async (url,body) => { const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)}); return r.json(); };
  const del = async url => { const r=await fetch(url,{method:'DELETE',credentials:'same-origin'}); return r.json(); };
  function styles(){ if(document.getElementById('idk-friends-style')) return; const l=document.createElement('link'); l.id='idk-friends-style'; l.rel='stylesheet'; l.href='idk-friends.css?v=1'; document.head.append(l); }
  function open(){
    styles();
    const messenger=document.querySelector('.idk-live-messenger'); if(!messenger) return window.IdkMessenger?.open?.();
    panel?.remove();
    const button=document.createElement('button'); button.type='button'; button.className='idk-friends-button'; button.textContent='👥 Friends';
    messenger.querySelector('.idk-live-title')?.append(button);
    panel=document.createElement('section'); panel.className='idk-friends-panel';
    panel.innerHTML=`<div class="idk-friends-head"><div><strong>Friends</strong><small>Find people, connect, and start a private chat.</small></div><button type="button" class="idk-friends-close" aria-label="Close Friends">×</button></div><form class="idk-friends-search"><input class="field" maxlength="32" placeholder="Search IDK users…" autocomplete="off"><button type="submit">Search</button></form><div class="idk-friend-error"></div><nav class="idk-friends-tabs"><button type="button" data-friend-tab="friends" class="active">Friends</button><button type="button" data-friend-tab="requests">Requests</button></nav><div class="idk-friends-list"></div>`;
    messenger.append(panel); button.onclick=()=>panel.hidden=false; panel.querySelector('.idk-friends-close').onclick=()=>{panel.remove();panel=null;button.remove();};
    panel.querySelectorAll('[data-friend-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.friendTab;panel.querySelectorAll('[data-friend-tab]').forEach(x=>x.classList.toggle('active',x===b));load();});
    panel.querySelector('form').onsubmit=e=>{e.preventDefault();search(panel.querySelector('input').value.trim());};
    load();
  }
  async function search(q){
    if(!panel) return; const list=panel.querySelector('.idk-friends-list'),err=panel.querySelector('.idk-friend-error'); clearTimeout(searchTimer); if(q.length<2){err.textContent='Type at least 2 characters to search.';return;}
    err.textContent=''; list.innerHTML='<div class="idk-friend-empty">Searching…</div>';
    try{const r=await get('/api/friends/search?q='+encodeURIComponent(q)); if(!r.ok){err.textContent=r.error||'Search failed.';return;} list.innerHTML=''; if(!r.users?.length){list.innerHTML='<div class="idk-friend-empty">No users found. Try another username.</div>';return;} r.users.forEach(u=>list.append(userRow(u,true)));}catch{err.textContent='Could not reach the Friends service.';}
  }
  function userRow(u,add){
    const row=document.createElement('div');row.className='idk-friend-row';const initial=esc((u.username||'?').slice(0,1).toUpperCase());
    row.innerHTML=`<span class="idk-friend-avatar">${u.avatar?`<img class="idk-friend-avatar" src="${esc(u.avatar)}" alt="">`:initial}</span><span class="idk-friend-info"><strong>${esc(u.username)}</strong><small>${add?'IDK user':'Friend'}</small></span><button type="button" class="idk-friend-action">${add?'Add':'Chat'}</button>`;
    const action=row.querySelector('.idk-friend-action');
    if(add) action.onclick=async()=>{action.disabled=true;const r=await post('/api/friends/request',{username:u.username});panel.querySelector('.idk-friend-error').textContent=r.ok?`Friend request sent to ${u.username}.`:r.error||'Could not send request.';action.textContent=r.ok?'Sent':'Add';};
    else action.onclick=()=>startChat(u.username);
    return row;
  }
  async function load(){
    if(!panel)return; const list=panel.querySelector('.idk-friends-list'),err=panel.querySelector('.idk-friend-error'); err.textContent=''; list.innerHTML='<div class="idk-friend-empty">Loading…</div>';
    try{const r=await get('/api/friends');if(!r.ok){err.textContent=r.error||'Could not load Friends.';return;}list.innerHTML='';
      if(activeTab==='friends'){if(!r.friends?.length){list.innerHTML='<div class="idk-friend-empty">No friends yet. Search for someone above to add them.</div>';return;}r.friends.forEach(u=>list.append(userRow(u,false)));}
      else {const incoming=r.incoming||[];if(!incoming.length){list.innerHTML='<div class="idk-friend-empty">No new friend requests.</div>';return;}incoming.forEach(req=>{const row=userRow({username:req.username,avatar:req.avatar},false);row.querySelector('small').textContent='Wants to be your friend';const actions=row.querySelector('.idk-friend-action');actions.textContent='Accept';actions.onclick=async()=>{actions.disabled=true;const x=await post('/api/friends/respond',{requestId:req.id,action:'accept'});if(x.ok)load();else{actions.disabled=false;err.textContent=x.error||'Could not accept request.';}};const decline=document.createElement('button');decline.type='button';decline.className='idk-friend-action';decline.textContent='Decline';decline.onclick=async()=>{const x=await post('/api/friends/respond',{requestId:req.id,action:'decline'});if(x.ok)load();else err.textContent=x.error||'Could not decline request.';};row.append(decline);list.append(row);});}
    }catch{err.textContent='Could not reach the Friends service.';}
  }
  function startChat(username){
    panel?.remove();panel=null;document.querySelector('.idk-friends-button')?.remove();window.IdkMessenger?.open?.();
    let tries=0;const timer=setInterval(()=>{tries++;const member=[...document.querySelectorAll('.idk-live-member')].find(x=>(x.textContent||'').toLowerCase().includes(username.toLowerCase()));if(member){clearInterval(timer);member.click();}if(tries>30)clearInterval(timer);},200);
  }
  function attach(){
    if(document.querySelector('.idk-live-messenger')&&!document.querySelector('.idk-friends-button'))open();
  }
  const observer=new MutationObserver(()=>{if(document.querySelector('.idk-live-messenger')&&!document.querySelector('.idk-friends-button'))attach();});
  function init(){observer.observe(document.body,{childList:true,subtree:true});if(document.querySelector('.idk-live-messenger'))attach();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.IdkFriends={open,load};
})();
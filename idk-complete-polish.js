(() => {
  'use strict';
  if (window.IDKCompletePolish) return;
  const KEY='idkCompleteSuiteState';
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  const save=s=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch{};window.IDKAccount?.sync?.()};
  const state=read();
  function applyBackground(){const mode=state.backgroundMode||'wallpaper';if(mode==='solid'){document.body.style.backgroundImage='none';document.body.style.backgroundColor=state.backgroundColor||'#0b1220'}else if(mode==='gradient'){document.body.style.backgroundImage=`linear-gradient(135deg,${state.backgroundColor||'#101a32'},${state.backgroundColor2||'#284f91'})`}else if(state.wallpaper){document.body.style.backgroundColor='';document.body.style.backgroundImage=`url("${String(state.wallpaper).replace(/"/g,'')}")`}}
  function battery(){const el=document.getElementById('idk-battery-indicator')||document.createElement('div');el.id='idk-battery-indicator';const clock=document.getElementById('clock');if(clock&&el.parentElement!==clock)clock.append(el);else if(!clock&&!el.parentElement)document.body.append(el);if(!navigator.getBattery){el.textContent='🔋 Battery: —';return}navigator.getBattery().then(b=>{const render=()=>el.textContent=`🔋 ${Math.round(b.level*100)}%${b.charging?' ⚡':''}`;render();b.addEventListener('levelchange',render);b.addEventListener('chargingchange',render)}).catch(()=>el.textContent='🔋 Battery: —')}
  function rename(){document.addEventListener('contextmenu',e=>{if(window.IDKFinalUpgrades)return;const icon=e.target.closest('#icons .desktop-icon');if(!icon)return;e.preventDefault();const app=icon.dataset.app||'';const old=icon.querySelector('.icon-label,.label,.desktop-icon-label')?.textContent?.trim()||icon.getAttribute('aria-label')||icon.getAttribute('title')||app;const next=prompt('Rename desktop shortcut:',old);if(next==null||!next.trim())return;const label=icon.querySelector('.icon-label,.label,.desktop-icon-label');if(label)label.textContent=next.trim();icon.setAttribute('aria-label',next.trim());icon.setAttribute('title',next.trim());const names=read();names.labels=names.labels||{};names.labels[app]=next.trim();save(names)},true)}
  function wire(){battery();applyBackground();rename();window.addEventListener('online',battery);window.addEventListener('offline',battery);window.IDKCompletePolish={applyBackground,battery,rename};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();

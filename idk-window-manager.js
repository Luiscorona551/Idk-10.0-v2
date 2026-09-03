(() => {
  'use strict';
  if (window.IDKWindowManager) return;
  const windows=()=>[...document.querySelectorAll('#windows .window')].filter(w=>!w.hidden);
  const top=()=>windows().sort((a,b)=>(+getComputedStyle(a).zIndex||0)-(+getComputedStyle(b).zIndex||0)).pop();
  const focus=w=>{if(!w)return;w.hidden=false;w.style.zIndex=9999;w.querySelector('.titlebar')?.scrollIntoView?.({block:'nearest'});};
  const snap=(side,w=top())=>{if(!w)return;w.style.transform='none';w.style.top='0px';w.style.height='calc(100vh - 70px)';w.style.width='50vw';w.style.left=side==='left'?'0px':'50vw';focus(w)};
  const maximize=w=>{if(!w)return;w.querySelector('.ctrl.max')?.click()};
  const minimize=w=>{if(!w)return;w.querySelector('.ctrl.min')?.click()};
  const restore=w=>{if(!w)return;w.hidden=false;w.style.left='';w.style.top='';w.style.width='';w.style.height='';w.style.transform='';focus(w)};
  function manager(){
    document.querySelector('.idk-window-manager')?.remove();
    const o=document.createElement('section');o.className='idk-window-manager';
    o.innerHTML='<header><strong>IDK Window Manager</strong><button>×</button></header><div class="idk-wm-list"></div>';
    const list=o.querySelector('.idk-wm-list');windows().forEach((w,i)=>{const b=document.createElement('button');b.innerHTML=`<span>${i+1}</span><b>${w.querySelector('.title')?.textContent||'Window'}</b><small>Click to focus</small>`;b.onclick=()=>{focus(w);o.remove()};list.append(b)});document.body.append(o);o.querySelector('header button').onclick=()=>o.remove();
  }
  function init(){
    document.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();
      if((e.metaKey||e.ctrlKey)&&e.altKey&&k==='left'){e.preventDefault();snap('left')}
      else if((e.metaKey||e.ctrlKey)&&e.altKey&&k==='right'){e.preventDefault();snap('right')}
      else if((e.metaKey||e.ctrlKey)&&e.altKey&&k==='up'){e.preventDefault();maximize(top())}
      else if((e.metaKey||e.ctrlKey)&&e.altKey&&k==='down'){e.preventDefault();restore(top())}
      else if(e.altKey&&e.key==='Tab'){/* IDK Desktop Suite owns the visual switcher. */}
      else if(e.key==='F8'){e.preventDefault();manager()}
    },true);
    window.IDKWindowManager={snap,focus,maximize,minimize,restore,manager};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
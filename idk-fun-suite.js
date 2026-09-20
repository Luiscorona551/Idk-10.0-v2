(() => {
  const BUILDER_KEY='idk-app-builder-v1';
  const EGG_KEY='idk-easter-eggs-v1';
  const TOY_KEY='idk-desktop-toys-v1';
  const make=(tag,props={},children=[])=>{const n=Object.assign(document.createElement(tag),props);children.forEach(c=>n.append(c));return n;};
  const toast=(t,m)=>window.OS?.notify?.(t,m,'info');

  function builder(){
    const root=make('div',{className:'idk-builder'});
    const name=make('input',{className:'field',placeholder:'App name',value:'My IDK App'});
    const icon=make('input',{className:'field',placeholder:'Icon',value:'🧩'});
    const code=make('textarea',{className:'field',placeholder:'HTML for your app…',value:'<h2>Hello IDK!</h2><p>My first app.</p>'});
    const preview=make('div',{className:'idk-builder-preview'});
    const render=()=>{preview.innerHTML=code.value;};
    const save=make('button',{className:'btn',textContent:'Save App'});
    save.onclick=()=>{const list=JSON.parse(localStorage.getItem(BUILDER_KEY)||'[]');list.push({id:'custom-'+Date.now(),title:name.value.trim()||'My App',glyph:icon.value.trim()||'🧩',html:code.value});localStorage.setItem(BUILDER_KEY,JSON.stringify(list));toast('IDK App Builder','App saved on this device.');};
    code.addEventListener('input',render);render();
    root.append(make('h2',{textContent:'IDK App Builder'}),make('p',{textContent:'Create a small local IDK app from HTML. Saved apps stay on this device.'}),name,icon,code,save,make('h3',{textContent:'Preview'}),preview);
    return root;
  }

  function screensaver(){
    const root=make('div',{className:'idk-screensaver'});
    const select=make('select',{className:'field'});[['starfield','Starfield'],['clock','Floating Clock'],['logo','IDK Logo']].forEach(([v,l])=>select.append(make('option',{value:v,textContent:l})));
    const preview=make('div',{className:'idk-screen-preview'});
    const render=()=>{preview.dataset.mode=select.value;preview.innerHTML=select.value==='clock'?'<strong>'+new Date().toLocaleTimeString()+'</strong>':select.value==='logo'?'<strong>IDK</strong>':'✦　·　✧　　·　✦';};
    select.onchange=render;render();
    const start=make('button',{className:'btn',textContent:'Preview Fullscreen'});start.onclick=()=>{const el=make('div',{className:'idk-screensaver-full',innerHTML:preview.innerHTML});document.body.append(el);el.onclick=()=>el.remove();};
    root.append(make('h2',{textContent:'IDK Screensaver'}),select,preview,start);return root;
  }

  function toys(){
    const root=make('div',{className:'idk-toys'});
    const items=[['pet','🐾','Desktop Pet'],['clock','🕒','Floating Clock'],['visualizer','🎵','Visualizer']];
    items.forEach(([id,g,n])=>{const row=make('label',{className:'idk-toy-row'});const cb=make('input',{type:'checkbox',checked:JSON.parse(localStorage.getItem(TOY_KEY)||'{}')[id]});row.append(make('span',{textContent:g}),make('strong',{textContent:n}),cb);cb.onchange=()=>{const s=JSON.parse(localStorage.getItem(TOY_KEY)||'{}');s[id]=cb.checked;localStorage.setItem(TOY_KEY,JSON.stringify(s));toast(n,cb.checked?'Enabled':'Disabled');};root.append(row);});return root;
  }

  function eggs(){
    const root=make('div',{className:'idk-eggs'});
    const found=JSON.parse(localStorage.getItem(EGG_KEY)||'[]');
    root.append(make('h2',{textContent:'IDK Easter Eggs'}),make('p',{textContent:'Discover hidden interactions around IDK.'}),make('p',{textContent:found.length+' discovered'}));
    const btn=make('button',{className:'btn',textContent:'Secret Mode'});btn.onclick=()=>{document.documentElement.classList.toggle('idk-secret-mode');localStorage.setItem(EGG_KEY,JSON.stringify([...new Set([...found,'secret-mode'])]));toast('Easter Egg','Secret Mode toggled.');};root.append(btn);return root;
  }

  function register(id,title,glyph,render){if(window.APPS) APPS[id]={title,glyph,desktop:true,width:620,height:520,render};}
  register('app-builder','IDK App Builder','🛠️',builder);
  register('screensaver','IDK Screensaver','🖼️',screensaver);
  register('desktop-toys','Desktop Toys','🧸',toys);
  register('easter-eggs','IDK Easter Eggs','🥚',eggs);

  window.IDKFunSuite={version:1};
})();
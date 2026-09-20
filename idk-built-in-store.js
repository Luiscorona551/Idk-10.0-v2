(() => {
  const KEY = 'idkBuiltinAppsInstalled';
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  const installed = id => read().includes(id);
  const setInstalled = (id, value) => { const next = new Set(read()); value ? next.add(id) : next.delete(id); write([...next]); };
  const notify = (title, message, kind='info') => window.OS?.notify?.(title, message, kind);

  const effects = {
    cursor: () => {
      document.documentElement.dataset.idkCursorColors = installed('cursor-colors') ? 'on' : 'off';
      document.documentElement.style.setProperty('--idk-cursor-color', localStorage.getItem('idkCursorColor') || '#7ee6ff');
    },
    wallpaper: () => document.documentElement.dataset.idkLiveWallpaper = installed('live-wallpapers') ? 'on' : 'off',
    effects: () => document.documentElement.dataset.idkDesktopEffects = installed('desktop-effects') ? 'on' : 'off',
    iconpack: () => document.documentElement.dataset.idkIconPack = installed('icon-packs') ? 'on' : 'off',
    clock: () => document.documentElement.dataset.idkCoolClock = installed('cool-clock') ? 'on' : 'off',
    pet: () => document.documentElement.dataset.idkDesktopPet = installed('desktop-pet') ? 'on' : 'off'
  };

  function cursorApp() {
    const root=document.createElement('div'); root.className='app idk-fun-app';
    root.innerHTML='<h2>Cursor Colors</h2><p>Pick a fun cursor accent for IDK.</p><label class="settings-row">Cursor color <input class="field" type="color" value="'+(localStorage.getItem('idkCursorColor')||'#7ee6ff')+'"></label><p class="idk-fun-status"></p>';
    const input=root.querySelector('input'), status=root.querySelector('.idk-fun-status');
    input.oninput=()=>{localStorage.setItem('idkCursorColor',input.value); effects.cursor(); status.textContent='Cursor color saved.';};
    return root;
  }
  function wallpaperApp() {
    const root=document.createElement('div'); root.className='app idk-fun-app';
    const choices=[['Aurora','radial-gradient(circle at 30% 20%,rgba(126,230,255,.32),transparent 25%),linear-gradient(135deg,#071126,#183b50 55%,#3d1c51)'],['Starfield','radial-gradient(circle at 20% 30%,#fff 0 1px,transparent 2px),radial-gradient(circle at 70% 60%,#fff 0 1px,transparent 2px),linear-gradient(135deg,#030511,#101b3d)'],['Sunset','linear-gradient(135deg,#26152f,#713557,#ef8b68)']];
    root.innerHTML='<h2>Live Wallpapers</h2><p>Choose a built-in animated-style wallpaper for the desktop.</p><div class="idk-fun-grid"></div>';
    const grid=root.querySelector('.idk-fun-grid');
    choices.forEach(([name,value])=>{const b=document.createElement('button');b.className='btn';b.textContent=name;b.onclick=()=>{localStorage.setItem('idkLiveWallpaper',value); document.documentElement.style.setProperty('--wallpaper',value); window.OS?.notify?.('Live Wallpapers',name+' wallpaper applied.');};grid.append(b);});
    return root;
  }
  function effectsApp(){ const root=document.createElement('div');root.className='app idk-fun-app';root.innerHTML='<h2>Desktop Effects</h2><p>Toggle lightweight visual effects.</p><label class="settings-row">Particles <input type="checkbox" checked></label><label class="settings-row">Glow <input type="checkbox" checked></label>'; return root; }
  function genericApp(title, desc){const root=document.createElement('div');root.className='app idk-fun-app';root.innerHTML='<h2>'+title+'</h2><p>'+desc+'</p><p>Installed from the built-in IDK Store. No download required.</p>';return root;}

  const defs = [
    {id:'cursor-colors',title:'Cursor Colors',glyph:'🖱️',category:'Personalization',description:'Change your IDK cursor accent color.',render:cursorApp},
    {id:'live-wallpapers',title:'Live Wallpapers',glyph:'🌌',category:'Personalization',description:'Built-in animated-style desktop wallpapers.',render:wallpaperApp},
    {id:'desktop-effects',title:'Desktop Effects',glyph:'✨',category:'Fun',description:'Add lightweight particles and glow effects.',render:effectsApp},
    {id:'icon-packs',title:'Icon Packs',glyph:'🧩',category:'Personalization',description:'Fun built-in icon pack styling.',render:()=>genericApp('Icon Packs','Choose from future-ready built-in icon styles.')},
    {id:'cool-clock',title:'Cool Clock',glyph:'🕒',category:'Fun',description:'Extra clock styles for the IDK desktop.',render:()=>genericApp('Cool Clock','Try alternate desktop clock layouts.')},
    {id:'desktop-pet',title:'Desktop Pet',glyph:'🐾',category:'Fun',description:'A tiny friendly companion for your desktop.',render:()=>genericApp('Desktop Pet','Your little IDK companion lives on the desktop.')},
    {id:'theme-packs',title:'Theme Packs',glyph:'🎨',category:'Personalization',description:'One-click themed IDK looks.',render:()=>genericApp('Theme Packs','Apply coordinated IDK themes from one place.')},
    {id:'sound-packs',title:'Sound Packs',glyph:'🔊',category:'Fun',description:'Optional built-in interface sound themes.',render:()=>genericApp('Sound Packs','Choose optional IDK interface sounds.')},
    {id:'screensavers',title:'Screensavers',glyph:'🖼️',category:'Fun',description:'Built-in animated idle experiences.',render:()=>genericApp('Screensavers','Choose an IDK screensaver experience.')},
    {id:'visualizer',title:'Visualizer',glyph:'🎵',category:'Fun',description:'A built-in music visualizer experience.',render:()=>genericApp('Visualizer','Open the IDK visualizer when you want some motion.')}
  ];

  function register(){
    if(typeof APPS==='undefined') return;
    defs.forEach(d=>{ if(!APPS[d.id] || d.builtin){
      APPS[d.id]={title:d.title,glyph:d.glyph,desktop:installed(d.id),dock:false,width:560,height:440,render:d.render,builtin:true};
    }});
    effects.cursor(); effects.wallpaper(); effects.effects(); effects.iconpack(); effects.clock(); effects.pet();
    const wallpaper=localStorage.getItem('idkLiveWallpaper'); if(installed('live-wallpapers')&&wallpaper) document.documentElement.style.setProperty('--wallpaper',wallpaper);
  }
  window.IDKBuiltInStore={defs,installed,setInstalled,register,notify,open(id){ if(!installed(id)) return false; if(!APPS?.[id]?.render) return false; window.OS?.open?.(id); return true; }};
  register();
})();
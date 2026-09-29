(() => {
  'use strict';
  if (window.IDKSmartDesktop) return;

  const KEY = 'idkSmartDesktopRecent';
  const ORDER_KEY = 'idkSmartDesktopOrder';
  const TYPES = {
    image: ['png','jpg','jpeg','gif','webp','svg','bmp','heic'],
    video: ['mp4','mov','webm','mkv','avi','m4v'],
    audio: ['mp3','wav','m4a','ogg','flac','aac'],
    document: ['txt','md','pdf','doc','docx','rtf','csv','xls','xlsx','ppt','pptx'],
    archive: ['zip','rar','7z','tar','gz'],
    other: []
  };
  const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const notify = (title, message, kind='info') => window.OS?.notify?.(title, message, kind);
  const ext = name => String(name || '').toLowerCase().split('.').pop();
  const fileKind = name => Object.entries(TYPES).find(([, list]) => list.includes(ext(name)))?.[0] || 'other';
  const iconFor = kind => ({ image:'🖼️', video:'🎬', audio:'🎵', document:'📄', archive:'🗜️', other:'📦' }[kind] || '📦');
  let recent = Array.isArray(read(KEY, [])) ? read(KEY, []) : [];
  let undoOrder = null;
  let panel = null;
  let lastFileIds = new Set();

  function files() {
    return (window.IDKFiles?.getFiles?.() || []).filter(item => item && item.type === 'file');
  }
  function rememberNew(list) {
    const current = new Set(list.map(item => item.id));
    const added = list.filter(item => item.id && !lastFileIds.has(item.id));
    if (lastFileIds.size) {
      added.forEach(item => recent.unshift({ id:item.id, name:item.name, kind:fileKind(item.name), at:Date.now() }));
      recent = recent.filter((item, index, arr) => item.name && arr.findIndex(x => x.id === item.id) === index).slice(0, 20);
      write(KEY, recent);
      if (added.length) {
        const first = added[0];
        const echo = document.getElementById('echo-companion');
        if (echo) showEchoQuestion(echo, added.length === 1 ? `You just added “${first.name}”. Want me to help organize it?` : `You just added ${added.length} files. Want me to organize them by type?`, [
          { label: added.length === 1 ? 'Organize' : 'Yes, organize', run: () => organizeByType() },
          { label: 'Open Files', run: () => window.OS?.open?.('files') },
          { label: 'No thanks', run: () => {} }
        ]);
      }
    }
    lastFileIds = current;
  }

  function showEchoQuestion(anchor, message, actions=[]) {
    document.querySelector('.idk-smart-question')?.remove();
    const card = document.createElement('section');
    card.className = 'idk-smart-question';
    card.innerHTML = '<strong>IDK Echo</strong><p></p><div></div>';
    card.querySelector('p').textContent = message;
    const actionsEl = card.lastElementChild;
    actions.forEach(action => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = action.label; b.onclick = () => { card.remove(); action.run(); };
      actionsEl.append(b);
    });
    document.body.append(card);
    const r = anchor?.getBoundingClientRect();
    card.style.left = Math.max(12, Math.min(innerWidth - 370, (r?.right || innerWidth/2) + 12)) + 'px';
    card.style.top = Math.max(70, Math.min(innerHeight - 190, (r?.top || 140))) + 'px';
  }

  function saveDesktopOrder() {
    const layer = document.getElementById('icons');
    return layer ? [...layer.children].filter(el => el.dataset.app || el.dataset.fileId).map(el => el.dataset.fileId || `app:${el.dataset.app}`) : [];
  }
  function organizeByType() {
    const layer = document.getElementById('icons');
    const all = files();
    const stored = read('idkFileSystem', []);
    if (Array.isArray(stored) && stored.length) {
      const folderNames = { image:'Images', video:'Videos', audio:'Music', document:'Documents', other:'Other' };
      const folders = {};
      Object.entries(folderNames).forEach(([kind,name]) => {
        let folder = stored.find(item => item.type === 'folder' && item.name === name && item.parent === '');
        if (!folder) {
          folder = { id:`smart-${kind}-${Date.now()}`, name, type:'folder', parent:'', updated:Date.now(), smart:true };
          stored.push(folder);
        }
        folders[kind] = folder.id;
      });
      const previous = [];
      stored.filter(item => item.type === 'file' && item.parent === '').forEach(item => {
        const kind = fileKind(item.name);
        previous.push({ id:item.id, parent:item.parent });
        item.parent = folders[kind];
        item.updated = Date.now();
      });
      if (previous.length) undoOrder = { desktop: saveDesktopOrder(), parents: previous };
      write('idkFileSystem', stored);
      window.dispatchEvent(new CustomEvent('idk-data-changed',{detail:{type:'files',smartOrganization:true}}));
    }
    if (layer) {
      const items=[...layer.children].filter(el=>el.classList.contains('desktop-icon'));
      const rank={image:1,video:2,audio:3,document:4,other:5};
      items.sort((a,b)=>{
        const ak=a.dataset.fileId?fileKind(a.dataset.fileName):'other';
        const bk=b.dataset.fileId?fileKind(b.dataset.fileName):'other';
        return (rank[ak]-rank[bk]) || String(a.dataset.fileName||a.querySelector('.label')?.textContent||'').localeCompare(String(b.dataset.fileName||b.querySelector('.label')?.textContent||''),undefined,{numeric:true,sensitivity:'base'});
      });
      items.forEach(el=>layer.append(el));
      write(ORDER_KEY, saveDesktopOrder());
    }
    notify('Smart Desktop','Files organized into Images, Videos, Music, Documents, and Other.', 'success');
    updatePanel();
  }
  function undoOrganization() {
    if (!undoOrder) { notify('Smart Desktop','There is no organization to undo.'); return; }
    const stored=read('idkFileSystem',[]);
    if (Array.isArray(stored) && undoOrder.parents) {
      const previous=new Map(undoOrder.parents.map(item=>[String(item.id),item.parent||'']));
      stored.forEach(item=>{ if(previous.has(String(item.id))) item.parent=previous.get(String(item.id)); });
      write('idkFileSystem',stored);
      window.dispatchEvent(new CustomEvent('idk-data-changed',{detail:{type:'files',smartUndo:true}}));
    }
    const layer=document.getElementById('icons');
    if(layer && Array.isArray(undoOrder.desktop)){
      const map=new Map([...layer.children].map(el=>[el.dataset.fileId||`app:${el.dataset.app}`,el]));
      undoOrder.desktop.forEach(key=>{const el=map.get(key);if(el)layer.append(el);});
      write(ORDER_KEY,saveDesktopOrder());
    }
    undoOrder=null;
    notify('Smart Desktop','The last smart organization was undone.','success');
    updatePanel();
  }
  function highlightKind(kind) {
    document.querySelectorAll('#icons .desktop-file-icon').forEach(el => {
      const match = fileKind(el.dataset.fileName) === kind;
      el.classList.toggle('idk-smart-highlight', match);
    });
    setTimeout(() => document.querySelectorAll('.idk-smart-highlight').forEach(el => el.classList.remove('idk-smart-highlight')), 2600);
  }
  function runCommand(value) {
    const q = String(value || '').trim().toLowerCase();
    if (!q) return;
    if (/\b(organize|sort|clean)\b.*\bdesktop\b/.test(q)) return organizeByType();
    if (/\b(undo|reverse)\b.*\b(organize|sort)\b/.test(q)) return undoOrganization();
    if (/\b(show|open|find|where)\b.*\b(images?|pictures?|photos?)\b/.test(q)) { highlightKind('image'); notify('Smart Desktop','Image files are highlighted.','success'); return; }
    if (/\b(show|open|find|where)\b.*\b(videos?)\b/.test(q)) { highlightKind('video'); notify('Smart Desktop','Video files are highlighted.','success'); return; }
    if (/\b(show|open|find|where)\b.*\b(music|audio)\b/.test(q)) { highlightKind('audio'); notify('Smart Desktop','Audio files are highlighted.','success'); return; }
    if (/\b(open|launch|start)\b.*\b(files?)\b/.test(q)) return window.OS?.open?.('files');
    if (/\b(open|launch|start)\b.*\b(settings?)\b/.test(q)) return window.OS?.open?.('settings');
    if (/\b(open|launch|start)\b.*\b(browser|web)\b/.test(q)) return window.OS?.open?.('proxy');
    if (/\b(what|show)\b.*\b(on|my)\b.*\bdesktop\b/.test(q)) return openPanel();
    if (/\b(recent|latest|newest)\b.*\bfiles?\b/.test(q)) return openPanel('recent');
    if (/\b(clean|cleanup)\b/.test(q)) return showCleanup();
    notify('IDK Echo', 'Try “organize my desktop”, “show my images”, “open Files”, or “show recent files”.');
  }

  function showCleanup() {
    const list = files();
    const unused = list.filter(item => !document.querySelector(`#icons [data-file-id="${CSS.escape(String(item.id))}"]`));
    const old = list.filter(item => item.updatedAt && Date.now() - Number(item.updatedAt) > 1000*60*60*24*30);
    openPanel();
    notify('Smart Desktop', `${unused.length} stored file${unused.length===1?'':'s'} are not on the desktop; ${old.length} file${old.length===1?'':'s'} look older than 30 days.`);
  }

  function openPanel(tab='overview') {
    panel?.remove();
    panel = document.createElement('aside');
    panel.className = 'idk-smart-panel';
    panel.innerHTML = '<header><div><span>SMART DESKTOP</span><h2>Echo workspace</h2></div><button type="button" data-close aria-label="Close">×</button></header><nav><button data-tab="overview">Overview</button><button data-tab="recent">Recently added</button><button data-tab="commands">Commands</button></nav><main data-body></main>';
    document.body.append(panel);
    panel.querySelector('[data-close]').onclick = () => { panel.remove(); panel=null; };
    panel.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => renderTab(b.dataset.tab));
    panel.dataset.tab = tab;
    renderTab(tab);
  }
  function renderTab(tab) {
    if (!panel) return;
    panel.dataset.tab = tab;
    const body = panel.querySelector('[data-body]');
    if (tab === 'recent') {
      body.innerHTML = recent.length ? recent.map(item => `<button class="idk-smart-recent" data-id="${String(item.id).replace(/"/g,'&quot;')}"><span>${iconFor(item.kind)}</span><b></b><small>${new Date(item.at).toLocaleString()}</small></button>`).join('') : '<p class="sub">No recently added files yet.</p>';
      recent.forEach(item => { const b=body.querySelector(`[data-id="${CSS.escape(String(item.id))}"]`); if(b){b.querySelector('b').textContent=item.name;b.onclick=()=>{highlightKind(item.kind);window.OS?.open?.('files');};} });
      return;
    }
    if (tab === 'commands') {
      body.innerHTML = '<p class="sub">Ask Echo to work with your local IDK desktop.</p><form data-command><input class="field" placeholder="Try: organize my desktop"><button class="btn" type="submit">Run</button></form><div class="idk-smart-command-chips"><button>Show my images</button><button>Show recent files</button><button>Open Files</button><button>Cleanup suggestions</button></div>';
      body.querySelector('[data-command]').onsubmit = e => { e.preventDefault(); runCommand(e.currentTarget.querySelector('input').value); };
      body.querySelectorAll('.idk-smart-command-chips button').forEach(b => b.onclick = () => runCommand(b.textContent));
      return;
    }
    const list = files();
    const counts = list.reduce((acc,item) => { const k=fileKind(item.name); acc[k]=(acc[k]||0)+1; return acc; }, {});
    body.innerHTML = `<div class="idk-smart-hero"><strong>${list.length} files</strong><span>Smart organization stays local to this desktop.</span></div><div class="idk-smart-stats">${Object.entries(counts).map(([k,n])=>`<button data-kind="${k}"><span>${iconFor(k)}</span><b>${n}</b><small>${k}</small></button>`).join('') || '<p class="sub">Import files to get started.</p>'}</div><div class="idk-smart-actions"><button data-organize>Organize by type</button><button data-undo>Undo last organization</button><button data-widgets>Desktop widgets</button></div><div class="idk-smart-cleanup"><strong>Cleanup suggestions</strong><p>Review stored files and recent additions without deleting anything automatically.</p><button data-cleanup>Review suggestions</button></div>`;
    body.querySelectorAll('[data-kind]').forEach(b => b.onclick=()=>highlightKind(b.dataset.kind));
    body.querySelector('[data-organize]').onclick=organizeByType;
    body.querySelector('[data-undo]').onclick=undoOrganization;
    body.querySelector('[data-widgets]').onclick=()=>window.IDKDesktopWidgets?.open?.();
    body.querySelector('[data-cleanup]').onclick=showCleanup;
  }

  function setupEchoDrop() {
    const echo = document.getElementById('echo-companion');
    if (!echo || echo.dataset.idkSmartDrop) return;
    echo.dataset.idkSmartDrop='1';
    echo.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('text/idk-file')) { event.preventDefault(); echo.classList.add('idk-echo-drop'); } });
    echo.addEventListener('dragleave', () => echo.classList.remove('idk-echo-drop'));
    echo.addEventListener('drop', event => {
      const id = event.dataTransfer?.getData('text/idk-file');
      echo.classList.remove('idk-echo-drop');
      if (!id) return;
      event.preventDefault();
      const item = files().find(file => String(file.id) === String(id));
      if (!item) return;
      showEchoQuestion(echo, `I found “${item.name}”. What should I do with it?`, [
        {label:'Highlight similar', run:()=>highlightKind(fileKind(item.name))},
        {label:'Open Files', run:()=>window.OS?.open?.('files')},
        {label:'Organize desktop', run:()=>organizeByType()}
      ]);
    });
  }

  function makeFileIconsDraggable() {
    document.querySelectorAll('#icons .desktop-file-icon').forEach(icon => {
      if (icon.dataset.smartDrag) return;
      icon.dataset.smartDrag='1';
      icon.addEventListener('dragstart', event => {
        event.dataTransfer?.setData('text/idk-file', icon.dataset.fileId || '');
      });
      icon.setAttribute('draggable','true');
    });
  }

  function addWidgetButton() {
    const desktop=document.getElementById('desktop');
    if (!desktop || document.getElementById('idk-smart-tools')) return;
    const tools=document.createElement('div');
    tools.id='idk-smart-tools';
    tools.innerHTML='<button type="button" data-smart>✦ Smart Desktop</button><button type="button" data-widgets>◫ Widgets</button>';
    tools.querySelector('[data-smart]').onclick=()=>openPanel();
    tools.querySelector('[data-widgets]').onclick=()=>window.IDKDesktopWidgets?.open?.();
    desktop.append(tools);
  }

  function updatePanel(){ if(panel && panel.isConnected) renderTab(panel.dataset.tab || 'overview'); }

  function scan() {
    const list=files();
    rememberNew(list);
    makeFileIconsDraggable();
    setupEchoDrop();
    addWidgetButton();
    updatePanel();
  }

  function install() {
    scan();
    window.addEventListener('idk-data-changed', scan);
    new MutationObserver(scan).observe(document.getElementById('desktop') || document.body, {childList:true,subtree:true});
    setInterval(scan, 2500);
    window.IDKSmartDesktop = { open: openPanel, organize: organizeByType, undo: undoOrganization, command: runCommand, recent: () => [...recent] };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
})();
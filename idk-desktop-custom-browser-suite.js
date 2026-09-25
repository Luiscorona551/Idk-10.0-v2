(() => {
  'use strict';
  if (window.IDKDesktopCustomizationBrowser) return;

  const KEY = 'idkThemePack-v1';
  const BOOKMARKS_KEY = 'idkBrowserBookmarks-v1';
  const HISTORY_KEY = 'idkBrowserHistory-v1';

  const packs = [
    { id: 'grape', name: 'Grape', wallpaper: 'https://kommodo.ai/i/SSsUaAWZPviBJ7HWcyLM', accent: '#c17bdc', glow: '#9b5de5', panel: 'rgba(40, 18, 67, .84)', solid: '#24123f' },
    { id: 'green', name: 'Green', wallpaper: 'https://kommodo.ai/i/kucWPjqO64Wx2jr2Byun', accent: '#62e6a0', glow: '#42d392', panel: 'rgba(8, 43, 33, .84)', solid: '#0b2f24' },
    { id: 'red', name: 'Red', wallpaper: 'https://kommodo.ai/i/hdSlLTe6uuxgLc9LaurW', accent: '#ff667d', glow: '#e94f64', panel: 'rgba(61, 13, 25, .84)', solid: '#3a0d18' },
    { id: 'blue', name: 'Blue', wallpaper: 'https://kommodo.ai/i/NgrJyYk2J4PoV0hjkopI', accent: '#5b9cff', glow: '#4b8dff', panel: 'rgba(10, 28, 68, .82)', solid: '#0d1d43' }
  ];

  const addStyle = () => {
    if (document.getElementById('idk-desktop-custom-browser-style')) return;
    const style = document.createElement('style');
    style.id = 'idk-desktop-custom-browser-style';
    style.textContent = `
      .idk-theme-pack { margin-top:12px; padding:12px; border:1px solid color-mix(in srgb,var(--bg-accent,#5b9cff) 35%,transparent); border-radius:14px; background:var(--bg-panel,rgba(10,28,68,.5)); }
      .idk-theme-pack-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(125px,1fr)); gap:8px; margin-top:9px; }
      .idk-theme-pack-button { border:1px solid rgba(255,255,255,.15); border-radius:11px; padding:9px; background:rgba(0,0,0,.18); color:var(--text,#eaf0ff); cursor:pointer; text-align:left; }
      .idk-theme-pack-button:hover,.idk-theme-pack-button.active { border-color:var(--bg-accent,#5b9cff); box-shadow:0 0 0 2px color-mix(in srgb,var(--bg-accent,#5b9cff) 18%,transparent); }
      .idk-theme-swatch { display:block; height:28px; border-radius:7px; margin-bottom:7px; }
      .idk-desktop-tools { display:flex; flex-wrap:wrap; gap:7px; margin:10px 0; }
      .idk-desktop-tools button { flex:1 1 140px; }
      .idk-browser-tools { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0; }
      .idk-browser-tools button { white-space:nowrap; }
      .idk-browser-fullscreen { width:100%; min-height:70vh; }
      .idk-browser-library { margin-top:8px; padding:9px; border-radius:10px; background:rgba(0,0,0,.16); }
      .idk-browser-library[hidden] { display:none; }
      .idk-browser-library-list { display:grid; gap:5px; max-height:180px; overflow:auto; margin-top:7px; }
      .idk-browser-library-item { display:flex; gap:7px; align-items:center; justify-content:space-between; padding:6px 8px; border-radius:8px; background:rgba(255,255,255,.05); }
      .idk-browser-library-item span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    `;
    document.head.append(style);
  };

  function setBackgroundTheme(pack) {
    const desktop = document.getElementById('desktop');
    if (!desktop || !pack) return;
    desktop.dataset.backgroundTheme = pack.id;
    desktop.style.setProperty('--bg-accent', pack.accent);
    desktop.style.setProperty('--bg-glow', pack.glow);
    desktop.style.setProperty('--bg-panel', pack.panel);
    desktop.style.setProperty('--bg-panel-solid', pack.solid);
    desktop.style.setProperty('--accent', pack.accent);
    desktop.style.setProperty('--panel', pack.panel);
    desktop.style.setProperty('--panel-solid', pack.solid);
    localStorage.setItem('idkBackgroundTheme-v1', pack.id);
  }

  function setWallpaper(value) {
    const safe = String(value || '').trim().replace(/["\\\\\\r\\n]/g, '');
    const gradient = /^(linear|radial|conic)-gradient\(/.test(safe);
    document.documentElement.style.setProperty('--wallpaper', safe ? (gradient ? safe : 'url("' + safe + '"), linear-gradient(135deg,#16224a,#2b1748)') : 'linear-gradient(135deg,#16224a,#2b1748)');
    localStorage.setItem('idkWallpaper', JSON.stringify(safe));
    localStorage.setItem('wallpaper', JSON.stringify(safe));
  }

  function applyPack(pack) {
    setWallpaper(pack.wallpaper);
    setBackgroundTheme(pack);
    localStorage.setItem(KEY, pack.id);
    localStorage.setItem('theme', JSON.stringify(pack.id === 'blue' ? 'midnight' : 'custom'));
    if (pack.id !== 'blue') {
      const custom = { accent: pack.accent, panel: pack.panel, panelSolid: pack.solid, text: '#eaf0ff' };
      localStorage.setItem('idkCustomTheme', JSON.stringify(custom));
    }
    window.dispatchEvent(new CustomEvent('idk-background-theme-refresh'));
    window.OS?.notify?.('Appearance', `${pack.name} theme applied.`, 'success');
    refreshThemePackButtons();
  }

  function addThemePacks() {
    const settings = [...document.querySelectorAll('.app')].find(root => root.querySelector('h2')?.textContent?.trim() === 'Settings');
    if (!settings || settings.dataset.idkThemePacks) return;
    settings.dataset.idkThemePacks = '1';
    const section = document.createElement('section');
    section.className = 'idk-theme-pack';
    const title = document.createElement('strong');
    title.textContent = 'Theme packs';
    const sub = document.createElement('small');
    sub.textContent = 'Background + UI colors stay synchronized.';
    sub.style.display = 'block';
    sub.style.marginTop = '3px';
    const grid = document.createElement('div');
    grid.className = 'idk-theme-pack-grid';
    packs.forEach(pack => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'idk-theme-pack-button';
      button.dataset.themePack = pack.id;
      button.innerHTML = `<span class="idk-theme-swatch"></span><strong></strong>`;
      button.querySelector('.idk-theme-swatch').style.background = `linear-gradient(135deg, ${pack.solid}, ${pack.glow})`;
      button.querySelector('strong').textContent = pack.name;
      button.addEventListener('click', () => applyPack(pack));
      grid.append(button);
    });
    section.append(title, sub, grid);
    settings.querySelector('h2')?.after(section);
    refreshThemePackButtons();
  }

  function refreshThemePackButtons() {
    const active = localStorage.getItem(KEY);
    document.querySelectorAll('[data-theme-pack]').forEach(button => button.classList.toggle('active', button.dataset.themePack === active));
  }

  function bookmarkList() {
    const value = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  }

  function saveBookmark(url, title) {
    if (!/^https?:/i.test(url)) return false;
    const next = [{ url, title: title || url, savedAt: Date.now() }, ...bookmarkList().filter(item => item.url !== url)].slice(0, 30);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    return true;
  }

  function saveHistory(url, title) {
    if (!/^https?:/i.test(url)) return;
    const next = [{ url, title: title || url, visitedAt: Date.now() }, ...JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').filter(item => item.url !== url)].slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  function browserURL(root) {
    const input = root.querySelector('input[type="url"], input[type="search"], input[placeholder*="URL" i], input[placeholder*="address" i]');
    if (input?.value && /^https?:/i.test(input.value.trim())) return input.value.trim();
    const frame = [...root.querySelectorAll('iframe')].find(f => /^https?:/i.test(f.src || ''));
    return frame?.src || '';
  }

  function enhanceBrowser(root) {
    if (!root || root.dataset.idkPowerBrowser) return;
    root.dataset.idkPowerBrowser = '1';
    const tools = document.createElement('div');
    tools.className = 'idk-browser-tools';
    const bookmark = document.createElement('button');
    bookmark.className = 'btn tab'; bookmark.type = 'button'; bookmark.textContent = '☆ Bookmark';
    const library = document.createElement('button');
    library.className = 'btn tab'; library.type = 'button'; library.textContent = 'Bookmarks';
    const history = document.createElement('button');
    history.className = 'btn tab'; history.type = 'button'; history.textContent = 'History';
    const saveFile = document.createElement('button');
    saveFile.className = 'btn tab'; saveFile.type = 'button'; saveFile.textContent = 'Save URL to Files';
    const fullscreen = document.createElement('button');
    fullscreen.className = 'btn tab'; fullscreen.type = 'button'; fullscreen.textContent = 'Fullscreen';
    const panel = document.createElement('div');
    panel.className = 'idk-browser-library';
    panel.hidden = true;
    tools.append(bookmark, library, history, saveFile, fullscreen);
    root.prepend(tools);
    root.prepend(panel);

    const renderList = (mode) => {
      panel.replaceChildren();
      panel.hidden = false;
      const heading = document.createElement('strong');
      heading.textContent = mode === 'history' ? 'Recently visited' : 'Bookmarks';
      panel.append(heading);
      const items = mode === 'history' ? JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') : bookmarkList();
      const list = document.createElement('div');
      list.className = 'idk-browser-library-list';
      items.slice(0, 20).forEach(item => {
        const row = document.createElement('div'); row.className = 'idk-browser-library-item';
        const label = document.createElement('span'); label.textContent = item.title || item.url; label.title = item.url;
        const open = document.createElement('button'); open.className = 'btn tab'; open.type = 'button'; open.textContent = 'Open';
        open.onclick = () => { const input = root.querySelector('input[type="url"],input[type="search"]'); if (input) { input.value = item.url; input.dispatchEvent(new Event('change',{bubbles:true})); input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); } else window.open(item.url,'_blank','noopener'); };
        row.append(label, open); list.append(row);
      });
      if (!items.length) { const empty = document.createElement('span'); empty.textContent = 'Nothing saved yet.'; list.append(empty); }
      panel.append(list);
    };

    bookmark.onclick = () => {
      const url = browserURL(root);
      if (saveBookmark(url, document.title)) { bookmark.textContent = '★ Bookmarked'; saveHistory(url, document.title); window.OS?.notify?.('Browser','Page bookmarked.','success'); }
      else window.OS?.notify?.('Browser','Open a web URL first.','warning');
    };
    library.onclick = () => renderList('bookmarks');
    history.onclick = () => renderList('history');
    saveFile.onclick = async () => {
      const url = browserURL(root);
      if (!/^https?:/i.test(url)) return window.OS?.notify?.('Browser','No web URL is open.','warning');
      const title = (root.querySelector('input[type="url"],input[type="search"]')?.value || document.title || 'Web Shortcut').trim();
      const safeTitle = title.replace(/^https?:\/\//i, '').replace(/[^a-z0-9 _.-]+/gi, '-').slice(0, 80).trim() || 'Web Shortcut';
      const shortcut = '[InternetShortcut]\nURL=' + url + '\n';
      if (window.IDKFiles?.writeTextFile) {
        window.IDKFiles.writeTextFile(safeTitle.endsWith('.url') ? safeTitle : safeTitle + '.url', shortcut, '', 'application/internet-shortcut');
        saveHistory(url, document.title);
        window.OS?.notify?.('Browser','Web shortcut saved to C:\\IDK Files.','success');
      } else {
        const blob = new Blob([shortcut], {type:'text/plain'});
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = safeTitle.endsWith('.url') ? safeTitle : safeTitle + '.url'; link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        window.OS?.notify?.('Browser','IDK Files was unavailable, so the shortcut was downloaded.','warning');
      }
    };
    fullscreen.onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await (root.requestFullscreen?.() || root.querySelector('iframe')?.requestFullscreen?.());
      } catch {
        window.OS?.notify?.('Browser','Fullscreen is unavailable in this browser.','warning');
      }
    };
    const observer = new MutationObserver(() => {
      const url = browserURL(root);
      if (/^https?:/i.test(url)) saveHistory(url, document.title);
    });
    observer.observe(root, {subtree:true,childList:true,attributes:true,attributeFilter:['src']});
    root.cleanup = () => observer.disconnect();
  }

  function desktopTools() {
    const icons = document.getElementById('icons');
    const desktop = document.getElementById('desktop');
    if (!icons || !desktop || desktop.dataset.idkDesktopTools) return;
    desktop.dataset.idkDesktopTools = '1';
    const tools = document.createElement('div');
    tools.className = 'idk-desktop-tools';
    const organize = document.createElement('button');
    organize.className='btn tab'; organize.type='button'; organize.textContent='Organize desktop';
    const reset = document.createElement('button');
    reset.className='btn tab'; reset.type='button'; reset.textContent='Reset icon layout';
    organize.onclick = () => {
      const nodes=[...icons.children].filter(n=>n.offsetParent !== null);
      nodes.forEach((node,i)=>{ node.style.left=`${24+(i%5)*118}px`; node.style.top=`${92+Math.floor(i/5)*104}px`; });
      localStorage.setItem('idkDesktopOrganizer-v1','1');
      window.OS?.notify?.('Desktop','Icons organized into a clean grid.','success');
    };
    reset.onclick = () => {
      localStorage.removeItem('idkDesktopIconPositions');
      localStorage.removeItem('desktopOrder');
      window.OS?.notify?.('Desktop','Saved icon layout reset. Reload the desktop to rebuild it.','info');
    };
    const start = document.getElementById('start-menu');
    start?.append(tools);
  }

  function scan() {
    addStyle();
    addThemePacks();
    desktopTools();
    document.querySelectorAll('.browser-app,.proxy-app,.site-frame').forEach(enhanceBrowser);
    refreshThemePackButtons();
  }

  const initialPack = packs.find(pack => pack.id === localStorage.getItem(KEY));
  if (initialPack) {
    setWallpaper(initialPack.wallpaper);
    setBackgroundTheme(initialPack);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, {once:true}); else scan();
  new MutationObserver(scan).observe(document.body, {childList:true,subtree:true});
  window.IDKDesktopCustomizationBrowser = { packs, applyPack, scan };
})();
(() => {
  'use strict';
  if (window.IDKDesktopCustomizationBrowser) return;

  const BOOKMARKS_KEY = 'idkBrowserBookmarks-v1';
  const HISTORY_KEY = 'idkBrowserHistory-v1';

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
    desktopTools();
    document.querySelectorAll('.browser-app,.proxy-app,.site-frame').forEach(enhanceBrowser);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, {once:true}); else scan();
  new MutationObserver(scan).observe(document.body, {childList:true,subtree:true});
  window.IDKDesktopCustomizationBrowser = { scan };
})();
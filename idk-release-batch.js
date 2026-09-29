(() => {
  'use strict';
  if (window.IDKReleaseBatch) return;

  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);

  function addCallHealth(root) {
    if (!root || root.dataset.idkCallHealth) return;
    root.dataset.idkCallHealth = 'true';
    const card = document.createElement('section');
    card.className = 'idk-call-health';
    card.innerHTML = '<div><strong>Connection health</strong><small data-transport>Checking call transport…</small></div><span data-state>Ready</span><div class="idk-call-actions"><button class="btn tab" data-mic>Test microphone</button><button class="btn tab" data-diagnostics>Open diagnostics</button></div>';
    root.querySelector('.idk-call-intro')?.after(card);
    const transport = card.querySelector('[data-transport]');
    const state = card.querySelector('[data-state]');
    fetch('/api/call/config', { cache: 'no-store' }).then(response => response.json()).then(data => { transport.textContent = data.hasTurn ? 'TURN relay available for difficult networks.' : 'STUN only. Add IDK_ICE_SERVERS for TURN relay support.'; }).catch(() => { transport.textContent = 'Call transport status unavailable.'; });
    const update = event => { const detail = event.detail || {}; if (/connection-state|ice-state/.test(detail.type || '')) state.textContent = detail.state ? `Network: ${detail.state}` : detail.type; if (detail.type === 'quality-sample') state.textContent = `Quality: ${detail.loss || 0}% packet loss`; if (detail.type === 'call-end') state.textContent = 'Ready for another call'; };
    window.addEventListener('idk-call-diagnostic', update);
    card.querySelector('[data-mic]').onclick = async () => { try { if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable in this browser.'); const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); const label = media.getAudioTracks()[0]?.label || 'Microphone'; media.getTracks().forEach(track => track.stop()); state.textContent = `Microphone ready: ${label}`; notify('IDK Calls', 'Microphone test passed.', 'success'); } catch (error) { state.textContent = error?.message || 'Microphone test failed.'; notify('IDK Calls', state.textContent, 'warning'); } };
    card.querySelector('[data-diagnostics]').onclick = () => window.OS?.open?.('callDiagnostics');
    root.cleanup = ((cleanup = root.cleanup) => () => { window.removeEventListener('idk-call-diagnostic', update); cleanup?.(); })();
  }

  function addDeviceSessionControls(root) {
    if (!root || root.dataset.idkDeviceSessions || !root.querySelector('[data-list]')) return;
    root.dataset.idkDeviceSessions = 'true';
    const actions = document.createElement('div');
    actions.className = 'idk-security-actions idk-release-device-actions';
    const revoke = document.createElement('button');
    revoke.type = 'button'; revoke.className = 'btn tab'; revoke.textContent = 'Sign out other devices';
    const status = root.querySelector('[data-status]');
    revoke.onclick = async () => { if (!confirm('Sign out all other IDK browser sessions?')) return; revoke.disabled = true; try { const response = await fetch('/api/account/devices/revoke-others', { method: 'POST', credentials: 'same-origin' }); const data = await response.json(); if (!response.ok || data.ok === false) throw new Error(data.error || 'Could not revoke other devices.'); if (status) status.textContent = `${data.revokedDevices || 0} other device session(s) signed out.`; notify('Account', 'Other device sessions were revoked.', 'success'); } catch (error) { if (status) status.textContent = error.message; } finally { revoke.disabled = false; } };
    actions.append(revoke);
    root.querySelector('[data-list]')?.before(actions);
  }

  function scan() {
    document.querySelectorAll('.idk-calls-app').forEach(addCallHealth);
    document.querySelectorAll('.idk-security-batch19').forEach(addDeviceSessionControls);
  }


  const GREEN_WALLPAPER = 'https://cdn.phototourl.com/member/2026-09-25-b9324e05-93bd-445b-b799-c75b6ff7b455.jpg';
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

  function enhanceBrowser(root) {
    if (!root || root.dataset.idkReleaseBrowser) return;
    const bar = root.querySelector('.toolbar');
    if (!bar) return;
    root.dataset.idkReleaseBrowser = '1';
    const frame = root.querySelector('iframe');
    const url = root.querySelector('input[type="text"],input[type="url"],input[type="search"]');
    const button = (label, title, action) => { const el = document.createElement('button'); el.className = 'btn tab idk-release-browser-button'; el.type = 'button'; el.textContent = label; el.title = title; el.onclick = action; return el; };
    const current = () => String(url?.value || frame?.src || '').trim();
    bar.append(
      button('Home', 'Open browser home', () => { if (url) { url.value = 'https://www.google.com/'; url.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); } }),
      button('Copy URL', 'Copy current URL', async () => { const value = current(); if (!/^https?:/i.test(value)) return notify('Browser', 'No web URL to copy.', 'warning'); try { await navigator.clipboard.writeText(value); notify('Browser', 'URL copied.', 'success'); } catch { notify('Browser', 'Clipboard unavailable.', 'warning'); } }),
      button('New tab', 'Open another IDK browser window', () => window.OS?.open?.('proxy'))
    );
    const remember = () => { const value = current(); if (/^https?:/i.test(value)) save('idkBrowserLastURL', value); };
    frame?.addEventListener('load', remember);
    url?.addEventListener('change', remember);
  }

  function openEchoPanel() {
    document.getElementById('idk-echo-action-center')?.remove();
    const root = document.createElement('section');
    root.id = 'idk-echo-action-center';
    root.innerHTML = '<div class="idk-echo-center-card"><button class="idk-echo-center-close" type="button" aria-label="Close Echo">×</button><div class="idk-echo-center-flag"><img src="official-flag.jpg" alt="IDK Echo"></div><span class="idk-echo-kicker">IDK ECHO</span><h2>What can I help you with?</h2><p>Choose an action and Echo will handle it on your IDK desktop.</p><div class="idk-echo-action-grid"><button data-echo-action="settings">⚙ Open Settings</button><button data-echo-action="green">🌿 Change wallpaper to Green</button><button data-echo-action="files">📁 Open Files</button><button data-echo-action="browser">🌐 Open Browser</button><button data-echo-action="agent">🤖 Open Web Agent</button></div><div class="idk-echo-center-status">Ready.</div></div>';
    document.body.append(root);
    const status = root.querySelector('.idk-echo-center-status');
    const close = () => root.remove();
    root.querySelector('.idk-echo-center-close').onclick = close;
    root.onclick = event => { if (event.target === root) close(); };
    root.querySelectorAll('[data-echo-action]').forEach(action => action.onclick = () => {
      const kind = action.dataset.echoAction;
      if (kind === 'settings') window.OS?.open?.('settings');
      if (kind === 'files') window.OS?.open?.('files');
      if (kind === 'browser') window.OS?.open?.('proxy');
      if (kind === 'agent') window.OS?.open?.('agent');
      if (kind === 'green') { if (typeof window.applyWallpaper === 'function') window.applyWallpaper(GREEN_WALLPAPER); else document.documentElement.style.setProperty('--wallpaper', `url("${GREEN_WALLPAPER}")`); save('idkWallpaper', GREEN_WALLPAPER); }
      const message = { settings: 'Settings opened.', green: 'Green wallpaper applied.', files: 'Files opened.', browser: 'Browser opened.', agent: 'Web Agent opened.' }[kind] || 'Done.';
      status.textContent = message;
      notify('IDK Echo', message, 'success');
      setTimeout(close, 500);
    });
  }

  function setupEcho() {
    const echo = document.getElementById('echo-companion');
    if (!echo || echo.dataset.idkReleaseEcho) return;
    echo.dataset.idkReleaseEcho = '1';
    echo.onclick = event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const flag = document.createElement('img');
      flag.className = 'idk-echo-flight';
      flag.src = 'official-flag.jpg';
      flag.alt = '';
      document.body.append(flag);
      requestAnimationFrame(() => flag.classList.add('fly'));
      setTimeout(() => { flag.remove(); openEchoPanel(); }, 620);
    };
  }

  function improveStates() {
    document.querySelectorAll('.loading-state,.empty-state').forEach(node => node.classList.add('idk-release-state'));
    document.querySelectorAll('.site-frame').forEach(root => {
      const frame = root.querySelector('iframe');
      if (!frame || frame.dataset.idkReleaseFrame) return;
      frame.dataset.idkReleaseFrame = '1';
      frame.addEventListener('error', () => { root.classList.add('idk-frame-error'); notify('Browser', 'The page could not be loaded. Try again.', 'error'); });
      frame.addEventListener('load', () => root.classList.remove('idk-frame-error'));
    });
  }

  const oldScan = scan;
  scan = function () {
    oldScan();
    setupEcho();
    document.querySelectorAll('.site-frame').forEach(enhanceBrowser);
    improveStates();
  };

  const installRelease = () => { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installRelease, { once: true }); else installRelease();
  window.addEventListener('error', event => { if (event?.message) notify('IDK', 'Something went wrong. Try the action again.', 'error'); });
  window.addEventListener('unhandledrejection', event => { if (event?.reason) notify('IDK', 'A background task failed. Try again.', 'error'); });
  window.IDKReleaseBatch.openEchoPanel = openEchoPanel;
  window.IDKReleaseBatch = { scan, openEchoPanel };
  const install = () => { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();

  const SMART_UNDO_KEY = 'idkSmartDesktopUndo';
  const SMART_SUGGESTION_KEY = 'idkSmartDesktopSuggestion';
  const SMART_FOLDERS = { image:'Pictures', audio:'Music', video:'Videos', document:'Documents', other:'Downloads' };
  const smartRead = (key, fallback) => { try { const value=localStorage.getItem(key); return value===null?fallback:JSON.parse(value); } catch { return fallback; } };
  const smartWrite = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} };
  const smartNotify = (title,message,kind='info') => window.OS?.notify?.(title,message,kind);
  const smartFiles = () => {
    const files=window.IDKFiles?.getFiles?.();
    if(Array.isArray(files)) return files;
    const stored=smartRead('idkFileSystem',[]);
    return Array.isArray(stored)?stored:[];
  };
  const smartKind = file => {
    const name=String(file?.name||''), mime=String(file?.mime||'').toLowerCase();
    if(mime.startsWith('image/')||/\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/i.test(name)) return 'image';
    if(mime.startsWith('audio/')||/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)) return 'audio';
    if(mime.startsWith('video/')||/\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name)) return 'video';
    if(mime.startsWith('text/')||/\.(txt|md|pdf|docx?|xlsx?|pptx?|csv|json|xml|html?|css|js|ts|rtf)$/i.test(name)) return 'document';
    return 'other';
  };
  const smartRootFiles = () => smartFiles().filter(item=>item?.type==='file'&&!item.parent);
  const smartFolderId = (files,name) => files.find(item=>item?.type==='folder'&&!item.parent&&String(item.name).toLowerCase()===name.toLowerCase())?.id;
  let smartPanel=null;
  function refreshSmartPanel(){
    if(!smartPanel?.isConnected)return;
    const files=smartFiles().filter(item=>item?.type==='file').sort((a,b)=>(b.updated||0)-(a.updated||0)).slice(0,8);
    const list=smartPanel.querySelector('[data-smart-recent]');
    list?.replaceChildren(...files.map(file=>{
      const row=document.createElement('button'); row.type='button'; row.className='idk-smart-file-row';
      row.innerHTML=`<span class="idk-smart-file-icon">📄</span><span><strong>${String(file.name||'File').replace(/[&<>"]/g,'')}</strong><small>${file.parent?'Stored in IDK Files':'On Desktop'} · ${file.updated?new Date(file.updated).toLocaleString():'Recently added'}</small></span>`;
      row.onclick=()=>window.OS?.open?.('files');
      return row;
    }));
    if(!files.length) list?.append(Object.assign(document.createElement('p'),{className:'idk-smart-empty',textContent:'No files yet.'}));
    const count=smartRootFiles().length;
    const summary=smartPanel.querySelector('[data-smart-root-count]');
    if(summary)summary.textContent=`${count} file${count===1?'':'s'} on the desktop`;
    const undo=smartPanel.querySelector('[data-smart-undo]');
    if(undo)undo.disabled=!smartRead(SMART_UNDO_KEY,null)?.changes?.length;
  }
  function smartUndo(){
    const snapshot=smartRead(SMART_UNDO_KEY,null);
    if(!snapshot?.changes?.length){smartNotify('Smart Desktop','There is no recent organization to undo.','warning');return false;}
    const files=smartFiles(); let restored=0;
    snapshot.changes.forEach(change=>{const file=files.find(item=>item.id===change.id);if(!file)return;file.parent=change.parent||'';file.updated=Date.now();restored++;});
    smartWrite('idkFileSystem',files); smartWrite(SMART_UNDO_KEY,null);
    window.dispatchEvent(new CustomEvent('idk-files-changed'));
    smartNotify('Smart Desktop',`Restored ${restored} file${restored===1?'':'s'} to the previous locations.`,'success');
    refreshSmartPanel(); return true;
  }
  function smartOrganize(fileIds=null){
    const files=smartFiles(), target=fileIds?new Set(fileIds):null, changes=[];
    files.filter(item=>item?.type==='file'&&(!target||target.has(item.id))).forEach(file=>{
      if(target&&file.parent) return;
      const folderId=smartFolderId(files,SMART_FOLDERS[smartKind(file)]);
      if(!folderId||file.parent===folderId)return;
      changes.push({id:file.id,parent:file.parent||''}); file.parent=folderId; file.updated=Date.now();
    });
    if(!changes.length){smartNotify('Smart Desktop','Your selected files are already organized.','info');return 0;}
    smartWrite(SMART_UNDO_KEY,{at:Date.now(),changes}); smartWrite('idkFileSystem',files);
    window.dispatchEvent(new CustomEvent('idk-files-changed'));
    smartNotify('Smart Desktop',`Organized ${changes.length} file${changes.length===1?'':'s'} by type. Undo is available.`,'success');
    refreshSmartPanel(); return changes.length;
  }
  function openSmartDesktop(){
    smartPanel?.remove();
    smartPanel=document.createElement('section'); smartPanel.id='idk-smart-desktop-panel'; smartPanel.setAttribute('role','dialog');
    smartPanel.innerHTML='<div class="idk-smart-desktop-card"><button type="button" class="idk-smart-close" data-close aria-label="Close Smart Desktop">×</button><span class="idk-smart-kicker">IDK SMART DESKTOP 2.0</span><h2>Keep your desktop organized</h2><p>Echo can organize local IDK files by type without deleting anything.</p><div class="idk-smart-actions"><button type="button" data-organize>Organize desktop files</button><button type="button" data-undo>Undo last organization</button><button type="button" data-files>Open Files</button></div><div class="idk-smart-summary"><strong data-smart-root-count></strong><span>Drop files onto Echo for a quick organize suggestion.</span></div><h3>Recently added</h3><div data-smart-recent class="idk-smart-recent"></div><p class="idk-smart-tip">Nothing is deleted. Every automatic move can be undone once.</p></div>';
    document.body.append(smartPanel);
    smartPanel.querySelector('[data-close]').onclick=()=>{smartPanel.remove();smartPanel=null;};
    smartPanel.onclick=e=>{if(e.target===smartPanel){smartPanel.remove();smartPanel=null;}};
    smartPanel.querySelector('[data-organize]').onclick=()=>smartOrganize();
    smartPanel.querySelector('[data-undo]').onclick=smartUndo;
    smartPanel.querySelector('[data-files]').onclick=()=>window.OS?.open?.('files');
    refreshSmartPanel();
  }
  function addSmartEchoControls(){
    const panel=document.getElementById('idk-echo-action-center');
    if(panel&&!panel.querySelector('[data-echo-action="smart"]')){
      const grid=panel.querySelector('.idk-echo-action-grid'), button=document.createElement('button');
      button.type='button'; button.dataset.echoAction='smart'; button.textContent='🧠 Smart Desktop'; grid?.append(button);
      button.onclick=()=>{openSmartDesktop();panel.remove();};
    }
    const echo=document.getElementById('echo-companion');
    if(!echo||echo.dataset.idkSmartEcho)return;
    echo.dataset.idkSmartEcho='1';
    echo.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();e.stopPropagation();echo.classList.add('idk-echo-drop-ready');}});
    echo.addEventListener('dragleave',()=>echo.classList.remove('idk-echo-drop-ready'));
    echo.addEventListener('drop',async e=>{
      const files=[...(e.dataTransfer?.files||[])]; if(!files.length)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();echo.classList.remove('idk-echo-drop-ready');
      try{
        const entries=await window.SYSTEM_APPS?.importFiles?.(files),ids=(entries||[]).map(item=>item.id).filter(Boolean);
        smartNotify('IDK Echo',`Added ${files.length} file${files.length===1?'':'s'} to IDK Files.`,'success'); openSmartDesktop();
        if(ids.length){smartPanel.querySelector('[data-organize]').onclick=()=>smartOrganize(ids);smartPanel.querySelector('.idk-smart-summary span').textContent='These files are ready to organize by type.';}
      }catch(error){smartNotify('IDK Echo',error?.message||'Could not import the dropped files.','error');}
    },true);
  }
  function smartCleanupSuggestion(){
    const count=smartRootFiles().length,last=smartRead(SMART_SUGGESTION_KEY,0);
    if(count<12||count===last)return;
    smartWrite(SMART_SUGGESTION_KEY,count);
    setTimeout(()=>{
      if(document.getElementById('idk-smart-cleanup-toast'))return;
      const toast=document.createElement('div');toast.id='idk-smart-cleanup-toast';toast.className='idk-smart-cleanup-toast';
      toast.innerHTML=`<strong>Desktop is getting busy</strong><span>${count} files are on your desktop. Want Echo to organize them?</span><div><button type="button" data-yes>Organize</button><button type="button" data-no>Not now</button></div>`;
      document.body.append(toast);toast.querySelector('[data-yes]').onclick=()=>{toast.remove();smartOrganize();};toast.querySelector('[data-no]').onclick=()=>toast.remove();
    },700);
  }
  function installSmartDesktop(){
    if(window.__IDKSmartDesktopInstalled)return; window.__IDKSmartDesktopInstalled=true;
    addSmartEchoControls(); smartCleanupSuggestion();
    window.addEventListener('idk-files-changed',()=>{refreshSmartPanel();setTimeout(smartCleanupSuggestion,120);});
    window.IDKSmartDesktop={open:openSmartDesktop,organize:smartOrganize,undo:smartUndo,recent:smartRecentFiles};
  }
  const smartRecentFiles=()=>smartFiles().filter(item=>item?.type==='file').sort((a,b)=>(b.updated||0)-(a.updated||0)).slice(0,8);
  const previousScan=scan; scan=function(){previousScan();addSmartEchoControls();};
  installSmartDesktop();

})();
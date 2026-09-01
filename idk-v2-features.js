(() => {
  'use strict';

  const PROGRAMS_KEY = 'idkInstalledPrograms';
  const INSTALL_DB = 'idkInstalledProgramsDB';
  const INSTALL_STORE = 'programs';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

  function addStyle() {
    if (document.getElementById('idk-v2-feature-style')) return;
    const style = document.createElement('link');
    style.id = 'idk-v2-feature-style';
    style.rel = 'stylesheet';
    style.href = 'idk-v2-features.css';
    document.head.appendChild(style);
  }

  function openInstallDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB is unavailable.'));
      const req = indexedDB.open(INSTALL_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(INSTALL_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open installer storage.'));
    });
  }
  async function putProgram(id, blob) {
    const db = await openInstallDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(INSTALL_STORE, 'readwrite');
      tx.objectStore(INSTALL_STORE).put(blob, id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not save program.'));
    });
  }
  async function getProgram(id) {
    const db = await openInstallDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(INSTALL_STORE, 'readonly').objectStore(INSTALL_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Could not load program.'));
    });
  }

  function programName(fileName) {
    return fileName.replace(/\.(html?|xhtml)$/i, '').replace(/[-_]+/g, ' ').trim() || 'HTML Program';
  }

  async function launchInstalledProgram(program) {
    try {
      const blob = await getProgram(program.id);
      if (!blob) throw new Error('Program data is missing.');
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) window.OS?.notify?.('Program Installer', 'Your browser blocked the program window. Allow pop-ups for IDK 10.0.', 'warning');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      window.OS?.notify?.('Program Installer', error.message, 'error');
    }
  }

  function addDesktopShortcut(program) {
    const layer = document.getElementById('icons');
    if (!layer) return;
    const existing = [...layer.querySelectorAll('[data-installed-program]')].find(el => el.dataset.installedProgram === program.id);
    if (existing) return;
    const icon = document.createElement('button');
    icon.type = 'button';
    icon.className = 'idk-installed-shortcut';
    icon.dataset.installedProgram = program.id;
    icon.title = `Open ${program.name}`;
    icon.innerHTML = `<span class="idk-installed-shortcut-icon">${esc(program.icon || '🎮')}</span><span>${esc(program.name)}</span>`;
    icon.addEventListener('dblclick', () => launchInstalledProgram(program));
    icon.addEventListener('click', () => { document.querySelectorAll('.idk-installed-shortcut.selected').forEach(el => el.classList.remove('selected')); icon.classList.add('selected'); });
    layer.appendChild(icon);
  }

  function restoreShortcuts() {
    read(PROGRAMS_KEY, []).forEach(program => addDesktopShortcut(program));
  }

  function installerView(onDone) {
    const root = document.createElement('section');
    root.className = 'idk-installer';
    root.innerHTML = `
      <div class="idk-installer-titlebar"><strong>Program Installer Setup</strong><button type="button" class="idk-installer-close" aria-label="Close">×</button></div>
      <div class="idk-installer-banner"><span class="idk-installer-logo">＋</span><div><strong>Install an HTML program</strong><small>Choose an .html or .htm file and place it on your IDK 10.0 desktop.</small></div></div>
      <div class="idk-installer-body">
        <div class="idk-installer-steps"><span class="active">1</span><span>2</span><span>3</span><span>✓</span></div>
        <div class="idk-installer-main">
          <h3 id="idk-install-heading">Select Program File</h3>
          <p id="idk-install-help">Choose the HTML game or program you want to install.</p>
          <div class="idk-install-card"><label class="idk-install-file"><input id="idk-install-file" type="file" accept=".html,.htm,text/html"><span>Choose HTML file…</span></label><div class="idk-install-path" id="idk-install-path">No file selected</div></div>
          <div class="idk-install-options" id="idk-install-options" hidden><label>Program name<input id="idk-program-name" class="field" type="text"></label><label>Desktop icon<select id="idk-program-icon" class="field"><option>🎮</option><option>🕹️</option><option>🚀</option><option>⭐</option><option>🧩</option><option>🌐</option></select></label><label class="idk-check"><input id="idk-create-shortcut" type="checkbox" checked> Create desktop shortcut</label></div>
          <div class="idk-install-destination" id="idk-install-destination" hidden><strong>Install location</strong><span>C:\\IDK\\Programs\\<b id="idk-destination-name">Program</b></span><button type="button">Browse…</button></div>
          <div class="idk-install-status" id="idk-install-status" aria-live="polite"></div>
        </div>
      </div>
      <div class="idk-installer-actions"><button type="button" class="btn tab" data-installer="back">&lt; Back</button><button type="button" class="btn" data-installer="next">Next &gt;</button><button type="button" class="btn tab" data-installer="cancel">Cancel</button></div>`;

    const close = () => root.remove();
    root.querySelector('.idk-installer-close').onclick = close;
    root.querySelector('[data-installer="cancel"]').onclick = close;
    const back = root.querySelector('[data-installer="back"]');
    const next = root.querySelector('[data-installer="next"]');
    const fileInput = root.querySelector('#idk-install-file');
    const path = root.querySelector('#idk-install-path');
    const options = root.querySelector('#idk-install-options');
    const destination = root.querySelector('#idk-install-destination');
    const nameInput = root.querySelector('#idk-program-name');
    const iconInput = root.querySelector('#idk-program-icon');
    const shortcutInput = root.querySelector('#idk-create-shortcut');
    const destinationName = root.querySelector('#idk-destination-name');
    const heading = root.querySelector('#idk-install-heading');
    const help = root.querySelector('#idk-install-help');
    const status = root.querySelector('#idk-install-status');
    let selectedFile = null;
    let step = 1;

    const renderStep = () => {
      root.querySelectorAll('.idk-installer-steps span').forEach((el, i) => el.classList.toggle('active', i === step - 1));
      options.hidden = step < 2;
      destination.hidden = step < 3;
      back.disabled = step <= 1;
      next.textContent = step === 3 ? 'Install' : 'Next >';
      if (step === 1) { heading.textContent = 'Select Program File'; help.textContent = 'Choose the HTML game or program you want to install.'; }
      if (step === 2) { heading.textContent = 'Installation Options'; help.textContent = 'Choose a name and desktop icon for your program.'; }
      if (step === 3) { heading.textContent = 'Select Destination Location'; help.textContent = 'Review the destination before installing.'; }
    };

    fileInput.onchange = () => {
      selectedFile = fileInput.files?.[0] || null;
      if (!selectedFile) return;
      if (!/\.html?$/i.test(selectedFile.name)) { status.textContent = 'Please choose an HTML file.'; selectedFile = null; return; }
      path.textContent = selectedFile.name;
      nameInput.value = programName(selectedFile.name);
      destinationName.textContent = nameInput.value;
      status.textContent = `${(selectedFile.size / 1024).toFixed(1)} KB · HTML program`;
    };
    nameInput.oninput = () => { destinationName.textContent = nameInput.value.trim() || 'Program'; };
    back.onclick = () => { if (step > 1) { step -= 1; renderStep(); } };
    next.onclick = async () => {
      if (step === 1) { if (!selectedFile) { status.textContent = 'Select an HTML file first.'; return; } step = 2; renderStep(); return; }
      if (step === 2) { if (!nameInput.value.trim()) { status.textContent = 'Enter a program name.'; return; } step = 3; renderStep(); return; }
      if (!selectedFile) return;
      next.disabled = true; status.textContent = 'Installing…';
      try {
        const id = `program-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const program = { id, name: nameInput.value.trim(), icon: iconInput.value, installedAt: Date.now(), fileName: selectedFile.name };
        await putProgram(id, selectedFile);
        const programs = read(PROGRAMS_KEY, []).filter(item => item.name !== program.name);
        programs.unshift(program); write(PROGRAMS_KEY, programs);
        if (shortcutInput.checked) addDesktopShortcut(program);
        status.textContent = `${program.name} was installed successfully.`;
        next.textContent = 'Done'; next.disabled = false;
        next.onclick = () => { close(); onDone?.(program); };
        root.querySelector('.idk-installer-steps span:last-child').classList.add('active');
        window.OS?.notify?.('Program Installer', `${program.name} is ready on the desktop.`);
      } catch (error) { status.textContent = `Installation failed: ${error.message}`; next.disabled = false; }
    };
    renderStep();
    return root;
  }

  function showInstaller() {
    let overlay = document.querySelector('.idk-installer-overlay');
    if (!overlay) { overlay = document.createElement('div'); overlay.className = 'idk-installer-overlay'; document.body.appendChild(overlay); }
    overlay.replaceChildren(installerView(() => overlay.remove()));
  }

  function startMenuEnhancement() {
    const menu = document.getElementById('start-menu');
    if (!menu || menu.dataset.idkEnhanced) return;
    menu.dataset.idkEnhanced = 'true';
    const search = document.getElementById('start-search');
    const recent = document.getElementById('start-recent');
    const apps = document.getElementById('start-apps');
    const heading = menu.querySelector('.start-heading');
    if (heading) heading.innerHTML = `<div class="idk-start-profile"><span class="idk-avatar">LC</span><span><strong>Luis Corona</strong><small>Administrator</small></span></div><span>IDK 10.0</span>`;
    const tools = document.createElement('div');
    tools.className = 'idk-start-tools';
    tools.innerHTML = `<button type="button" data-start-action="files">📁 Files</button><button type="button" data-start-action="settings">⚙ Settings</button><button type="button" data-start-action="power">⏻ Power</button>`;
    menu.insertBefore(tools, search);
    const dashboard = document.createElement('div');
    dashboard.className = 'idk-start-dashboard';
    dashboard.innerHTML = `<div class="idk-dashboard-card"><small>Brief</small><strong>Today</strong><span>Calendar and task reminders appear here.</span></div><div class="idk-dashboard-card"><small>Quick access</small><strong>Files</strong><span>Documents · Downloads · Pictures</span></div><div class="idk-dashboard-card"><small>Scheduled</small><strong>0 tasks</strong><span>You're all caught up.</span></div>`;
    menu.insertBefore(dashboard, recent);
    tools.addEventListener('click', event => {
      const button = event.target.closest('[data-start-action]'); if (!button) return;
      if (button.dataset.startAction === 'files') document.querySelector('.idk-file-home-launch')?.click();
      if (button.dataset.startAction === 'settings') document.querySelector('#start-apps button')?.click();
      if (button.dataset.startAction === 'power') window.OS?.notify?.('Power', 'Use the existing IDK power controls to lock, sleep, restart, or shut down.');
    });
    if (search) search.placeholder = 'Search anything';
  }

  function fileHomeMarkup() {
    return `<div class="idk-file-home"><div class="idk-file-toolbar"><div class="idk-file-nav"><button type="button">←</button><button type="button">→</button><button type="button">↑</button><button type="button">↻</button><span>Home</span></div><input class="field idk-file-search" type="search" placeholder="Search anything" aria-label="Search anything"></div><div class="idk-file-command"><button class="btn" type="button" data-file-action="new">＋ New</button><button class="btn tab" type="button">✂ Cut</button><button class="btn tab" type="button">Copy</button><button class="btn tab" type="button">Rename</button><button class="btn tab" type="button">Delete</button><button class="btn tab" type="button">Share</button><span></span><button class="btn tab" type="button">View</button><button class="btn tab" type="button">Sort</button><button class="btn tab" type="button">Filter</button></div><div class="idk-file-layout"><aside class="idk-file-sidebar"><strong>Quick Navigation</strong>${['Home','Gallery','Desktop','Downloads','Documents','Pictures','Music','This PC','Network'].map(item => `<button type="button">${item}</button>`).join('')}<div class="idk-dropzone" id="idk-dropzone"><strong>Dropzone</strong><span>Drop files here to stash them temporarily.</span><button type="button" data-file-action="clear-drop">Clear</button></div></aside><main class="idk-file-main"><div class="idk-file-section-title"><div><strong>Quick Access</strong><small>Pinned primary folders</small></div><button type="button" class="btn" data-file-action="installer">＋ Program Installer</button></div><div class="idk-folder-grid">${[['Desktop','🖥️'],['Downloads','⬇️'],['Documents','📄'],['Pictures','🖼️'],['Music','🎵'],['Videos','▶️'],['Program Installer','📦']].map(([name,icon]) => `<button class="idk-folder-card" type="button" data-folder="${name}"><span>${icon}</span><strong>${name}</strong><small>${name === 'Program Installer' ? 'Install HTML apps' : 'Stored locally'}${name !== 'Program Installer' ? ' · 📌' : ''}</small></button>`).join('')}</div><div class="idk-file-section-title"><div><strong>Recent Files</strong><small>Your local file activity</small></div></div><div class="idk-recent-files" id="idk-recent-files"></div></main></div></div>`;
  }

  function enhanceFilesWindow(win) {
    if (!win || win.dataset.idkFilesEnhanced === 'true') return;
    const title = win.querySelector('.title');
    if (!title || !/files/i.test(title.textContent || '')) return;
    win.dataset.idkFilesEnhanced = 'true';
    const content = win.querySelector('.content'); if (!content) return;
    content.innerHTML = fileHomeMarkup();
    const input = content.querySelector('.idk-file-search');
    const recent = content.querySelector('#idk-recent-files');
    const entries = read('idkFileSystem', []).filter(item => item && item.type === 'file').sort((a,b) => (b.updated || 0) - (a.updated || 0)).slice(0,8);
    recent.innerHTML = entries.length ? entries.map(item => `<button class="idk-recent-file" type="button"><span>📄</span><span><strong>${esc(item.name)}</strong><small>${esc(item.mime || 'File')} · ${item.updated ? new Date(item.updated).toLocaleString() : 'Stored locally'}</small></span></button>`).join('') : '<div class="idk-file-empty">No recent files yet. Import or create one to see it here.</div>';
    content.querySelectorAll('[data-folder]').forEach(card => card.addEventListener('click', () => { if (card.dataset.folder === 'Program Installer') showInstaller(); else window.OS?.notify?.('Files', `${card.dataset.folder} is available in the IDK local file system.`); }));
    content.querySelector('[data-file-action="installer"]').onclick = showInstaller;
    content.querySelector('[data-file-action="new"]').onclick = () => window.OS?.notify?.('Files', 'Use the existing New File tools to create a file.');
    input.addEventListener('input', () => { const q = input.value.trim().toLowerCase(); content.querySelectorAll('.idk-recent-file').forEach(item => { item.hidden = q && !item.textContent.toLowerCase().includes(q); }); });
    const drop = content.querySelector('#idk-dropzone');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('active'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('active'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('active'); const files = [...(e.dataTransfer?.files || [])]; if (files.length) { write('idkDropzone', files.map(f => ({ name:f.name, size:f.size, type:f.type, at:Date.now() }))); window.OS?.notify?.('Dropzone', `${files.length} file${files.length === 1 ? '' : 's'} stashed temporarily.`); } });
    content.querySelector('[data-file-action="clear-drop"]').onclick = () => { localStorage.removeItem('idkDropzone'); window.OS?.notify?.('Dropzone', 'Temporary stash cleared.'); };
  }

  function observeWindows() {
    const layer = document.getElementById('windows'); if (!layer) return;
    const scan = () => layer.querySelectorAll('.window').forEach(enhanceFilesWindow);
    scan(); new MutationObserver(scan).observe(layer, { childList: true, subtree: true });
  }

  function init() {
    addStyle(); startMenuEnhancement(); restoreShortcuts(); observeWindows();
    setTimeout(startMenuEnhancement, 500); setTimeout(restoreShortcuts, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();

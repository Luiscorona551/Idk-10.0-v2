(() => {
  'use strict';

  const KEY = 'idkInstalledPrograms';
  const DB_NAME = 'idkInstalledProgramsDB';
  const STORE = 'programs';
  let installerOverlay = null;
  let opening = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open program storage.'));
    });
  }

  async function saveProgramFile(id, file) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(file, id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Unable to save program.'));
        tx.onabort = () => reject(tx.error || new Error('Program save was aborted.'));
      });
    } finally {
      db.close();
    }
  }

  async function loadProgramFile(id) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Unable to load program.'));
      });
    } finally {
      db.close();
    }
  }

  async function removeProgram(id) {
    if (window.IDKAccount?.user) {
      const response = await fetch(`/api/account/programs/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok && response.status !== 404) throw new Error('The program could not be removed from your account.');
    }
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Unable to remove the program.'));
      });
    } finally { db.close(); }
    write(KEY, read(KEY, []).filter(program => program.id !== id));
    document.querySelectorAll(`[data-installer-program="${CSS.escape(id)}"]`).forEach(node => node.remove());
  }

  async function repairProgram(program) {
    let blob = await loadProgramFile(program.id);
    if (!blob && window.IDKAccount?.user) {
      const response = await fetch(`/api/account/programs/${encodeURIComponent(program.id)}/content`, { credentials: 'same-origin' });
      if (response.ok) blob = await response.blob();
    }
    if (!blob) throw new Error('The saved program file is missing. Reinstall it to repair this app.');
    await saveProgramFile(program.id, blob);
    addShortcut(program);
    return true;
  }

  async function apiRequest(url, options = {}) {
    try {
      const response = await fetch(url, { credentials: 'same-origin', ...options });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, ...data };
    } catch {
      return { ok: false };
    }
  }

  async function launchProgram(program) {
    try {
      let blob = null;
      if (window.IDKAccount?.user) {
        const response = await fetch(`/api/account/programs/${encodeURIComponent(program.id)}/content`, { credentials: 'same-origin' });
        if (response.ok) blob = await response.blob();
      }
      if (!blob) blob = await loadProgramFile(program.id);
      if (!blob) throw new Error('The saved program file could not be found.');

      const url = URL.createObjectURL(blob);
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) alert('Allow pop-ups for IDK 10.0 to launch this program.');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      alert(error.message || 'Unable to launch the program.');
    }
  }

  function addShortcut(program) {
    const layer = document.getElementById('icons');
    if (!layer || !program?.id) return;
    let button = layer.querySelector(`[data-installer-program="${CSS.escape(program.id)}"]`);
    if (button) return;

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'idk-installed-shortcut';
    button.dataset.installerProgram = program.id;
    button.title = `Open ${program.name}`;
    button.innerHTML = `<span class="idk-installed-shortcut-icon">${esc(program.icon || '🎮')}</span><span>${esc(program.name)}</span>`;

    let lastLaunch = 0;
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (now - lastLaunch < 700) return;
      lastLaunch = now;
      launchProgram(program);
    };
    button.ondblclick = event => event.preventDefault();
    layer.appendChild(button);
  }

  function closeInstaller() {
    installerOverlay?.remove();
    installerOverlay = null;
    opening = false;
  }

  function setStatus(root, text, type = '') {
    const status = root.querySelector('#pi-status');
    status.textContent = text;
    status.className = `idk-install-status ${type}`.trim();
  }

  async function openInstaller() {
    if (opening || installerOverlay?.isConnected) return;
    opening = true;

    try {
      const overlay = document.createElement('div');
      overlay.className = 'idk-installer-overlay';
      overlay.innerHTML = `
        <section class="idk-installer" role="dialog" aria-modal="true" aria-label="Program Installer Setup">
          <div class="idk-installer-titlebar">
            <strong>Program Installer Setup</strong>
            <button type="button" class="idk-installer-close" aria-label="Close installer">×</button>
          </div>
          <div class="idk-installer-banner">
            <span class="idk-installer-logo">📦</span>
            <div><strong>Program Installer</strong><small>Install an HTML game or program on your IDK 10.0 desktop.</small></div>
          </div>
          <div class="idk-installer-body">
            <div class="idk-installer-steps"><span class="active">1</span><span>2</span><span>3</span><span>✓</span></div>
            <div class="idk-installer-main">
              <h3 id="pi-title">Select Program File</h3>
              <p id="pi-help">Choose the HTML game or program you want to install.</p>
              <div class="idk-install-card">
                <label class="idk-install-file"><input id="pi-file" type="file" accept=".html,.htm,text/html"><span>Choose HTML file…</span></label>
                <div class="idk-install-path" id="pi-path">No file selected</div>
              </div>
              <div class="idk-install-options" id="pi-options" hidden>
                <label>Program name<input id="pi-name" class="field" type="text" autocomplete="off"></label>
                <label>Desktop icon<select id="pi-icon" class="field"><option>🎮</option><option>🕹️</option><option>🚀</option><option>⭐</option><option>🧩</option><option>🌐</option></select></label>
                <label class="idk-check"><input id="pi-shortcut" type="checkbox" checked> Create desktop shortcut</label>
              </div>
              <div class="idk-install-destination" id="pi-dest" hidden>
                <strong>Install location</strong>
                <span>Desktop · IDK 10.0 Desktop / <b id="pi-dest-name">Program</b></span>
              </div>
              <div class="idk-install-status" id="pi-status" role="status" aria-live="polite"></div>
            </div>
          </div>
          <div class="idk-installer-actions">
            <button type="button" class="btn tab" id="pi-back" disabled>&lt; Back</button>
            <button type="button" class="btn" id="pi-next">Next &gt;</button>
            <button type="button" class="btn tab" id="pi-cancel">Cancel</button>
          </div>
        </section>`;

      document.body.appendChild(overlay);
      installerOverlay = overlay;
      opening = false;

      const $ = selector => overlay.querySelector(selector);
      const fileInput = $('#pi-file');
      const path = $('#pi-path');
      const name = $('#pi-name');
      const icon = $('#pi-icon');
      const options = $('#pi-options');
      const destination = $('#pi-dest');
      const destinationName = $('#pi-dest-name');
      const next = $('#pi-next');
      const back = $('#pi-back');
      let selectedFile = null;
      let step = 1;
      let busy = false;

      const render = () => {
        overlay.querySelectorAll('.idk-installer-steps span').forEach((item, index) => {
          item.classList.toggle('active', index === step - 1);
        });
        options.hidden = step < 2;
        destination.hidden = step < 3;
        back.disabled = step <= 1 || busy;
        next.disabled = busy;
        next.textContent = step === 3 ? 'Install' : 'Next >';
        $('#pi-title').textContent = step === 1 ? 'Select Program File' : step === 2 ? 'Installation Options' : 'Select Destination Location';
        $('#pi-help').textContent = step === 1 ? 'Choose the HTML game or program you want to install.' : step === 2 ? 'Choose a name and desktop icon for your program.' : 'The program will be saved to your IDK desktop.';
      };

      fileInput.onchange = () => {
        const candidate = fileInput.files?.[0] || null;
        if (!candidate) return;
        if (!/\.html?$/i.test(candidate.name)) {
          selectedFile = null;
          setStatus(overlay, 'Please choose an HTML file.', 'error');
          return;
        }
        selectedFile = candidate;
        const suggestedName = candidate.name.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').trim() || 'HTML Program';
        name.value = suggestedName;
        destinationName.textContent = suggestedName;
        path.textContent = candidate.name;
        setStatus(overlay, `${(candidate.size / 1024).toFixed(1)} KB · HTML program`);
      };

      name.oninput = () => { destinationName.textContent = name.value.trim() || 'Program'; };
      $('#pi-cancel').onclick = closeInstaller;
      $('.idk-installer-close').onclick = closeInstaller;
      overlay.addEventListener('click', event => { if (event.target === overlay) closeInstaller(); });

      back.onclick = () => {
        if (busy || step <= 1) return;
        step -= 1;
        render();
      };

      next.onclick = async () => {
        if (busy) return;
        if (step === 1) {
          if (!selectedFile) { setStatus(overlay, 'Select an HTML file first.', 'error'); return; }
          step = 2;
          render();
          return;
        }
        if (step === 2) {
          if (!name.value.trim()) { setStatus(overlay, 'Enter a program name.', 'error'); return; }
          step = 3;
          render();
          return;
        }

        busy = true;
        render();
        setStatus(overlay, 'Installing…');

        try {
          const id = `program-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const program = {
            id,
            name: name.value.trim(),
            icon: icon.value,
            fileName: selectedFile.name,
            installedAt: Date.now()
          };

          await saveProgramFile(id, selectedFile);

          let finalProgram = program;
          const existing = read(KEY, []).filter(item => item.name !== program.name);
          write(KEY, [program, ...existing]);

          if (window.IDKAccount?.user) {
            const buffer = await selectedFile.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
            const result = await apiRequest('/api/account/programs', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ ...program, contentBase64: btoa(binary) })
            });
            if (result.ok && result.program) {
              finalProgram = result.program;
              write(KEY, [finalProgram, ...read(KEY, []).filter(item => item.id !== program.id && item.name !== program.name)]);
            }
          }

          if ($('#pi-shortcut').checked) addShortcut(finalProgram);
          setStatus(overlay, `${program.name} was installed successfully.`, 'success');
          next.textContent = 'Done';
          next.disabled = false;
          busy = false;
          next.onclick = closeInstaller;
        } catch (error) {
          busy = false;
          render();
          setStatus(overlay, `Installation failed: ${error.message || 'Unknown error'}`, 'error');
        }
      };

      render();
      setTimeout(() => fileInput.focus(), 0);
    } catch (error) {
      installerOverlay = null;
      opening = false;
      console.error('IDK Program Installer failed to open:', error);
      alert('Program Installer could not be opened. Please refresh IDK 10.0 and try again.');
    }
  }

  function addInstallerIcon() {
    const layer = document.getElementById('icons');
    if (!layer || layer.querySelector('.idk-program-installer-icon')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'idk-installed-shortcut idk-program-installer-icon';
    button.title = 'Program Installer';
    button.innerHTML = '<span class="idk-installed-shortcut-icon">📦</span><span>Program Installer</span>';
    let lastOpen = 0;
    const open = event => {
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (now - lastOpen < 700 || opening || installerOverlay?.isConnected) return;
      lastOpen = now;
      openInstaller();
    };
    button.onclick = open;
    button.ondblclick = event => event.preventDefault();
    layer.appendChild(button);
  }

  async function syncCloudPrograms() {
    const result = await apiRequest('/api/account/programs');
    if (!result.ok || !Array.isArray(result.programs)) return;
    const merged = new Map();
    read(KEY, []).forEach(program => { if (program?.id) merged.set(program.id, program); });
    result.programs.forEach(program => { if (program?.id) merged.set(program.id, { ...merged.get(program.id), ...program }); });
    const programs = [...merged.values()];
    write(KEY, programs);
    const layer = document.getElementById('icons');
    if (!layer) return;
    layer.querySelectorAll('[data-installer-program]').forEach(node => node.remove());
    programs.forEach(addShortcut);
  }

  function init() {
    addInstallerIcon();
    read(KEY, []).forEach(addShortcut);
    setTimeout(addInstallerIcon, 700);
    window.addEventListener('idk-account-restored', syncCloudPrograms);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.IDKInstaller = { open: openInstaller, remove: removeProgram, repair: repairProgram, refresh: syncCloudPrograms };
})();

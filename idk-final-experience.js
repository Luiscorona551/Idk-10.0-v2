(() => {
  'use strict';

  const read = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message) => window.OS?.notify?.(title, message);

  function fuseFriends() {
    const normalize = () => {
      const messenger = document.querySelector('.idk-live-messenger');
      if (!messenger) return;
      const sidebar = messenger.querySelector('.idk-live-members');
      if (!sidebar) return;
      const heading = sidebar.querySelector(':scope > strong');
      const friendButton = messenger.querySelector('.idk-friends-button');
      if (friendButton && friendButton.parentElement !== sidebar) heading?.after(friendButton);
      const memberSearches = [...sidebar.querySelectorAll('input.idk-dm-search')];
      memberSearches.slice(1).forEach(input => input.remove());
      const panel = messenger.querySelector('.idk-friends-panel');
      if (panel && panel.parentElement !== sidebar) sidebar.append(panel);
    };
    new MutationObserver(normalize).observe(document.body, { childList: true, subtree: true });
    normalize();
  }

  function enhanceFiles() {
    const home = document.querySelector('.idk-file-home');
    const legacy = !home && document.querySelector('.files-app');
    if (!home && !legacy) return;
    if (legacy) return upgradeLegacyFiles(legacy);
    if (home.dataset.finalExperience) return;
    home.dataset.finalExperience = 'true';
    const sidebar = home.querySelector('.idk-file-sidebar');
    const shortcutNames = ['Home', 'Gallery', 'Desktop', 'Downloads', 'Documents', 'Pictures', 'Music', 'Videos', 'This PC', 'Network'];
    shortcutNames.forEach(name => {
      let button = [...(sidebar?.querySelectorAll(':scope > button') || [])].find(item => item.textContent.trim() === name);
      if (!button && sidebar) { button = document.createElement('button'); button.type = 'button'; button.textContent = name; sidebar.insertBefore(button, sidebar.querySelector('.idk-dropzone')); }
      button?.classList.add(`idk-shortcut-${name.toLowerCase().replace(/\s+/g, '-')}`);
      button?.addEventListener('click', () => notify('Files', `${name} is a local IDK location.`));
    });
    const drop = home.querySelector('#idk-dropzone');
    if (!drop) return;
    let list = drop.querySelector('.idk-dropzone-list');
    if (!list) { list = document.createElement('div'); list.className = 'idk-dropzone-list'; drop.append(list); }
    const renderDropzone = () => {
      list.replaceChildren();
      const stash = read('idkDropzone', []);
      if (!stash.length) { list.append(Object.assign(document.createElement('small'), { textContent: 'Nothing stashed yet.' })); return; }
      stash.slice(-5).reverse().forEach(item => list.append(Object.assign(document.createElement('span'), { className: 'idk-dropzone-file', textContent: item.name }))); 
    };
    renderDropzone();
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('active'); }, true);
    drop.addEventListener('dragleave', () => drop.classList.remove('active'), true);
    drop.addEventListener('drop', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      drop.classList.remove('active');
      const files = [...(event.dataTransfer?.files || [])];
      if (!files.length) return;
      Promise.resolve(window.SYSTEM_APPS?.importFiles?.(files)).then(entries => {
        const stored = read('idkDropzone', []);
        const next = files.map(file => {
          const entry = (entries || []).find(item => item.name === file.name && item.size === file.size);
          return { id: entry?.id || `${file.name}-${Date.now()}`, name: file.name, size: file.size, type: file.type, at: Date.now() };
        });
        write('idkDropzone', [...stored, ...next].slice(-12));
        renderDropzone();
        notify('Dropzone', `${files.length} file${files.length === 1 ? '' : 's'} stashed temporarily.`);
      }).catch(error => notify('Dropzone', error.message || 'Files could not be stashed.'));
    }, true);
    drop.querySelector('[data-file-action="clear-drop"]')?.addEventListener('click', () => { write('idkDropzone', []); renderDropzone(); notify('Dropzone', 'Temporary stash cleared.'); }, true);
  }

  function upgradeLegacyFiles(root) {
    if (root.dataset.finalExperience) return;
    root.dataset.finalExperience = 'true';
    const toolbar = root.querySelector('.system-toolbar');
    const body = root.querySelector('.file-list');
    if (!toolbar || !body) return;
    const drop = document.createElement('section');
    drop.className = 'idk-legacy-dropzone';
    drop.innerHTML = '<div><strong>Dropzone</strong><small>Drop files here to import and keep a temporary stash.</small></div><button type="button" data-file-action="clear-drop">Clear stash</button><div class="idk-dropzone-list"></div>';
    const list = drop.querySelector('.idk-dropzone-list');
    const render = () => {
      list.replaceChildren();
      const stash = read('idkDropzone', []);
      if (!stash.length) { list.append(Object.assign(document.createElement('small'), { textContent: 'Nothing stashed yet.' })); return; }
      stash.slice(-5).reverse().forEach(item => list.append(Object.assign(document.createElement('span'), { className: 'idk-dropzone-file', textContent: item.name })));
    };
    render();
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('active'); }, true);
    drop.addEventListener('dragleave', () => drop.classList.remove('active'), true);
    drop.addEventListener('drop', event => {
      event.preventDefault(); event.stopImmediatePropagation(); drop.classList.remove('active');
      const files = [...(event.dataTransfer?.files || [])];
      if (!files.length) return;
      Promise.resolve(window.SYSTEM_APPS?.importFiles?.(files)).then(() => {
        const stash = read('idkDropzone', []);
        write('idkDropzone', [...stash, ...files.map(file => ({ name: file.name, size: file.size, type: file.type, at: Date.now() }))].slice(-12));
        render(); notify('Dropzone', `${files.length} file${files.length === 1 ? '' : 's'} imported and stashed.`);
      }).catch(error => notify('Dropzone', error.message || 'Import failed.'));
    }, true);
    drop.querySelector('[data-file-action="clear-drop"]').onclick = () => { write('idkDropzone', []); render(); notify('Dropzone', 'Temporary stash cleared.'); };
    toolbar.after(drop);
  }

  const jokes = [
    'Why did the file go to therapy? It had too many unresolved issues.',
    'I told Echo a bug joke. It said the punchline needed a patch.',
    'Why was the desktop calm? It had finally found some window management.'
  ];
  function organizeFiles() {
    const files = read('idkFileSystem', []);
    if (!Array.isArray(files)) return 'Your local file list is unavailable.';
    const names = ['Desktop', 'Downloads', 'Documents', 'Pictures', 'Music', 'Videos'];
    const folders = {};
    names.forEach(name => {
      let folder = files.find(item => item.type === 'folder' && item.name.toLowerCase() === name.toLowerCase());
      if (!folder) { folder = { id: `system-${name.toLowerCase()}`, name, type: 'folder', parent: '', updated: Date.now(), system: true }; files.push(folder); }
      folders[name] = folder.id;
    });
    let moved = 0;
    files.filter(item => item.type === 'file' && !item.parent).forEach(item => {
      const extension = item.name.split('.').pop().toLowerCase();
      const target = /^(png|jpe?g|gif|webp|svg)$/.test(extension) ? 'Pictures' : /^(mp3|wav|ogg|m4a|flac)$/.test(extension) ? 'Music' : /^(mp4|webm|mov|mkv)$/.test(extension) ? 'Videos' : /^(zip|7z|rar|exe|dmg)$/.test(extension) ? 'Downloads' : 'Documents';
      item.parent = folders[target]; item.updated = Date.now(); moved += 1;
    });
    write('idkFileSystem', files);
    return moved ? `Organized ${moved} local file${moved === 1 ? '' : 's'} into primary folders.` : 'Your local files are already organized.';
  }

  function toggleEcho() {
    const existing = document.getElementById('idk-echo-popout');
    if (existing) { existing.remove(); return; }
    const root = document.createElement('aside');
    root.id = 'idk-echo-popout';
    root.innerHTML = `<div class="idk-echo-head"><img src="official-flag.jpg" alt="IDK Echo"><div><strong>IDK Echo</strong><small>Local agent · works offline</small></div><button class="idk-echo-close" type="button" aria-label="Close Echo">×</button></div><p class="idk-echo-message">Hi. I can organize local Files or tell a joke.</p><div class="idk-echo-actions"><button type="button" data-echo="organize">Organize Files</button><button type="button" data-echo="joke">Tell me a joke</button><button type="button" data-echo="ai">Open full agent</button></div><form class="idk-echo-form"><input type="text" placeholder="Try: joke or organize" aria-label="Ask IDK Echo"><button type="submit">Send</button></form>`;
    const message = root.querySelector('.idk-echo-message');
    const respond = action => {
      if (action === 'joke') message.textContent = jokes[Math.floor(Math.random() * jokes.length)];
      else if (action === 'organize') message.textContent = organizeFiles();
      else if (action === 'ai') window.OS?.open?.('ai');
    };
    root.querySelector('.idk-echo-close').onclick = () => root.remove();
    root.querySelectorAll('[data-echo]').forEach(button => button.onclick = () => respond(button.dataset.echo));
    root.querySelector('form').onsubmit = event => { event.preventDefault(); const value = root.querySelector('input').value.trim().toLowerCase(); root.querySelector('input').value = ''; if (value.includes('joke')) respond('joke'); else if (value.includes('organ')) respond('organize'); else if (value.includes('open') || value.includes('agent')) respond('ai'); else message.textContent = 'Try “joke”, “organize files”, or “open agent”.'; };
    document.body.append(root);
  }

  const MAIL_KEY = 'idkMailMessages';
  function mailApp() {
    const root = document.createElement('div');
    root.id = 'idk-mail-app';
    let folder = 'inbox';
    let selected = null;
    const data = () => { const value = read(MAIL_KEY, []); return Array.isArray(value) ? value : []; };
    root.innerHTML = `<header class="idk-mail-top"><strong>Mail</strong><small>Simple email workspace</small></header><nav class="idk-mail-tabs"><button type="button" data-folder="inbox" class="active">Inbox</button><button type="button" data-folder="sent">Sent</button><button type="button" data-compose>Compose</button></nav><div class="idk-mail-body"><aside class="idk-mail-list"></aside><main class="idk-mail-content"></main></div>`;
    const list = root.querySelector('.idk-mail-list');
    const content = root.querySelector('.idk-mail-content');
    const renderList = () => {
      list.replaceChildren();
      const messages = data().filter(item => item.folder === folder);
      if (!messages.length) { list.append(Object.assign(document.createElement('p'), { className: 'idk-mail-status', textContent: folder === 'inbox' ? 'No messages yet.' : 'Nothing sent yet.' })); return; }
      messages.forEach(item => { const button = document.createElement('button'); button.className = `idk-mail-item${selected === item.id ? ' active' : ''}`; button.type = 'button'; button.innerHTML = `<strong>${esc(folder === 'sent' ? item.to : item.from || 'IDK')}</strong><small>${esc(item.subject || '(no subject)')}</small>`; button.onclick = () => { selected = item.id; renderList(); renderMessage(item); }; list.append(button); });
    };
    const renderMessage = item => { content.innerHTML = `<article class="idk-mail-message"><h3>${esc(item.subject || '(no subject)')}</h3><small>${esc(item.from || 'You')} → ${esc(item.to || 'You')} · ${new Date(item.at).toLocaleString()}</small><p>${esc(item.body)}</p></article>`; };
    const renderCompose = () => { selected = null; content.innerHTML = `<form class="idk-mail-compose"><label>To<input type="email" required placeholder="name@example.com"></label><label>Subject<input required placeholder="Subject"></label><label>Message<textarea required placeholder="Write your message..."></textarea></label><div class="idk-mail-actions"><button class="btn" type="submit">Send</button><span class="idk-mail-status" data-status></span></div><p class="idk-mail-status">Messages are saved in Sent on this desktop. Use the delivery link after sending to open your email provider.</p></form>`; content.querySelector('form').onsubmit = event => { event.preventDefault(); const inputs = content.querySelectorAll('input,textarea'); const message = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, folder: 'sent', to: inputs[0].value.trim(), subject: inputs[1].value.trim(), body: inputs[2].value.trim(), at: Date.now() }; const messages = data(); messages.unshift(message); write(MAIL_KEY, messages); const status = content.querySelector('[data-status]'); status.textContent = 'Saved to Sent.'; const delivery = document.createElement('a'); delivery.className = 'btn tab'; delivery.href = `mailto:${encodeURIComponent(message.to)}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`; delivery.textContent = 'Open in email provider'; content.querySelector('.idk-mail-actions').append(delivery); renderList(); notify('Mail', `Message saved for ${message.to}.`); }; };
    const render = () => { renderList(); if (selected) renderMessage(data().find(item => item.id === selected)); else renderCompose(); };
    root.querySelectorAll('[data-folder]').forEach(button => button.onclick = () => { folder = button.dataset.folder; root.querySelectorAll('[data-folder]').forEach(item => item.classList.toggle('active', item === button)); render(); });
    root.querySelector('[data-compose]').onclick = () => { folder = 'sent'; root.querySelectorAll('[data-folder]').forEach(item => item.classList.remove('active')); renderCompose(); };
    render();
    return root;
  }

  function installMail() {
    if (typeof APPS === 'undefined') return;
    APPS.mail = { title: 'Mail', glyph: '✉', desktop: false, dock: false, width: 860, height: 600, render: mailApp };
    const icons = document.getElementById('icons');
    if (icons && !icons.querySelector('[data-final-app="mail"]')) {
      const icon = document.createElement('button');
      icon.type = 'button'; icon.className = 'idk-final-desktop-icon'; icon.dataset.finalApp = 'mail';
      icon.innerHTML = '<span>✉</span><label>Mail</label>';
      icon.onclick = () => window.OS?.open?.('mail');
      icons.append(icon);
    }
  }

  function fuseChatApp() {
    if (typeof APPS === 'undefined' || !APPS.chat) return;
    APPS.chat.desktop = false;
    APPS.chat.action = () => window.IdkMessenger?.open?.();
    document.querySelectorAll('.desktop-icon[data-app="chat"], .dock-btn[data-app="chat"]').forEach(icon => icon.remove());
    document.querySelectorAll('#windows .window[data-app="chat"]').forEach(win => win.querySelector('.close')?.click());
  }

  function openPublisher() {
    document.getElementById('idk-public-publisher')?.remove();
    const root = document.createElement('section');
    root.id = 'idk-public-publisher';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = '<div class="idk-publish-card"><header class="idk-publish-head"><strong>Publish to IDK App Store</strong><button type="button" data-close aria-label="Close">×</button></header><form class="idk-publish-form"><p class="idk-publish-note">Share a self-contained HTML app or game with friends. Published programs run in a sandboxed tab and receive a content fingerprint.</p><label>Name<input name="name" required maxlength="100" placeholder="My IDK game"></label><label>Category<select name="category"><option>Games</option><option>Productivity</option><option>Creative</option><option>Other</option></select></label><label>Version<input name="version" maxlength="24" value="1.0.0"></label><label>Icon<input name="icon" maxlength="8" value="🧩" aria-label="Program icon"></label><label>Author<input name="author" maxlength="64"></label><label>Description<textarea name="description" maxlength="500" placeholder="What does this app do?"></textarea></label><label>Screenshot URL<input name="screenshot" type="url" maxlength="500" placeholder="https://…"></label><label>Manifest JSON<textarea name="manifest" spellcheck="false" placeholder="{\"id\":\"com.example.app\",\"permissions\":{}}"></textarea></label><label>HTML source<textarea name="content" required spellcheck="false" placeholder="<!doctype html>..."></textarea></label><div class="idk-publish-actions"><button class="btn" type="submit">Publish</button><button class="btn tab" type="button" data-refresh>Refresh public catalog</button></div><p class="idk-publish-status" data-status></p><div class="idk-publish-catalog" data-catalog></div></form></div>';
    const form = root.querySelector('form');
    form.author.value = window.IDKAccount?.user?.username || 'IDK creator';
    const status = root.querySelector('[data-status]');
    const catalog = root.querySelector('[data-catalog]');
    const renderCatalog = programs => {
      catalog.replaceChildren();
      if (!programs.length) { catalog.append(Object.assign(document.createElement('p'), { className: 'idk-publish-note', textContent: 'No public programs yet.' })); return; }
      programs.forEach(program => {
        const card = document.createElement('article');
        card.className = 'idk-publish-item';
        card.innerHTML = `${program.screenshot ? `<img src="${esc(program.screenshot)}" alt="" loading="lazy">` : ''}<strong>${esc(program.icon)} ${esc(program.name)}${program.verified ? ' · Verified' : ''}</strong><small>${esc(program.category)} · v${esc(program.version)} · by ${esc(program.author)}</small><small>${esc(program.description || 'Self-contained HTML app')}</small><small>${program.ratingCount ? `${program.rating.toFixed(1)} / 5 · ${program.ratingCount} rating${program.ratingCount === 1 ? '' : 's'}` : 'No ratings yet'}${program.contentHash ? ` · ${esc(program.contentHash.slice(0, 12))}…` : ''}</small>`;
        const open = document.createElement('a');
        open.className = 'btn tab'; open.target = '_blank'; open.rel = 'noopener'; open.href = program.contentUrl; open.textContent = 'Open';
        const install = document.createElement('button');
        install.type = 'button'; install.className = 'btn tab'; install.textContent = 'Install';
        install.onclick = async () => { install.disabled = true; try { const html = await fetch(program.contentUrl).then(response => { if (!response.ok) throw new Error('Program unavailable.'); return response.text(); }); const programs = read('idkInstalledPrograms', []); write('idkInstalledPrograms', [{ id: program.id, name: program.name, icon: program.icon, version: program.version, description: program.description, manifest: program.manifest, contentHash: program.contentHash, verified: program.verified, fileName: `${program.name}.html`, html, installedAt: Date.now(), source: 'public-store' }, ...programs.filter(item => item.id !== program.id)]); notify('App Store', `${program.name} installed locally.`); install.textContent = 'Installed'; } catch (error) { notify('App Store', error.message); install.disabled = false; } };
        const rate = document.createElement('button');
        rate.type = 'button'; rate.className = 'btn tab'; rate.textContent = 'Rate';
        rate.onclick = async () => { const value = Number(window.prompt('Rate this program from 1 to 5', '5')); if (!Number.isInteger(value) || value < 1 || value > 5) return; const response = await fetch(`/api/store/programs/${encodeURIComponent(program.id)}/rating`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating: value }) }).catch(() => null); if (!response?.ok) return notify('App Store', 'The rating service is unavailable.'); notify('App Store', 'Rating submitted.'); refresh(); };
        const report = document.createElement('button');
        report.type = 'button'; report.className = 'btn tab'; report.textContent = 'Report';
        report.onclick = async () => { const reason = window.prompt('Why are you reporting this program?', 'Unsafe or inappropriate content'); if (!reason) return; const response = await fetch(`/api/store/programs/${encodeURIComponent(program.id)}/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) }).catch(() => null); notify('App Store', response?.ok ? 'Report sent for review.' : 'The report service is unavailable.'); };
        card.append(open, install, rate, report); catalog.append(card);
      });
    };
    const refresh = async () => {
      try {
        const response = await fetch('/api/store/programs', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Catalog unavailable.');
        renderCatalog(Array.isArray(data.programs) ? data.programs : []);
        status.textContent = 'Public catalog loaded.';
      } catch { status.textContent = 'Public catalog is unavailable until the IDK server is online.'; }
    };
    root.querySelector('[data-close]').onclick = () => root.remove();
    root.querySelector('[data-refresh]').onclick = refresh;
    form.onsubmit = async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form));
      if (new Blob([payload.content]).size > 15 * 1024 * 1024) { status.textContent = 'HTML programs must be smaller than 15 MB.'; return; }
      status.textContent = 'Publishing…';
      try {
        const response = await fetch('/api/store/programs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Publish failed.');
        status.replaceChildren(Object.assign(document.createElement('span'), { textContent: 'Published. ' }));
        const link = document.createElement('a'); link.href = data.program.contentUrl; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open public link'; status.append(link);
        form.content.value = ''; refresh();
      } catch (error) { status.textContent = error.message || 'Publish failed.'; }
    };
    document.body.append(root);
    refresh();
  }

  function install() {
    fuseFriends();
    const filesObserver = new MutationObserver(enhanceFiles);
    filesObserver.observe(document.body, { childList: true, subtree: true });
    enhanceFiles();
    const echo = document.getElementById('echo-companion');
    if (echo) { echo.title = 'IDK Echo · Double-click for the local agent'; echo.addEventListener('dblclick', event => { event.preventDefault(); window.IDKEcho?.toggle?.(); }); }
    window.IDKEcho = { toggle: toggleEcho, organizeFiles };
    fuseChatApp();
    installMail();
    window.IDKPublicStore = { open: openPublisher };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

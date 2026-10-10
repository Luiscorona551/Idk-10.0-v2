(() => {
  'use strict';
  if (window.IDKEchoDesktopCommands) return;
  const FILES_KEY = 'idkFileSystem';
  const files = () => {
    try {
      const result = window.IDKFiles?.getFiles?.() || JSON.parse(localStorage.getItem(FILES_KEY) || '[]');
      return Array.isArray(result) ? result : [];
    } catch { return []; }
  };
  const notify = message => window.OS?.notify?.('IDK Echo', message, 'success');
  const folderName = id => files().find(item => item.type === 'folder' && item.id === id)?.name || 'IDK';
  const categorize = name => {
    const ext = (String(name).match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
    if (/^(png|jpe?g|gif|webp|svg|bmp|heic|avif)$/.test(ext)) return 'Pictures';
    if (/^(mp3|wav|ogg|m4a|flac|aac)$/.test(ext)) return 'Music';
    if (/^(mp4|mov|webm|mkv|avi)$/.test(ext)) return 'Videos';
    if (/^(pdf|docx?|txt|md|rtf|odt|csv|xlsx?|pptx?|json|html?|css|js|ts)$/.test(ext)) return 'Documents';
    if (/^(zip|rar|7z|tar|gz|exe|msi|dmg|iso|apk)$/.test(ext)) return 'Downloads';
    return '';
  };
  const button = document.getElementById('echo-companion');
  if (!button) return;
  let panel, log, prompt, status, subtitle;
  const add = (who, message) => {
    const row = document.createElement('article');
    row.className = 'idk-echo-command-message ' + who;
    const label = document.createElement('strong');
    label.textContent = who === 'user' ? 'You' : 'IDK Echo';
    const body = document.createElement('p');
    body.textContent = message;
    row.append(label, body);
    log.append(row);
    log.scrollTop = log.scrollHeight;
  };
  const refreshAwareness = () => {
    const all = files();
    const count = all.filter(item => item.type === 'file').length;
    if (subtitle) subtitle.textContent = count + ' saved file' + (count === 1 ? '' : 's') + ' · Ready to help';
    button.title = 'IDK Echo — ' + count + ' saved files detected';
  };
  const listFiles = query => {
    const found = files().filter(item => item.type === 'file' && (!query || item.name.toLowerCase().includes(query.toLowerCase())));
    if (!found.length) return query ? 'I couldn’t find a saved file matching “' + query + '”.' : 'You don’t have any saved files yet.';
    return 'Here’s what I can see in your IDK Files' + (query ? ' matching “' + query + '”' : '') + ':\n' +
      found.slice(0, 25).map(item => '• ' + item.name + ' — ' + folderName(item.parent)).join('\n') +
      (found.length > 25 ? '\n…and ' + (found.length - 25) + ' more.' : '');
  };
  const organizeFiles = () => {
    const all = files();
    const rootFolders = Object.fromEntries(['Documents', 'Pictures', 'Music', 'Videos', 'Downloads'].map(name => [
      name.toLowerCase(), all.find(item => item.type === 'folder' && item.parent === '' && item.name.toLowerCase() === name.toLowerCase())
    ]));
    const moving = all.filter(item => item.type === 'file' && !item.parent && categorize(item.name) && rootFolders[categorize(item.name).toLowerCase()]);
    if (!moving.length) return 'I didn’t find any root-level files that match my built-in categories. Your files haven’t been changed.';
    if (!window.confirm('Move ' + moving.length + ' file(s) into matching folders such as Documents, Pictures, Music, Videos, and Downloads? Nothing will be deleted.')) return 'No changes made — file organization was cancelled.';
    moving.forEach(item => { item.parent = rootFolders[categorize(item.name).toLowerCase()].id; item.updated = Date.now(); });
    try { localStorage.setItem(FILES_KEY, JSON.stringify(all)); }
    catch { return 'I couldn’t save the organization changes. Your files should remain as they were.'; }
    window.dispatchEvent(new CustomEvent('idk-data-changed', { detail: { type: 'files', command: 'echo-organize' } }));
    refreshAwareness();
    notify('Organized ' + moving.length + ' file(s). Nothing was deleted.');
    return 'Done! I moved ' + moving.length + ' file(s) into matching folders. I didn’t delete anything.';
  };
  const organizeDesktop = () => {
    const layer = document.getElementById('icons');
    if (!layer) return 'I couldn’t find the desktop icon area.';
    [...layer.querySelectorAll('.desktop-icon')].sort((a, b) =>
      (a.querySelector('.label')?.textContent || '').localeCompare(b.querySelector('.label')?.textContent || '', undefined, { sensitivity: 'base' })
    ).forEach(icon => layer.append(icon));
    notify('Desktop icons organized alphabetically.');
    return 'Done — I sorted your desktop icons alphabetically.';
  };
  const runCommand = raw => {
    const text = String(raw || '').trim();
    const lower = text.toLowerCase();
    if (/^(help|commands|what can you do)\??$/.test(lower)) return 'Try: “organize my files”, “show my files”, “find screenshots”, “organize my desktop”, “open Files”, “tell me a joke”, or “give me a fun fact”. I can inspect IDK file names and folders without opening the Web Agent.';
    if (/\b(joke|make me laugh|something funny)\b/.test(lower)) return 'Why did the computer get cold? It left its Windows open. 😄';
    if (/\b(fun fact|interesting fact)\b/.test(lower)) return 'Fun fact: the first computer mouse was made of wood.';
    if (/\b(organize|sort)\b.*\b(files?|folders?)\b/.test(lower)) return organizeFiles();
    if (/\b(organize|sort)\b.*\bdesktop\b/.test(lower)) return organizeDesktop();
    if (/\b(find|search for|look for)\b/.test(lower)) {
      const query = text.replace(/^.*?\b(?:find|search for|look for)\b/i, '').replace(/^\s*(my\s+)?(files?\s+)?/i, '').trim();
      return listFiles(query);
    }
    if (/\b(show|list|what)\b.*\b(files?|documents?)\b/.test(lower) || /\bwhat files do i have\b/.test(lower)) return listFiles('');
    const openMatch = lower.match(/\b(?:open|launch|start)\s+(.+)$/);
    if (openMatch) {
      const requested = openMatch[1].trim();
      const aliases = { 'file manager': 'files', 'my files': 'files', files: 'files', file: 'files', settings: 'settings', browser: 'proxy', terminal: 'terminal', notes: 'notes', calendar: 'calendar', games: 'games', paint: 'paint', 'ai app': 'ai' };
      const app = aliases[requested] || requested;
      if (window.OS?.open) { window.OS.open(app); return 'Opening ' + requested + '.'; }
      return 'The app launcher isn’t available right now.';
    }
    if (/\bhow many files\b/.test(lower)) return 'I can see ' + files().filter(item => item.type === 'file').length + ' saved file(s) in your IDK file list.';
    return 'I can handle desktop and file commands right here. Try “help” to see commands, or ask me to organize files, find a file, open an app, tell a joke, or share a fun fact.';
  };
  const openPanel = () => {
    if (panel) { panel.hidden = false; prompt?.focus(); refreshAwareness(); return; }
    panel = document.createElement('section');
    panel.className = 'idk-echo-command-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'IDK Echo desktop assistant');
    panel.innerHTML = '<header class="idk-echo-command-head"><div><strong>IDK Echo</strong><span data-echo-subtitle></span></div><button type="button" data-echo-close aria-label="Close IDK Echo">×</button></header><div class="idk-echo-command-chips"><button type="button" data-echo-command="organize my files">Organize files</button><button type="button" data-echo-command="show my files">Show files</button><button type="button" data-echo-command="tell me a joke">Tell a joke</button><button type="button" data-echo-command="help">Commands</button></div><div class="idk-echo-command-log" role="log" aria-live="polite"></div><form class="idk-echo-command-form"><input type="text" name="command" placeholder="Ask Echo to do something…" autocomplete="off" aria-label="Ask IDK Echo"><button type="submit">Send</button></form><footer>Local desktop commands · No Web Agent needed</footer>';
    const style = document.createElement('style');
    style.textContent = '.idk-echo-command-panel{position:fixed;z-index:100000;right:18px;bottom:88px;width:min(390px,calc(100vw - 24px));height:min(570px,calc(100vh - 120px));display:flex;flex-direction:column;color:var(--text,#eef3ff);background:rgba(16,24,45,.96);border:1px solid rgba(255,255,255,.2);border-radius:18px;box-shadow:0 22px 80px rgba(0,0,0,.48);backdrop-filter:blur(24px);overflow:hidden;font:14px/1.4 system-ui,sans-serif}.idk-echo-command-panel[hidden]{display:none}.idk-echo-command-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.12)}.idk-echo-command-head strong,.idk-echo-command-head span{display:block}.idk-echo-command-head strong{font-size:16px}.idk-echo-command-head span,.idk-echo-command-panel footer{font-size:11px;opacity:.72}.idk-echo-command-panel button{font:inherit;cursor:pointer;color:inherit;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.15);border-radius:9px;padding:7px 10px}.idk-echo-command-chips{display:flex;flex-wrap:wrap;gap:6px;padding:10px}.idk-echo-command-log{flex:1;overflow:auto;padding:10px 14px}.idk-echo-command-message{margin:0 0 12px;max-width:96%}.idk-echo-command-message strong{display:block;font-size:11px;opacity:.72}.idk-echo-command-message p{white-space:pre-wrap;margin:3px 0 0;overflow-wrap:anywhere}.idk-echo-command-message.user{margin-left:auto;text-align:right}.idk-echo-command-message.user p{display:inline-block;text-align:left;background:rgba(86,132,240,.25);padding:8px 10px;border-radius:12px}.idk-echo-command-form{display:flex;gap:7px;padding:10px;border-top:1px solid rgba(255,255,255,.12)}.idk-echo-command-form input{min-width:0;flex:1;border-radius:10px;border:1px solid rgba(255,255,255,.2);padding:10px;background:rgba(255,255,255,.08);color:inherit;font:inherit}.idk-echo-command-panel footer{text-align:center;padding:0 8px 10px}.idk-echo-command-form button{background:var(--accent,#557fe7)}@media(max-width:480px){.idk-echo-command-panel{right:8px;bottom:72px;width:calc(100vw - 16px);height:min(560px,calc(100vh - 90px))}}';
    document.head.append(style);
    subtitle = panel.querySelector('[data-echo-subtitle]');
    log = panel.querySelector('.idk-echo-command-log');
    prompt = panel.querySelector('input[name="command"]');
    panel.querySelector('[data-echo-close]').onclick = () => { panel.hidden = true; };
    panel.querySelectorAll('[data-echo-command]').forEach(chip => chip.onclick = () => submitCommand(chip.dataset.echoCommand));
    panel.querySelector('form').onsubmit = event => { event.preventDefault(); submitCommand(prompt.value); };
    document.getElementById('desktop')?.append(panel);
    refreshAwareness();
    add('assistant', 'Hi! I can help with your desktop and your saved IDK files. You don’t need to open the Web Agent. Type “help” to see what I can do.');
  };
  function submitCommand(text) {
    const value = String(text || '').trim();
    if (!value) return;
    add('user', value);
    prompt.value = '';
    statusText('Working…');
    try { add('assistant', runCommand(value)); }
    catch (error) { add('assistant', 'I couldn’t complete that: ' + (error?.message || 'unknown error')); }
    statusText('Ready');
    prompt.focus();
  }
  function statusText(value) { if (subtitle) subtitle.textContent = (files().filter(item => item.type === 'file').length) + ' saved files · ' + value; }
  document.addEventListener('click', event => {
    if (!event.target.closest('#echo-companion')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPanel();
  }, true);
  document.addEventListener('idk-data-changed', event => {
    if (event.detail?.type === 'files') refreshAwareness();
  });
  window.IDKEchoDesktopCommands = { open: openPanel, run: runCommand, listFiles };
  refreshAwareness();
})();
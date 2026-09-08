(() => {
  'use strict';
  if (window.IDKRoadmapSuite) return;
  const cards = [
    ['account', '22', 'Account Security', 'Passkeys, trusted devices, recovery, and password hygiene.', 'accounts'],
    ['social', '23', 'Social and Calls', 'Friends, presence, messages, and private calls.', 'chat'],
    ['planner', '24', 'Planner 2.0', 'Today, reminders, recurring work, and calendar views.', 'planner'],
    ['files', '25', 'Files and Vault', 'Search, recovery, encrypted Vault portability, and storage health.', 'files'],
    ['sync', '26', 'Sync and Offline', 'Queues, conflicts, retry controls, and recovery.', 'syncCenter'],
    ['ai', '27', 'AI Workspace', 'Cloud, local, and offline privacy choices.', 'aiModes'],
    ['apps', '28', 'App Ecosystem', 'Permissions, trust, updates, and install cleanup.', 'apps'],
    ['access', '29', 'Mobile and Accessibility', 'Touch, keyboard access, contrast, motion, and text size.', 'settings'],
    ['release', '30', 'Release Quality', 'Health, diagnostics, deployment, and self-tests.', 'reliability']
  ];
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const open = id => window.OS?.open?.(id);
  const button = (label, action, className = 'btn tab') => { const item = document.createElement('button'); item.type = 'button'; item.className = className; item.textContent = label; item.onclick = action; return item; };
  const status = text => Object.assign(document.createElement('p'), { className: 'idk-roadmap-status', textContent: text });
  const section = (title, copy) => { const item = document.createElement('section'); item.className = 'idk-roadmap-section'; item.innerHTML = '<h3>' + esc(title) + '</h3><p>' + esc(copy) + '</p>'; return item; };
  const stat = (label, value) => { const item = document.createElement('article'); item.className = 'idk-roadmap-stat'; item.innerHTML = '<strong>' + esc(value) + '</strong><small>' + esc(label) + '</small>'; return item; };
  function pane(root, id) {
    root.replaceChildren();
    if (id === 'all') {
      const item = section('All roadmap batches', 'One surface for the planned release train. Each card opens the existing working feature.');
      const grid = document.createElement('div'); grid.className = 'idk-roadmap-grid';
      cards.forEach(card => { const cardRoot = document.createElement('article'); cardRoot.className = 'idk-roadmap-card'; cardRoot.innerHTML = '<span>BATCH ' + card[1] + '</span><h3>' + esc(card[2]) + '</h3><p>' + esc(card[3]) + '</p>'; cardRoot.append(button('Open', () => open(card[4]))); grid.append(cardRoot); }); item.append(grid); root.append(item); return;
    }
    const card = cards.find(item => item[0] === id); const item = section(card[2], card[3]);
    if (id === 'account') { const grid = document.createElement('div'); grid.className = 'idk-roadmap-stats'; grid.append(stat('Account API', 'Ready'), stat('Passkey browser API', window.PublicKeyCredential ? 'Available' : 'Unavailable'), stat('Recovery', 'Protected')); item.append(grid, button('Accounts and devices', () => open('accounts')), button('Security Center', () => window.IDKBatchNineteen?.open?.())); }
    else if (id === 'social') item.append(button('Friends', () => window.IdkFriends?.open?.() || open('contacts')), button('Messenger', () => window.IdkMessenger?.open?.() || open('chat')), button('Calls', () => window.IdkCalls?.open?.() || open('calls')), button('Call diagnostics', () => open('callDiagnostics')));
    else if (id === 'planner') item.append(button('Open Planner', () => open('planner')), button('Open Today', () => open('today')), button('Open Calendar', () => open('calendar')));
    else if (id === 'files') item.append(button('Open Files', () => open('files')), button('Open Vault', () => open('vault')), button('Backup and Recovery', () => open('recoveryCenter')), button('Security Center', () => window.IDKBatchNineteen?.open?.()));
    else if (id === 'sync') { const line = status('Checking local sync queues...'); item.append(button('Sync now', async () => { await window.IDKOffline?.flush?.(); await window.IDKDataLayer?.syncNow?.(); line.textContent = 'Sync retry completed.'; }), button('Sync Center', () => open('syncCenter')), button('Review conflicts', () => window.IDKPlatformNext?.openSyncConflicts?.() || open('syncCenter')), line); }
    else if (id === 'ai') { const select = document.createElement('select'); select.className = 'field'; ['cloud', 'local', 'offline'].forEach(value => select.append(new Option(value + ' AI', value))); select.value = window.IDKAIControls?.getMode?.() || 'cloud'; select.onchange = () => { window.IDKAIControls?.setMode?.(select.value); write('idkAIMode', select.value); }; item.append(select, button('Open selected mode', () => window.IDKAIControls?.openSelected?.() || open('aiModes')), button('Privacy Center', () => open('privacy'))); }
    else if (id === 'apps') item.append(button('App Store', () => window.IDKProductFeatures?.appCenter?.() || open('apps')), button('App Permissions', () => open('permissions')), button('System Updates', () => window.IDKProductFeatures?.updateCenter?.()), button('Reliability Center', () => open('reliability')));
    else if (id === 'access') { const controls = document.createElement('div'); controls.className = 'idk-roadmap-checks'; [['idkRoadmapHighContrast', 'High contrast'], ['idkRoadmapReduceMotion', 'Reduce motion'], ['idkRoadmapLargeText', 'Large text']].forEach(([key, label]) => { const row = document.createElement('label'); row.innerHTML = '<span>' + label + '</span><input type="checkbox" ' + (read(key, false) ? 'checked' : '') + '>'; row.querySelector('input').onchange = event => { write(key, event.target.checked); document.body.classList.toggle(key.replace('idkRoadmap', 'idk-').replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()), event.target.checked); }; controls.append(row); }); item.append(controls, button('Settings', () => open('settings')), button('Desktop Center', () => open('desktopCenter'))); }
    else { const checks = document.createElement('div'); checks.className = 'idk-roadmap-checks'; [['Deployment', '/api/deploy/status'], ['Health', '/api/health'], ['AI service', '/api/ai/status'], ['Call config', '/api/call/config']].forEach(([label, url]) => { const row = document.createElement('div'); row.className = 'idk-roadmap-check'; row.innerHTML = '<strong>' + label + '</strong><span>Checking...</span>'; fetch(url, { cache: 'no-store' }).then(response => response.json()).then(data => { row.querySelector('span').textContent = data.ok === false ? 'Needs attention' : 'Ready'; row.classList.toggle('pass', data.ok !== false); }).catch(() => { row.querySelector('span').textContent = 'Unavailable'; row.classList.add('warn'); }); checks.append(row); }); item.append(checks, button('Reliability Center', () => open('reliability')), button('System Self-Test', () => open('selftest')), button('Call diagnostics', () => open('callDiagnostics'))); }
    root.append(item);
  }
  function hub() { const root = document.createElement('div'); root.className = 'app idk-roadmap-hub'; root.innerHTML = '<header class="idk-roadmap-header"><div><span class="idk-roadmap-kicker">IDK RELEASE TRAIN · BATCHES 22-30</span><h2>Roadmap Hub</h2><p>Planned updates connected to the features already shipped.</p></div><button class="btn tab" data-refresh>Refresh</button></header><nav class="idk-roadmap-tabs" role="tablist"></nav><main data-pane></main>'; const nav = root.querySelector('nav'), main = root.querySelector('[data-pane]'); ['all'].concat(cards.map(card => card[0])).forEach(id => { const item = document.createElement('button'); item.type = 'button'; item.textContent = id === 'all' ? 'All batches' : cards.find(card => card[0] === id)[2]; item.onclick = () => { nav.querySelectorAll('button').forEach(buttonItem => buttonItem.classList.toggle('active', buttonItem === item)); pane(main, id); }; if (id === 'all') item.classList.add('active'); nav.append(item); }); root.querySelector('[data-refresh]').onclick = () => pane(main, nav.querySelector('.active')?.textContent === 'All batches' ? 'all' : nav.querySelector('.active')?.textContent.toLowerCase()); pane(main, 'all'); return root; }
  function install() { if (typeof APPS !== 'undefined') APPS.roadmapHub ||= { title: 'Roadmap Hub', glyph: '◆', category: 'System', desktop: false, dock: false, width: 980, height: 700, render: hub }; }
  window.IDKRoadmapSuite = { open: () => open('roadmapHub'), hub };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

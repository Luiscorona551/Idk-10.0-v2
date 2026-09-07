(() => {
  'use strict';
  if (window.IDKBatchFourteen) return;

  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const button = (label, action, className = 'btn') => { const node = document.createElement('button'); node.type = 'button'; node.className = className; node.textContent = label; node.onclick = action; return node; };
  const catalog = () => window.IDKDesktopWidgets?.catalog?.() || [
    { id: 'weather', label: 'Weather', icon: '☁' }, { id: 'news', label: 'News', icon: '▤' },
    { id: 'calendar', label: 'Calendar events', icon: '□' }, { id: 'stocks', label: 'Stock prices', icon: '↗' },
    { id: 'sports', label: 'Sports scores', icon: '★' }
  ];
  const closeWindow = root => root.closest('.window')?.querySelector('.close')?.click();

  function widgetLibraryApp() {
    const root = document.createElement('div'); root.className = 'app idk-widget-library';
    root.innerHTML = '<header class="idk-control-head"><div><span class="idk-flow-kicker">IDK DESKTOP</span><h2>Widget Library</h2><p>Choose live information to pin to your desktop. You can drag, resize, refresh, or remove widgets at any time.</p></div><span class="idk-control-badge">LOCAL LAYOUT</span></header><div class="idk-library-grid" data-list></div><div class="idk-flow-actions"><button class="btn" data-open>Open desktop widgets</button><button class="btn tab" data-refresh>Refresh widgets</button></div>';
    const list = root.querySelector('[data-list]');
    const render = () => {
      const active = read('idkDesktopWidgets', []);
      const favoriteWidgets = read('idkFavoriteWidgets', []); list.replaceChildren(...catalog().sort((a, b) => Number(favoriteWidgets.includes(b.id)) - Number(favoriteWidgets.includes(a.id))).map(item => {
        const card = document.createElement('article'); card.className = 'idk-library-card';
        const isActive = active.some(value => value?.type === item.id);
        card.innerHTML = `<span class="idk-library-icon">${esc(item.icon)}</span><div><strong>${esc(item.label)}</strong><small>${isActive ? 'Already on your desktop' : 'Live data · drag or click to place'}</small></div>`;
        card.append(button(isActive ? 'On desktop' : 'Add widget', () => { if (!isActive) { window.IDKDesktopWidgets?.add?.(item.id, 34 + active.length * 18, 92 + active.length * 18); render(); } }, `btn ${isActive ? 'tab' : ''}`));
        return card;
      }));
    };
    root.querySelector('[data-open]').onclick = () => window.IDKDesktopWidgets?.open?.();
    root.querySelector('[data-refresh]').onclick = () => window.IDKDesktopWidgets?.refresh?.();
    render(); return root;
  }

  function personalizationApp() {
    const saved = { region: '', state: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', interests: '', theme: 'midnight', motion: 'on', aiMode: 'cloud', contrast: false, favorites: [], ...read('idkPersonalization', {}) };
    const root = document.createElement('div'); root.className = 'app idk-personalization';
    root.innerHTML = '<header class="idk-control-head"><div><span class="idk-flow-kicker">OPTIONAL SETUP</span><h2>Make IDK yours</h2><p>These choices stay on this device and can be changed later. Skip anything you do not want to answer.</p></div><span class="idk-control-badge">YOU CHOOSE</span></header><div class="idk-personal-grid"><label>Country or region<input class="field" data-region maxlength="64" placeholder="Optional"></label><label>State or province<input class="field" data-state maxlength="64" placeholder="Optional"></label><label>Time zone<select class="field" data-timezone></select></label><label>Interests<input class="field" data-interests maxlength="180" placeholder="news, sports, markets"></label><label>Theme<select class="field" data-theme><option value="midnight">Midnight</option><option value="neon">Neon</option><option value="sunset">Sunset</option><option value="mono">Monochrome</option><option value="ocean">Ocean</option><option value="forest">Forest</option><option value="candy">Candy</option></select></label><label>AI mode<select class="field" data-ai><option value="cloud">Cloud AI</option><option value="local">Local AI</option><option value="offline">Offline AI</option></select></label><label>Motion<select class="field" data-motion><option value="on">Motion on</option><option value="off">Reduce motion</option></select></label><label class="idk-check-row"><input type="checkbox" data-contrast> High contrast</label></div><section class="idk-control-card"><strong>Favorite widgets</strong><p>Favorites appear first in the Widget Library. You can still add any widget later.</p><div class="idk-favorite-grid" data-favorites></div></section><p class="idk-control-status" data-status></p><div class="idk-flow-actions"><button class="btn" data-save>Save choices</button><button class="btn tab" data-skip>Skip for now</button></div>';
    const timezone = root.querySelector('[data-timezone]');
    ['UTC', Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney'].filter((value, index, values) => value && values.indexOf(value) === index).forEach(value => timezone.append(new Option(value, value)));
    root.querySelector('[data-region]').value = saved.region; root.querySelector('[data-state]').value = saved.state; timezone.value = saved.timezone; root.querySelector('[data-interests]').value = Array.isArray(saved.interests) ? saved.interests.join(', ') : saved.interests; root.querySelector('[data-theme]').value = saved.theme; root.querySelector('[data-ai]').value = saved.aiMode; root.querySelector('[data-motion]').value = saved.motion; root.querySelector('[data-contrast]').checked = Boolean(saved.contrast);
    const favorites = root.querySelector('[data-favorites]');
    catalog().forEach(item => { const label = document.createElement('label'); label.innerHTML = `<input type="checkbox" value="${esc(item.id)}" ${saved.favorites.includes(item.id) ? 'checked' : ''}><span>${esc(item.icon)} ${esc(item.label)}</span>`; favorites.append(label); });
    root.querySelector('[data-save]').onclick = () => {
      const next = { region: root.querySelector('[data-region]').value.trim(), state: root.querySelector('[data-state]').value.trim(), timezone: timezone.value, interests: root.querySelector('[data-interests]').value.split(',').map(value => value.trim()).filter(Boolean).slice(0, 12), theme: root.querySelector('[data-theme]').value, aiMode: root.querySelector('[data-ai]').value, motion: root.querySelector('[data-motion]').value, contrast: root.querySelector('[data-contrast]').checked, favorites: [...favorites.querySelectorAll('input:checked')].map(input => input.value) };
      write('idkPersonalization', next); write('idkLocation', { region: next.region, state: next.state }); write('timezone', next.timezone); write('theme', next.theme); write('motion', next.motion); write('idkHighContrast', next.contrast); write('idkFavoriteWidgets', next.favorites); window.IDKAIControls?.setMode?.(next.aiMode); document.getElementById('desktop')?.setAttribute('data-theme', next.theme); document.getElementById('desktop')?.setAttribute('data-motion', next.motion); document.body.classList.toggle('idk-high-contrast', next.contrast); root.querySelector('[data-status]').textContent = 'Your choices are saved on this device.'; notify('Personalization', 'Your IDK preferences were saved.', 'success'); window.dispatchEvent(new CustomEvent('idk-personalization-changed', { detail: next }));
    };
    root.querySelector('[data-skip]').onclick = () => closeWindow(root);
    return root;
  }

  function callsApp(options = {}) {
    const initialTarget = options.target || null, initialInvite = options.invite || window.IDKPendingCallInvite || null;
    window.IDKPendingCallInvite = null;
    const root = document.createElement('div'); root.id = 'idk-calls-app'; root.className = 'app idk-calls-app';
    root.innerHTML = '<header class="idk-control-head"><div><span class="idk-flow-kicker">IDK CALLS</span><h2>Voice and video calls</h2><p>Call accepted friends directly from IDK. Media is peer-to-peer, microphone and camera access is requested only when you choose it, and calls are not recorded.</p></div><div class="idk-call-preferences"><label><input type="checkbox" data-video-preference> Start with video</label><span class="idk-control-badge">VOICE FIRST</span></div></header><div class="idk-call-status" data-status>Loading your friends…</div><section class="idk-call-current" data-current hidden><div class="idk-call-peer"><span class="idk-call-avatar" data-avatar>?</span><div><strong data-peer>Not connected</strong><small data-call-state>Preparing call</small></div></div><audio data-audio autoplay></audio><video data-video autoplay playsinline hidden></video><div class="idk-call-actions"><button class="btn" data-mute>Mute</button><button class="btn" data-video-toggle>Video off</button><button class="btn danger" data-end>End call</button></div></section><section class="idk-call-incoming" data-incoming hidden><strong data-incoming-title>Incoming call</strong><p data-incoming-copy></p><div class="idk-call-actions"><button class="btn" data-accept>Accept call</button><button class="btn tab" data-reject>Decline</button></div></section><section class="idk-call-section"><div class="idk-call-section-head"><strong>Friends</strong><button class="btn tab" data-reload>Refresh</button></div><div class="idk-call-friends" data-friends></div></section><section class="idk-call-section"><div class="idk-call-section-head"><strong>Recent calls</strong><small>History syncs with your IDK account when signed in.</small></div><div class="idk-call-history" data-history></div></section>';
    const status = root.querySelector('[data-status]'), friendsList = root.querySelector('[data-friends]'), current = root.querySelector('[data-current]'), incoming = root.querySelector('[data-incoming]'), audio = root.querySelector('[data-audio]'), video = root.querySelector('[data-video]'), history = root.querySelector('[data-history]'), videoPreference = root.querySelector('[data-video-preference]');
    let friends = [], socket = null, socketReady = null, pc = null, stream = null, call = null, connected = false, videoEnabled = false, reconnectTimer = 0, reconnectAttempts = 0;
    const setStatus = value => { status.textContent = value; };
    const record = entry => { const items = read('idkCallHistory', []); write('idkCallHistory', [{ ...entry, at: Date.now() }, ...items].slice(0, 20)); renderHistory(); window.IDKAccount?.sync?.(); };
    const renderHistory = () => { const items = read('idkCallHistory', []); history.replaceChildren(...(items.length ? items.slice(0, 8).map(item => { const row = document.createElement('div'); row.className = 'idk-call-history-row'; row.innerHTML = `<span>${item.missed ? 'Missed' : item.direction === 'outgoing' ? 'Outgoing' : 'Incoming'}</span><strong>${esc(item.name || 'IDK friend')}</strong><time>${new Date(item.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>`; return row; }) : [Object.assign(document.createElement('p'), { className: 'idk-control-status', textContent: 'No calls yet.' })])); };
    const renderCall = () => { current.hidden = !call || call.incoming; incoming.hidden = !call?.incoming; if (call) { root.querySelector('[data-peer]').textContent = call.target.name; root.querySelector('[data-avatar]').textContent = call.target.name.slice(0, 1).toUpperCase(); root.querySelector('[data-call-state]').textContent = connected ? 'Connected · private voice call' : call.incoming ? 'Waiting for your answer' : 'Ringing…'; if (call.incoming) root.querySelector('[data-incoming-copy]').textContent = `${call.target.name} is calling you.`; } };
    const clean = () => { pc?.close(); pc = null; stream?.getTracks().forEach(track => track.stop()); stream = null; audio.srcObject = null; video.srcObject = null; video.hidden = true; connected = false; call = null; renderCall(); };
    const sendCall = (action, payload = {}) => { if (!socket || socket.readyState !== WebSocket.OPEN || !call) return; socket.send(JSON.stringify({ type: 'call', action, callId: call.id, targetUserId: call.target.id, payload })); };
    const ensureSocket = () => {
      if (socket?.readyState === WebSocket.OPEN) return Promise.resolve();
      if (socketReady) return socketReady;
      socketReady = new Promise((resolve, reject) => {
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws'; socket = new WebSocket(`${protocol}://${location.host}/chat`);
        socket.onopen = () => { reconnectAttempts = 0; socket.send(JSON.stringify({ type: 'join', name: window.IDKAccount?.user?.username || read('idkMessengerProfile', {}).name || 'IDK user', room: read('idkMessengerProfile', {}).room || 'general' })); resolve(); };
        socket.onerror = () => reject(new Error('The call service is unavailable.'));
        socket.onclose = () => { socketReady = null; if (!call) return; setStatus('Call service disconnected. Reconnecting…'); if (reconnectAttempts < 3) { reconnectAttempts += 1; reconnectTimer = setTimeout(() => ensureSocket().then(() => { if (call && !connected && call.offer) sendCall('invite', { sdp: call.offer }); }).catch(() => {}), reconnectAttempts * 1200); } };
        socket.onmessage = event => { let data; try { data = JSON.parse(event.data); } catch { return; } handleSignal(data); };
      });
      return socketReady;
    };
    const ensureMedia = async () => { if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not provide microphone access.'); if (window.IDKPermissions?.can && !window.IDKPermissions.can('calls', 'microphone')) throw new Error('Microphone access is blocked for IDK Calls. Open App Permissions and allow it first.'); if (videoEnabled && window.IDKPermissions?.can && !window.IDKPermissions.can('calls', 'camera')) throw new Error('Camera access is blocked for IDK Calls. Open App Permissions and allow it first.'); stream ||= await navigator.mediaDevices.getUserMedia({ audio: true, video: videoEnabled }); return stream; };
    const createPeer = () => { pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }); stream?.getTracks().forEach(track => pc.addTrack(track, stream)); pc.onicecandidate = event => { if (event.candidate) sendCall('signal', { candidate: event.candidate }); }; pc.ontrack = event => { audio.srcObject = event.streams[0]; video.srcObject = event.streams[0]; video.hidden = !event.streams[0]?.getVideoTracks?.().length; }; pc.onconnectionstatechange = () => { if (!pc) return; connected = pc.connectionState === 'connected'; if (pc.connectionState === 'failed') setStatus('The call connection failed. Try again.'); renderCall(); }; };
    const start = async target => {
      const friend = friends.find(item => item.id === target?.id) || target; if (!friend?.id) return setStatus('Choose an accepted friend first.');
      if (!friends.some(item => item.id === friend.id)) return setStatus('Calls are limited to accepted friends shown here.');
      try { videoEnabled = videoPreference.checked; await ensureSocket(); await ensureMedia(); call = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, target: { id: friend.id, name: friend.username || friend.name || 'Friend' }, incoming: false, direction: 'outgoing', startedAt: Date.now() }; createPeer(); renderCall(); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); call.offer = pc.localDescription; sendCall('invite', { sdp: pc.localDescription }); setStatus(`Calling ${call.target.name}…`); } catch (error) { clean(); setStatus(error.message || 'Could not start the call.'); }
    };
    const accept = async () => { if (!call?.incoming) return; try { videoEnabled = videoPreference.checked; await ensureSocket(); await ensureMedia(); createPeer(); await pc.setRemoteDescription(call.offer); call.incoming = false; call.direction = 'incoming'; call.startedAt = Date.now(); renderCall(); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); sendCall('accept', { sdp: pc.localDescription }); setStatus(`Connecting to ${call.target.name}…`); } catch (error) { setStatus(error.message || 'Could not accept the call.'); clean(); } };
    const end = (remote = false) => { if (!call) return; if (!remote) sendCall('end'); record({ name: call.target.name, missed: !connected, direction: call.direction || (call.incoming ? 'incoming' : 'outgoing'), duration: connected && call.startedAt ? Math.max(0, Date.now() - call.startedAt) : 0 }); clean(); setStatus(remote ? 'Call ended.' : 'Call ended.'); };
    function handleSignal(data) {
      if (data.type === 'call' && data.action === 'invite') { if (!friends.some(item => item.id === data.fromUserId)) return; call = { id: data.callId, target: { id: data.fromUserId, name: data.fromName || 'Friend' }, incoming: true, direction: 'incoming', offer: data.payload?.sdp }; renderCall(); notify('Incoming IDK call', `${data.fromName || 'A friend'} is calling you.`, 'success'); return; }
      if (data.type !== 'call' || !call || data.callId !== call.id) return;
      if (data.action === 'accept' && pc && data.payload?.sdp) pc.setRemoteDescription(data.payload.sdp).catch(() => setStatus('The call answer was not valid.'));
      else if (data.action === 'signal' && data.payload?.candidate) pc?.addIceCandidate(data.payload.candidate).catch(() => {});
      else if (data.action === 'reject') { record({ name: call.target.name, missed: true, direction: 'outgoing' }); clean(); setStatus(`${call.target.name} declined the call.`); }
      else if (data.action === 'end') end(true);
      else if (data.action === 'error') { clean(); setStatus(data.text || 'The call could not start.'); }
    }
    const load = async () => { try { const data = await fetch('/api/friends', { credentials: 'same-origin' }).then(response => response.json()); if (!data.ok) throw new Error(data.error || 'Sign in to use IDK Calls.'); friends = data.friends || []; friendsList.replaceChildren(...(friends.length ? friends.map(friend => { const row = document.createElement('div'); row.className = 'idk-call-friend'; row.dataset.friendId = friend.id; row.innerHTML = `<span class="idk-call-avatar">${esc((friend.username || '?').slice(0, 1).toUpperCase())}</span><strong>${esc(friend.username)}</strong>`; row.append(button('Call', () => start(friend), 'btn')); return row; }) : [Object.assign(document.createElement('p'), { className: 'idk-control-status', textContent: 'No accepted friends yet. Add friends first.' })])); setStatus(friends.length ? `${friends.length} accepted friend${friends.length === 1 ? '' : 's'} available.` : 'No accepted friends yet.'); if (initialInvite) handleSignal(initialInvite); if (initialTarget) start(initialTarget); } catch (error) { friends = []; friendsList.replaceChildren(Object.assign(document.createElement('p'), { className: 'idk-control-status', textContent: error.message })); setStatus(error.message); } };
    root.querySelector('[data-accept]').onclick = accept; root.querySelector('[data-reject]').onclick = () => { if (call) { sendCall('reject'); record({ name: call.target.name, missed: true, direction: 'incoming' }); } clean(); setStatus('Call declined.'); }; root.querySelector('[data-end]').onclick = () => end(); root.querySelector('[data-mute]').onclick = event => { const muted = stream?.getAudioTracks().some(track => !track.enabled); stream?.getAudioTracks().forEach(track => { track.enabled = muted; }); event.currentTarget.textContent = muted ? 'Mute' : 'Unmute'; }; root.querySelector('[data-video-toggle]').onclick = event => { const tracks = stream?.getVideoTracks() || []; if (!tracks.length) return setStatus('Start the next call with video enabled.'); const enabled = tracks.some(track => track.enabled); tracks.forEach(track => { track.enabled = !enabled; }); event.currentTarget.textContent = enabled ? 'Video on' : 'Video off'; }; videoPreference.onchange = () => { videoEnabled = videoPreference.checked; }; root.querySelector('[data-reload]').onclick = load;
    renderHistory(); load();
    root.cleanup = () => { clearTimeout(reconnectTimer); if (call) sendCall('end'); clean(); socket?.close(); socket = null; socketReady = null; };
    return root;
  }

  let pendingTarget = null;
  function openCalls(options = {}) { const pending = read('idkPendingCall', null); if (pending) { window.IDKPendingCallInvite = pending; localStorage.removeItem('idkPendingCall'); } pendingTarget = options.target || pendingTarget; window.OS?.open?.('calls', { ...(pendingTarget ? { target: pendingTarget } : {}), ...(options.invite ? { invite: options.invite } : {}) }); }
  function installMessengerCalls() {
    const sync = (root, target) => { const heading = root.querySelector('[data-pane="dm"] .idk-live-heading'); if (!heading || heading.querySelector('[data-idk-call]')) return; const callButton = button('Call', () => openCalls({ target: callButton._target }), 'idk-chat-call'); callButton.dataset.idkCall = 'true'; heading.append(callButton); callButton._target = target; callButton.hidden = !target?.userId; };
    window.addEventListener('idk-messenger-target', event => document.querySelectorAll('.idk-live-messenger').forEach(root => { const callButton = root.querySelector('[data-idk-call]'); if (callButton) { callButton._target = event.detail; callButton.hidden = !event.detail?.userId; } else sync(root, event.detail); }));
    const observer = new MutationObserver(() => document.querySelectorAll('.idk-live-messenger').forEach(root => sync(root, null))); observer.observe(document.body, { childList: true, subtree: true });
  }
  function install() {
    if (typeof APPS !== 'undefined') {
      APPS.widgetLibrary ||= { title: 'Widget Library', glyph: '▦', desktop: false, dock: false, width: 760, height: 610, render: widgetLibraryApp };
      APPS.personalization ||= { title: 'Personalization', glyph: '✦', desktop: false, dock: false, width: 760, height: 650, render: personalizationApp };
      APPS.calls ||= { title: 'IDK Calls', glyph: '☎', desktop: true, dock: false, width: 620, height: 680, render: callsApp };
    }
    document.getElementById('idk-batch-fourteen-launcher')?.remove();
    const launcher = button('☎', () => openCalls(), 'idk-batch-fourteen-launcher'); launcher.id = 'idk-batch-fourteen-launcher'; launcher.title = 'IDK Calls'; launcher.setAttribute('aria-label', 'IDK Calls'); document.body.append(launcher);
    installMessengerCalls();
  }
  window.IDKPersonalization = { open: () => window.OS?.open?.('personalization') };
  window.IdkCalls = { open: openCalls, start: target => openCalls({ target }) };
  window.IDKBatchFourteen = { widgetLibraryApp, personalizationApp, callsApp };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

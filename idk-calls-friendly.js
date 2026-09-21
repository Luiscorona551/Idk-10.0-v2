(() => {
  'use strict';
  if (window.IDKCallsFriendly) return;

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function enhance(root) {
    if (!root || root.dataset.friendlyCalls) return;
    root.dataset.friendlyCalls = 'true';
    const heading = root.querySelector('.idk-control-head h2');
    const copy = root.querySelector('.idk-control-head p');
    const intro = root.querySelector('.idk-call-intro');
    if (heading) heading.textContent = 'Talk like you are already there';
    if (copy) copy.textContent = 'Pick a friend, choose voice or video, and IDK will guide you through the rest.';
    if (intro) intro.innerHTML = '<strong>Private by default</strong><span>Your call is peer-to-peer and never recorded. Nothing uses your microphone or camera until you choose to call.</span><div class="idk-call-trust-row"><span>Voice first</span><span>Video optional</span><span>Reconnect ready</span></div>';

    const current = root.querySelector('[data-current]');
    const incoming = root.querySelector('[data-incoming]');
    const actions = current?.querySelector('.idk-call-actions');
    const peer = current?.querySelector('.idk-call-peer');
    let mini = null;
    let connectedAt = 0;
    let lastState = '';

    if (peer && !peer.querySelector('[data-friendly-timer]')) {
      const timer = document.createElement('small');
      timer.className = 'idk-call-timer';
      timer.dataset.friendlyTimer = '';
      timer.textContent = 'Ready when you are';
      peer.append(timer);
    }

    if (actions) {
      const diagnostics = document.createElement('button');
      diagnostics.type = 'button';
      diagnostics.className = 'btn tab';
      diagnostics.dataset.friendlyDiagnostics = '';
      diagnostics.textContent = 'Diagnostics';
      diagnostics.onclick = () => window.OS?.open?.('callDiagnostics');
      actions.insertBefore(diagnostics, actions.lastElementChild);
      const mute = actions.querySelector('[data-mute]');
      const video = actions.querySelector('[data-video-toggle]');
      const end = actions.querySelector('[data-end]');
      if (mute) mute.textContent = 'Mute microphone';
      if (video) video.textContent = 'Turn video on';
      if (end) end.textContent = 'Leave call';
    }

    if (incoming) {
      const title = incoming.querySelector('[data-incoming-title]');
      const accept = incoming.querySelector('[data-accept]');
      const reject = incoming.querySelector('[data-reject]');
      if (title) title.textContent = 'Incoming call';
      if (accept) accept.textContent = 'Answer call';
      if (reject) reject.textContent = 'Not now';
    }

    const help = document.createElement('p');
    help.className = 'idk-call-friendly-help';
    help.dataset.friendlyHelp = '';
    help.textContent = 'Tip: headphones reduce echo. You can mute or leave at any time.';
    root.querySelector('.idk-call-section')?.before(help);

    const ensureMini = () => {
      if (!current || !root.closest('.window')) return;
      if (!mini) {
        mini = document.createElement('div');
        mini.className = 'idk-call-mini-bar';
        mini.innerHTML = '<span class="idk-call-mini-dot"></span><strong data-mini-name>IDK Call</strong><span data-mini-state>Connecting…</span><span data-mini-duration>0:00</span><button type="button" data-mini-open>Open</button><button type="button" data-mini-end>End</button>';
        document.body.append(mini);
        mini.querySelector('[data-mini-open]').onclick = () => {
          const win = root.closest('.window');
          win?.classList.remove('minimized');
          win?.scrollIntoView?.({ block: 'nearest' });
        };
        mini.querySelector('[data-mini-end]').onclick = () => current.querySelector('[data-end]')?.click();
      }
    };

    const update = () => {
      const state = root.querySelector('[data-call-state]')?.textContent || '';
      const timer = root.querySelector('[data-friendly-timer]');
      if (state !== lastState && /Connected/.test(state)) connectedAt = Date.now();
      if (!/Connected/.test(state)) connectedAt = 0;
      lastState = state;
      const nextTimer = /Connected/.test(state) ? formatDuration(connectedAt ? Date.now() - connectedAt : 0) : state || 'Ready when you are';
      if (timer && timer.textContent !== nextTimer) timer.textContent = nextTimer;
      root.classList.toggle('idk-call-active', Boolean(current && !current.hidden));
      const status = root.querySelector('[data-status]')?.textContent || '';
      const nextHelp = /blocked|unavailable|permission/i.test(status) ? `${status} Open App Permissions if you want to enable calling.` : 'Tip: headphones reduce echo. You can mute or leave at any time.';
      if (help && help.textContent !== nextHelp) help.textContent = nextHelp;
      if (current && !current.hidden && root.closest('.window')) {
        ensureMini();
        const name = root.querySelector('[data-peer]')?.textContent || 'IDK Call';
        if (mini) {
          mini.querySelector('[data-mini-name]').textContent = name;
          mini.querySelector('[data-mini-state]').textContent = state || 'Connecting…';
          mini.querySelector('[data-mini-duration]').textContent = /Connected/.test(state) && connectedAt ? formatDuration(Date.now() - connectedAt) : '';
          mini.hidden = false;
        }
      } else if (mini) {
        mini.hidden = true;
      }
      if (mini && !root.isConnected) mini.remove();
    };

    const observer = new MutationObserver(update);
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
    const tick = setInterval(update, 1000);
    update();
    const previousCleanup = root.cleanup;
    root.cleanup = () => {
      observer.disconnect();
      clearInterval(tick);
      mini?.remove();
      previousCleanup?.();
    };
  }

  function scan() { document.querySelectorAll('.idk-calls-app').forEach(enhance); }
  window.IDKCallsFriendly = { enhance };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true }); else scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();

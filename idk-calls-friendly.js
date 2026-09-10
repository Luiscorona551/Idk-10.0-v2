(() => {
  'use strict';
  if (window.IDKCallsFriendly) return;

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
    if (peer && !peer.querySelector('[data-friendly-timer]')) { const timer = document.createElement('small'); timer.className = 'idk-call-timer'; timer.dataset.friendlyTimer = ''; timer.textContent = 'Ready when you are'; peer.append(timer); }
    if (actions) {
      const diagnostics = document.createElement('button'); diagnostics.type = 'button'; diagnostics.className = 'btn tab'; diagnostics.dataset.friendlyDiagnostics = ''; diagnostics.textContent = 'Need help?'; diagnostics.onclick = () => window.OS?.open?.('callDiagnostics'); actions.insertBefore(diagnostics, actions.lastElementChild);
      const mute = actions.querySelector('[data-mute]'); const video = actions.querySelector('[data-video-toggle]'); const end = actions.querySelector('[data-end]');
      if (mute) mute.textContent = 'Mute microphone';
      if (video) video.textContent = 'Turn video on';
      if (end) end.textContent = 'Leave call';
    }
    if (incoming) { const title = incoming.querySelector('[data-incoming-title]'); const accept = incoming.querySelector('[data-accept]'); const reject = incoming.querySelector('[data-reject]'); if (title) title.textContent = 'Someone wants to talk'; if (accept) accept.textContent = 'Answer call'; if (reject) reject.textContent = 'Not now'; }
    const help = document.createElement('p'); help.className = 'idk-call-friendly-help'; help.dataset.friendlyHelp = ''; help.textContent = 'Tip: headphones reduce echo. You can mute or leave at any time.'; root.querySelector('.idk-call-section')?.before(help);
    const update = () => {
      const state = root.querySelector('[data-call-state]')?.textContent || '';
      const timer = root.querySelector('[data-friendly-timer]');
      const nextTimer = /Connected/.test(state) ? 'You are connected securely' : state || 'Ready when you are';
      if (timer && timer.textContent !== nextTimer) timer.textContent = nextTimer;
      root.classList.toggle('idk-call-active', Boolean(current && !current.hidden));
      const status = root.querySelector('[data-status]')?.textContent || '';
      const nextHelp = /blocked|unavailable|permission/i.test(status) ? `${status} Open App Permissions if you want to enable calling.` : 'Tip: headphones reduce echo. You can mute or leave at any time.';
      if (help && help.textContent !== nextHelp) help.textContent = nextHelp;
    };
    const observer = new MutationObserver(update); observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true }); update();
    const previousCleanup = root.cleanup;
    root.cleanup = () => { observer.disconnect(); previousCleanup?.(); };
  }

  function scan() { document.querySelectorAll('.idk-calls-app').forEach(enhance); }
  window.IDKCallsFriendly = { enhance };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true }); else scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();

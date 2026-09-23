(() => {
  const VM_URL = 'https://luiscorona551.github.io/idk-Virtual-Machine/';

  function registerExtras() {
    if (!window.APPS || APPS.extras) return;
    const root = document.createElement('div');
    root.className = 'idk-extras-app';

    const hero = document.createElement('section');
    hero.className = 'idk-extras-hero';
    hero.innerHTML = '<div class="idk-extras-badge">IDK EXTRAS</div><h2>Extras</h2><p>Additional IDK tools and companion apps.</p>';

    const grid = document.createElement('div');
    grid.className = 'idk-extras-grid';

    const vmCard = document.createElement('article');
    vmCard.className = 'idk-extra-card';
    vmCard.innerHTML = '<div class="idk-extra-icon">▣</div><div class="idk-extra-copy"><strong>Virtual Machine</strong><span>Virt-Manager-style VM configuration and management.</span></div>';

    const open = document.createElement('button');
    open.className = 'btn';
    open.type = 'button';
    open.textContent = 'Open Virtual Machine';

    const frame = document.createElement('iframe');
    frame.className = 'idk-vm-frame';
    frame.title = 'IDK Virtual Machine Manager';
    frame.allow = 'fullscreen';
    frame.setAttribute('allowfullscreen', '');
    frame.referrerPolicy = 'no-referrer';
    frame.src = VM_URL;

    const status = document.createElement('span');
    status.className = 'idk-extra-status';
    status.textContent = 'VM Manager';

    open.addEventListener('click', () => {
      frame.src = VM_URL;
      status.textContent = 'Virtual Machine Manager connected';
    });

    vmCard.append(open, status);
    grid.append(vmCard);

    const footer = document.createElement('p');
    footer.className = 'idk-extras-note';
    footer.textContent = 'The VM manager is hosted separately so its virtualization backend can be connected independently later.';

    root.append(hero, grid, frame, footer);
    return root;
  }

  const register = () => {
    if (!window.APPS || APPS.extras) return;
    APPS.extras = {
      title: 'Extras',
      glyph: '✦',
      desktop: true,
      dock: false,
      width: 1040,
      height: 720,
      render: registerExtras
    };
    document.dispatchEvent(new Event('idk-extras-registered'));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register, { once: true });
  else register();
})();

(function () {
  'use strict';

  const ONECOMPILER_EMBED = 'https://onecompiler.com/embed/?theme=dark';

  function create(tag, props = {}) {
    const node = Object.assign(document.createElement(tag), props);
    return node;
  }

  function codeApp() {
    const root = create('div', { className: 'idk-code-app' });

    const toolbar = create('div', { className: 'idk-code-toolbar' });
    const title = create('div', { className: 'idk-code-title' });
    title.innerHTML = '<strong>IDK Code</strong><small>Powered by OneCompiler</small>';

    const open = create('button', {
      className: 'btn tab',
      type: 'button',
      textContent: 'Open OneCompiler'
    });
    open.addEventListener('click', () => window.open('https://onecompiler.com/', '_blank', 'noopener'));

    const reload = create('button', {
      className: 'btn tab',
      type: 'button',
      textContent: 'Reload'
    });

    const frame = create('iframe', {
      title: 'OneCompiler code editor',
      src: ONECOMPILER_EMBED,
      loading: 'eager',
      allow: 'clipboard-read; clipboard-write',
      referrerPolicy: 'strict-origin-when-cross-origin'
    });
    frame.setAttribute('allowfullscreen', '');

    reload.addEventListener('click', () => {
      frame.src = ONECOMPILER_EMBED + '&t=' + Date.now();
    });

    toolbar.append(title, create('span', { className: 'idk-code-spacer' }), reload, open);
    root.append(toolbar, frame);

    return root;
  }

  APPS.code = {
    title: 'IDK Code',
    glyph: '💻',
    desktop: true,
    width: 980,
    height: 680,
    render: codeApp
  };

  window.IDKCode = {
    url: 'https://onecompiler.com/',
    embed: ONECOMPILER_EMBED
  };
})();

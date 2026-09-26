(() => {
  const loader = document.getElementById('idk-startup-loader');
  if (!loader) return;
  const slides = [...loader.querySelectorAll('.idk-startup-slide')];
  const status = document.getElementById('idk-startup-status-text');
  let index = 0;
  let ready = false;
  let started = performance.now();

  const rotate = () => {
    if (!slides.length || loader.classList.contains('ready')) return;
    slides[index]?.classList.remove('active');
    index = (index + 1) % slides.length;
    slides[index]?.classList.add('active');
  };
  const slideTimer = setInterval(rotate, 2400);

  const waitForImages = () => {
    const images = [...document.images];
    return Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
      const done = () => { img.removeEventListener('load', done); img.removeEventListener('error', done); resolve(); };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, 1800);
    })));
  };

  const finish = () => {
    if (ready) return;
    ready = true;
    status.textContent = 'Desktop ready';
    clearInterval(slideTimer);
    loader.classList.add('ready');
    setTimeout(() => loader.remove(), 700);
  };

  const boot = async () => {
    await Promise.race([
      Promise.all([
        waitForImages(),
        document.fonts?.ready || Promise.resolve()
      ]),
      new Promise(resolve => setTimeout(resolve, 4500))
    ]);
    const elapsed = performance.now() - started;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 3200 - elapsed)));
    requestAnimationFrame(() => requestAnimationFrame(finish));
  };

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once: true });
})();

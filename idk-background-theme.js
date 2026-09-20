(() => {
  const KEY = 'idkBackgroundTheme-v1';
  const themes = [
    { name: 'blue', match: url => /plain-wnam-prod-public|#1553a4|#16224a/.test(url), accent: '#5b9cff', glow: '#4b8dff', panel: 'rgba(10, 28, 68, .82)', solid: '#0d1d43' },
    { name: 'grape', match: url => /#24123f|#5b2a86|#9b5de5/.test(url), accent: '#c17bdc', glow: '#9b5de5', panel: 'rgba(40, 18, 67, .84)', solid: '#24123f' },
    { name: 'red', match: url => /#3a0d18|#8f1d35|#e94f64/.test(url), accent: '#ff667d', glow: '#e94f64', panel: 'rgba(61, 13, 25, .84)', solid: '#3a0d18' },
    { name: 'emerald', match: url => /#0b2f24|#087f5b|#42d392/.test(url), accent: '#62e6a0', glow: '#42d392', panel: 'rgba(8, 43, 33, .84)', solid: '#0b2f24' },
    { name: 'midnight', match: url => /#121a35|#263b73|#526db0/.test(url), accent: '#7f9fe8', glow: '#526db0', panel: 'rgba(18, 26, 53, .86)', solid: '#121a35' },
    { name: 'purple', match: url => /#2b163f|#713f8c|#c17bdc/.test(url), accent: '#d58bea', glow: '#c17bdc', panel: 'rgba(43, 22, 63, .84)', solid: '#2b163f' },
    { name: 'sunset', match: url => /#27182d|#6b2d50|#f08a65/.test(url), accent: '#ff9b62', glow: '#f08a65', panel: 'rgba(55, 24, 43, .84)', solid: '#27182d' },
    { name: 'neon', match: url => /#062a35|#071020|#123f4c/.test(url), accent: '#7ef6d0', glow: '#43d9c0', panel: 'rgba(4, 31, 38, .84)', solid: '#062a35' },
    { name: 'graphite', match: url => /#080b13|#202938|#596273/.test(url), accent: '#b9c2d2', glow: '#7d899d', panel: 'rgba(18, 22, 31, .86)', solid: '#080b13' }
  ];

  function choose(url) {
    const value = String(url || '');
    return themes.find(t => t.match(value)) || themes[0];
  }

  function apply(url) {
    const theme = choose(url);
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    desktop.setAttribute('data-background-theme', theme.name);
    desktop.style.setProperty('--bg-accent', theme.accent);
    desktop.style.setProperty('--bg-glow', theme.glow);
    desktop.style.setProperty('--bg-panel', theme.panel);
    desktop.style.setProperty('--bg-panel-solid', theme.solid);
    localStorage.setItem(KEY, theme.name);
  }

  const original = window.applyWallpaper;
  if (typeof original === 'function' && !original.__idkBackgroundThemeWrapped) {
    const wrapped = function(url) {
      const result = original.apply(this, arguments);
      apply(url);
      return result;
    };
    wrapped.__idkBackgroundThemeWrapped = true;
    window.applyWallpaper = wrapped;
  }

  window.addEventListener('idk-background-theme-refresh', () => {
    const raw = localStorage.getItem('idkWallpaper');
    if (raw) {
      try { apply(JSON.parse(raw)); } catch {}
    }
  });

  const raw = localStorage.getItem('idkWallpaper');
  if (raw) {
    try { apply(JSON.parse(raw)); } catch {}
  } else {
    apply('');
  }

  window.IDKBackgroundTheme = { apply, themes };
})();
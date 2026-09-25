(() => {
  const KEY = 'idkBackgroundTheme-v2';
  const themes = [
    { name: 'blue', match: url => /https://cdn\.phototourl\.com/member/2026-09-25-8f19f079-9694-4973-af98-5f3add5f3868\.png|plain-wnam-prod-public/i.test(url), accent: '#5b9cff', glow: '#2d8cff', panel: 'rgba(10, 28, 68, .84)', solid: '#0d1d43', text: '#eaf3ff' },
    { name: 'grape', match: url => /https://cdn\.phototourl\.com/member/2026-09-25-e806c32c-31fd-4f54-a378-8eba729b9eda\.jpg/i.test(url), accent: '#c17bdc', glow: '#9b5de5', panel: 'rgba(40, 18, 67, .86)', solid: '#24123f', text: '#f7eaff' },
    { name: 'green', match: url => /https://cdn\.phototourl\.com/member/2026-09-25-b9324e05-93bd-445b-b799-c75b6ff7b455\.jpg/i.test(url), accent: '#62e6a0', glow: '#42d392', panel: 'rgba(8, 43, 33, .86)', solid: '#0b2f24', text: '#eafff2' },
    { name: 'red', match: url => /https://cdn\.phototourl\.com/member/2026-09-25-99dc02ce-44e6-4b64-965a-6674dcca4695\.jpg/i.test(url), accent: '#ff667d', glow: '#e94f64', panel: 'rgba(61, 13, 25, .86)', solid: '#3a0d18', text: '#ffecef' },
    { name: 'yellow', match: url => /https://cdn\.phototourl\.com/member/2026-09-25-8f011df4-5dcb-4f2d-98c8-f93aaa5fce6c\.jpg/i.test(url), accent: '#ffd84d', glow: '#ffb300', panel: 'rgba(67, 52, 8, .86)', solid: '#3f3007', text: '#fff9df' }
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
    desktop.style.setProperty('--accent', theme.accent);
    desktop.style.setProperty('--panel', theme.panel);
    desktop.style.setProperty('--panel-solid', theme.solid);
    desktop.style.setProperty('--text', theme.text);
    desktop.style.setProperty('--muted', `color-mix(in srgb, ${theme.text} 62%, transparent)`);
    desktop.setAttribute('data-theme', 'custom-background');
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

  window.IDKBackgroundTheme = { apply, themes };
})();
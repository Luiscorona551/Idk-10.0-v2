(() => {
  const KEY = 'idkBackgroundTheme-v2';
  // Clear legacy appearance state; the unified Settings/background system is authoritative.
  try { localStorage.removeItem('idkThemePack-v1'); localStorage.removeItem('idkBackgroundTheme-v1'); localStorage.removeItem('idkWallpaper'); } catch {}
  const themes = [
    { name: 'blue', match: url => String(url || '').includes('8f19f079-9694-4973-af98-5f3add5f3868') || String(url || '').includes('plain-wnam-prod-public'), accent: '#5b9cff', glow: '#2d8cff', panel: 'rgba(10, 28, 68, .84)', solid: '#0d1d43', text: '#eaf3ff' },
    { name: 'grape', match: url => String(url || '').includes('e806c32c-31fd-4f54-a378-8eba729b9eda'), accent: '#c17bdc', glow: '#9b5de5', panel: 'rgba(40, 18, 67, .86)', solid: '#24123f', text: '#f7eaff' },
    { name: 'green', match: url => String(url || '').includes('b9324e05-93bd-445b-b799-c75b6ff7b455'), accent: '#62e6a0', glow: '#42d392', panel: 'rgba(8, 43, 33, .86)', solid: '#0b2f24', text: '#eafff2' },
    { name: 'red', match: url => String(url || '').includes('99dc02ce-44e6-4b64-965a-6674dcca4695'), accent: '#ff667d', glow: '#e94f64', panel: 'rgba(61, 13, 25, .86)', solid: '#3a0d18', text: '#ffecef' },
    { name: 'yellow', match: url => String(url || '').includes('8f011df4-5dcb-4f2d-98c8-f93aaa5fce6c'), accent: '#ffd84d', glow: '#ffb300', panel: 'rgba(67, 52, 8, .86)', solid: '#3f3007', text: '#fff9df' }
  ];

  function choose(url) {
    return themes.find(theme => theme.match(url)) || themes[0];
  }

  function chooseByName(name) {
    return themes.find(theme => theme.name === name) || null;
  }

  function applyThemeObject(theme) {
    const desktop = document.getElementById('desktop');
    if (!desktop || !theme) return false;
    desktop.setAttribute('data-background-theme', theme.name);
    desktop.style.setProperty('--bg-accent', theme.accent);
    desktop.style.setProperty('--bg-glow', theme.glow);
    desktop.style.setProperty('--bg-panel', theme.panel);
    desktop.style.setProperty('--bg-panel-solid', theme.solid);
    desktop.style.setProperty('--accent', theme.accent);
    desktop.style.setProperty('--panel', theme.panel);
    desktop.style.setProperty('--panel-solid', theme.solid);
    desktop.style.setProperty('--text', theme.text);
    desktop.style.setProperty('--muted', theme.text === '#f7eaff' ? 'rgba(247,234,255,.62)' : theme.text === '#eafff2' ? 'rgba(234,255,242,.62)' : theme.text === '#ffecef' ? 'rgba(255,236,239,.62)' : theme.text === '#fff9df' ? 'rgba(255,249,223,.62)' : 'rgba(234,243,255,.62)');
    desktop.setAttribute('data-theme', 'custom-background');
    localStorage.setItem(KEY, theme.name);
    return true;
  }

  function apply(url) {
    return applyThemeObject(choose(url));
  }

  function applyChoice(choice, wallpaperURL) {
    if (choice === 'auto' || !choice) return apply(wallpaperURL);
    return applyThemeObject(chooseByName(choice) || choose(wallpaperURL));
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
  window.IDKBackgroundTheme = { apply, applyChoice, themes };
})();
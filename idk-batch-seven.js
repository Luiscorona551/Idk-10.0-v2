(() => {
  'use strict';

  const read = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const option = (value, label, selected) => Object.assign(document.createElement('option'), { value, textContent: label, selected });
  const label = (title, control, detail = '') => { const wrapper = document.createElement('label'); wrapper.className = 'idk-customize-field'; wrapper.append(Object.assign(document.createElement('strong'), { textContent: title }), control); if (detail) wrapper.append(Object.assign(document.createElement('small'), { textContent: detail })); return wrapper; };

  function applyState(state) {
    write('theme', state.theme); write('wallpaper', state.wallpaper); write('iconSize', state.iconSize); write('dockPosition', state.dockPosition); write('motion', state.motion); write('idkHighContrast', state.highContrast);
    const custom = { ...read('idkCustomTheme', {}), accent: state.accent }; write('idkCustomTheme', custom);
    const accessibility = { ...read('idkAccessibility', {}), highContrast: state.highContrast, reduceMotion: state.reduceMotion }; write('idkAccessibility', accessibility);
    if (typeof applyTheme === 'function') applyTheme(state.theme);
    if (typeof applyWallpaper === 'function') applyWallpaper(state.wallpaper);
    if (typeof applyIconSize === 'function') applyIconSize(state.iconSize);
    if (typeof applyDockPosition === 'function') applyDockPosition(state.dockPosition);
    if (typeof applyMotion === 'function') applyMotion(state.motion);
    document.body.classList.toggle('idk-high-contrast', state.highContrast); document.body.classList.toggle('idk-reduce-motion', state.reduceMotion);
    window.dispatchEvent(new CustomEvent('idk-data-changed', { detail: { key: 'appearance' } }));
  }

  function customizeApp() {
    const root = document.createElement('div'); root.className = 'app idk-customize';
    const theme = read('theme', 'midnight'); const custom = read('idkCustomTheme', {}); const wallpaper = read('wallpaper', '');
    const state = { theme, accent: custom.accent || '#5986da', wallpaper, iconSize: read('iconSize', 'normal'), dockPosition: read('dockPosition', 'bottom'), motion: read('motion', 'on'), highContrast: read('idkHighContrast', false), reduceMotion: read('idkAccessibility', {}).reduceMotion || false };
    const themeSelect = document.createElement('select'); themeSelect.className = 'field'; ['midnight', 'neon', 'sunset', 'mono', 'ocean', 'forest', 'candy', 'custom'].forEach(value => themeSelect.append(option(value, value[0].toUpperCase() + value.slice(1), state.theme === value)));
    const accent = document.createElement('input'); accent.className = 'idk-customize-color'; accent.type = 'color'; accent.value = state.accent;
    const wallpaperInput = document.createElement('input'); wallpaperInput.className = 'field'; wallpaperInput.type = 'text'; wallpaperInput.placeholder = 'Image URL or CSS gradient'; wallpaperInput.value = state.wallpaper;
    const size = document.createElement('select'); size.className = 'field'; ['compact', 'normal', 'large'].forEach(value => size.append(option(value, value[0].toUpperCase() + value.slice(1), state.iconSize === value)));
    const dock = document.createElement('select'); dock.className = 'field'; ['bottom', 'left', 'right'].forEach(value => dock.append(option(value, value[0].toUpperCase() + value.slice(1), state.dockPosition === value)));
    const motion = document.createElement('select'); motion.className = 'field'; motion.append(option('on', 'On', state.motion === 'on'), option('off', 'Reduced', state.motion === 'off'));
    const highContrast = document.createElement('input'); highContrast.type = 'checkbox'; highContrast.checked = state.highContrast;
    const reduceMotion = document.createElement('input'); reduceMotion.type = 'checkbox'; reduceMotion.checked = state.reduceMotion;
    const status = Object.assign(document.createElement('p'), { className: 'idk-connected-note', textContent: 'Changes stay on this device until you apply them.' });
    const current = () => ({ theme: themeSelect.value, accent: accent.value, wallpaper: wallpaperInput.value.trim(), iconSize: size.value, dockPosition: dock.value, motion: motion.value, highContrast: highContrast.checked, reduceMotion: reduceMotion.checked });
    const apply = document.createElement('button'); apply.className = 'btn'; apply.type = 'button'; apply.textContent = 'Apply changes'; apply.onclick = () => { applyState(current()); status.textContent = 'Appearance saved on this device.'; window.OS?.notify?.('Customize', 'Appearance updated.', 'success'); };
    const reset = document.createElement('button'); reset.className = 'btn tab'; reset.type = 'button'; reset.textContent = 'Reset appearance'; reset.onclick = () => { ['theme', 'wallpaper', 'iconSize', 'dockPosition', 'motion', 'idkCustomTheme', 'idkHighContrast', 'idkAccessibility'].forEach(key => localStorage.removeItem(key)); location.reload(); };
    const saveWorkspace = document.createElement('button'); saveWorkspace.className = 'btn tab'; saveWorkspace.type = 'button'; saveWorkspace.textContent = 'Save workspace'; saveWorkspace.onclick = () => window.OS?.saveWorkspace?.();
    root.append(Object.assign(document.createElement('header'), { className: 'idk-customize-header' }), Object.assign(document.createElement('div'), { className: 'idk-customize-grid' }), Object.assign(document.createElement('div'), { className: 'idk-customize-actions' }), status);
    const header = root.querySelector('header'); const heading = document.createElement('div'); heading.append(Object.assign(document.createElement('h2'), { textContent: 'Customization Studio' }), Object.assign(document.createElement('p'), { textContent: 'Make IDK feel like your desktop.' })); header.append(heading, Object.assign(document.createElement('span'), { className: 'idk-customize-mark', textContent: 'LOCAL' }));
    const grid = root.querySelector('.idk-customize-grid'); grid.append(label('Theme', themeSelect, 'Use Custom to apply your accent color.'), label('Accent color', accent), label('Wallpaper', wallpaperInput, 'Paste an image URL or a CSS gradient.'), label('Icon size', size), label('Dock position', dock), label('Motion', motion), label('High contrast', highContrast), label('Reduce motion', reduceMotion));
    root.querySelector('.idk-customize-actions').append(apply, reset, saveWorkspace, Object.assign(document.createElement('button'), { className: 'btn tab', type: 'button', textContent: 'Manage profiles', onclick: () => window.IDKAccountsDevices?.open?.('profiles') }));
    return root;
  }

  function install() { if (typeof APPS !== 'undefined' && !APPS.customize) APPS.customize = { title: 'Customize', glyph: '✦', desktop: false, dock: false, width: 760, height: 620, render: customizeApp }; }
  window.IDKBatchSeven = { customize: customizeApp };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

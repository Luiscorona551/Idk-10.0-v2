(() => {
  'use strict';
  const cache = new Map();
  const load = async name => {
    const file = name.includes('.') && name.lastIndexOf('.') > 0 ? name : `${name}.html`;
    let pending = cache.get(file);
    if (!pending) {
      const url = `https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile/UGS-Files/${encodeURIComponent(file)}`;
      pending = fetch(url, { cache: 'force-cache' }).then(async response => { if (!response.ok) throw new Error(`Could not fetch "${name}" (${response.status})`); return response.text(); });
      cache.set(file, pending);
    }
    try { return URL.createObjectURL(new Blob([await pending], { type: 'text/html' })); }
    catch (error) { cache.delete(file); throw error; }
  };
  const install = () => {
    if (typeof APPS === 'undefined' || !APPS.games || typeof listApp !== 'function') return false;
    APPS.games.render = async () => {
      const [names, icons] = await Promise.all([loadJSON('games.json'), loadJSON('game-icons.json').catch(() => ({}))]);
      const items = names.map(name => ({ id: name, title: typeof gameTitle === 'function' ? gameTitle(name) : name, iconURL: typeof gameIconURL === 'function' ? gameIconURL(icons[name]) : '', search: `${name} ${typeof gameTitle === 'function' ? gameTitle(name) : name}`.toLowerCase() }));
      return listApp({ items, placeholder: 'Search games…', empty: 'No games found.', async onOpen(item, tile) {
        const title = tile.querySelector('.tile-title'); const label = title.textContent; title.textContent = 'Loading…';
        try { const src = await load(item.id); OS.open('game-player', { title: item.title, src }); }
        catch (error) { window.OS?.notify?.('Games', error.message, 'danger'); }
        finally { title.textContent = label; }
      }});
    };
    return true;
  };
  let attempts = 0;
  const tryInstall = () => { if (install() || attempts++ >= 20) return; setTimeout(tryInstall, 100); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryInstall, { once: true }); else tryInstall();
})();

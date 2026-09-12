(() => {
  'use strict';
  const cache = new Map();
  const withBase = html => {
    html = html.replaceAll('https://cdn.jsdelivr.net/gh/bubblfan/emu@master/', 'https://cdn.emulatorjs.org/stable/data/');
    if (/\bEJS_(?:pathtodata|core)\b/i.test(html) && !/EJS_DEBUG_XX\s*=/i.test(html)) {
      const debug = '<script>window.EJS_DEBUG_XX = true;</script>';
      if (/<head\b/i.test(html)) html = html.replace(/<head\b[^>]*>/i, match => `${match}${debug}`);
      else if (/<html\b/i.test(html)) html = html.replace(/<html\b[^>]*>/i, match => `${match}<head>${debug}</head>`);
      else html = `${debug}${html}`;
    }
    if (/<base\b/i.test(html)) return html;
    const base = '<base href="https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile/UGS-Files/">';
    if (/<head\b/i.test(html)) return html.replace(/<head\b[^>]*>/i, match => `${match}${base}`);
    if (/<html\b/i.test(html)) return html.replace(/<html\b[^>]*>/i, match => `${match}<head>${base}</head>`);
    return `${base}${html}`;
  };
  const load = async name => {
    const file = name.includes('.') && name.lastIndexOf('.') > 0 ? name : `${name}.html`;
    let pending = cache.get(file);
    if (!pending) {
      const url = `https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile/UGS-Files/${encodeURIComponent(file)}`;
      pending = fetch(url, { cache: 'force-cache' }).then(async response => { if (!response.ok) throw new Error(`Could not fetch "${name}" (${response.status})`); return response.text(); });
      cache.set(file, pending);
    }
    try { return URL.createObjectURL(new Blob([withBase(await pending)], { type: 'text/html' })); }
    catch (error) { cache.delete(file); throw error; }
  };
  const install = () => {
    if (typeof APPS === 'undefined' || !APPS.games || typeof listApp !== 'function') return false;
    if (window.IDKGamesUI?.render) { APPS.games.render = window.IDKGamesUI.render; return true; }
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

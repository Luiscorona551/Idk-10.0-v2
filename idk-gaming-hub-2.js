(() => {
  'use strict';

  const FAVORITES_KEY = 'idkGameFavorites';
  const RECENTS_KEY = 'idkGameRecents';
  const GAME_CDN = 'https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile/UGS-Files/';
  const ICON_CDN = 'https://cdn.jsdelivr.net/gh/bubbls/UGS-Assets@main/';
  const PAGE_SIZE = 60;
  const PROVIDERS = [
    { name: 'Xbox Cloud Gaming', glyph: 'X', url: 'https://www.xbox.com/play', note: 'Play supported games from your browser.' },
    { name: 'GeForce NOW', glyph: 'N', url: 'https://play.geforcenow.com/', note: 'Stream games from your PC libraries.' },
    { name: 'Amazon Luna', glyph: 'L', url: 'https://luna.amazon.com/', note: 'Cloud gaming from Amazon.' },
    { name: 'Boosteroid', glyph: 'B', url: 'https://cloud.boosteroid.com/', note: 'Cloud PC gaming service.' },
    { name: 'Blacknut', glyph: 'B', url: 'https://www.blacknut.com/', note: 'A subscription game catalog.' }
  ];

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const readList = key => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  };
  const writeList = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode or quota: keep this session usable */ }
  };
  const gameTitle = id => String(id).replace(/^cl/i, '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() || String(id);
  const validGameId = id => typeof id === 'string' && id.length > 0 && id.length < 180 &&
    !/[\\/\u0000-\u001f]/.test(id) && id !== '.' && id !== '..' && !id.includes('..');
  const gameURL = id => {
    if (!validGameId(id)) throw new Error('This game has an invalid catalog entry.');
    const file = /\.[a-z0-9]+$/i.test(id) ? id : id + '.html';
    return GAME_CDN + encodeURIComponent(file);
  };
  const iconURL = path => path ? ICON_CDN + String(path).split('/').map(encodeURIComponent).join('/') : '';
  const loadJSON = async (path) => {
    const urls = [path, 'https://raw.githubusercontent.com/Luiscorona551/Idk-10.0-v2/main/' + path];
    let lastError;
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(path + ' returned ' + response.status);
        return await response.json();
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('Could not load ' + path);
  };
  const notify = message => window.OS?.notify?.('Gaming Hub', message, 'danger');
  const openGame = async item => {
    const src = gameURL(item.id);
    if (!window.OS || typeof window.OS.open !== 'function') throw new Error('The desktop app launcher is not ready.');
    window.OS.open('player', { title: item.title, src });
    const recents = readList(RECENTS_KEY).filter(entry => entry && entry.id !== item.id);
    recents.unshift({ id: item.id, title: item.title, at: Date.now() });
    writeList(RECENTS_KEY, recents.slice(0, 30));
    window.IDKAccount?.sync?.();
    window.dispatchEvent(new CustomEvent('idk-game-launched', { detail: { id: item.id, title: item.title } }));
  };

  async function renderGamingHub() {
    const root = make('section', 'idk-gaming-hub');
    root.setAttribute('aria-label', 'Gaming Hub');
    root.append(make('div', 'gh-loading', 'Loading your game library…'));

    let names;
    let icons = {};
    try {
      [names, icons] = await Promise.all([
        loadJSON('games.json'),
        loadJSON('game-icons.json').catch(() => ({}))
      ]);
      if (!Array.isArray(names)) throw new Error('games.json must contain an array of game IDs.');
    } catch (error) {
      root.replaceChildren();
      const state = make('div', 'gh-empty');
      state.append(make('strong', '', 'Your game catalog could not be loaded.'), make('p', '', error.message || 'Check your connection and try again.'));
      const retry = make('button', 'btn tab', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', () => window.OS?.open?.('games'));
      state.append(retry);
      root.append(state);
      return root;
    }

    const seen = new Set();
    const games = names.filter(validGameId).filter(id => {
      const key = id.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(id => ({
      id,
      title: gameTitle(id),
      icon: iconURL(icons && typeof icons === 'object' ? icons[id] : ''),
      search: (id + ' ' + gameTitle(id)).toLocaleLowerCase()
    })).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

    const favorites = () => new Set(readList(FAVORITES_KEY).filter(id => typeof id === 'string'));
    const recents = () => readList(RECENTS_KEY).filter(entry => entry && typeof entry.id === 'string');
    const hero = make('header', 'gh-hero');
    const heroCopy = make('div', 'gh-hero-copy');
    heroCopy.append(make('span', 'gh-eyebrow', 'IDK 10.0 • GAMING HUB 2.0'), make('h2', '', 'Your next game is waiting.'), make('p', '', 'One library for quick launches, favorites, and your recently played games.'));
    const heroActions = make('div', 'gh-hero-actions');
    const playRecent = make('button', 'gh-primary', '▶  Continue playing');
    playRecent.type = 'button';
    heroActions.append(playRecent);
    hero.append(heroCopy, heroActions);

    const stats = make('div', 'gh-stats');
    const statTotal = make('div', 'gh-stat');
    const statFavorites = make('div', 'gh-stat');
    const statRecent = make('div', 'gh-stat');
    stats.append(statTotal, statFavorites, statRecent);

    const modeBar = make('nav', 'gh-modebar');
    modeBar.setAttribute('aria-label', 'Gaming sections');
    const libraryTab = make('button', 'gh-mode active', '🎮  Game library');
    const cloudTab = make('button', 'gh-mode', '☁️  Cloud gaming');
    libraryTab.type = cloudTab.type = 'button';
    modeBar.append(libraryTab, cloudTab);

    const library = make('div', 'gh-library');
    const controls = make('div', 'gh-controls');
    const search = make('input', 'gh-search');
    search.type = 'search';
    search.placeholder = 'Search ' + games.length.toLocaleString() + ' games…';
    search.setAttribute('aria-label', 'Search games');
    const filter = make('select', 'gh-select');
    filter.setAttribute('aria-label', 'Filter games');
    [['all', 'All games'], ['favorites', '★ Favorites'], ['recent', 'Recently played']].forEach(([value, label]) => {
      const option = make('option', '', label); option.value = value; filter.append(option);
    });
    const sort = make('select', 'gh-select');
    sort.setAttribute('aria-label', 'Sort games');
    [['az', 'A to Z'], ['za', 'Z to A'], ['recent', 'Recently played first']].forEach(([value, label]) => {
      const option = make('option', '', label); option.value = value; sort.append(option);
    });
    const count = make('span', 'gh-count');
    controls.append(search, filter, sort, count);
    const recentSection = make('section', 'gh-recent-section');
    const recentHeading = make('div', 'gh-section-heading');
    recentHeading.append(make('h3', '', 'Jump back in'), make('span', 'gh-section-note', 'Your latest games'));
    const recentStrip = make('div', 'gh-recent-strip');
    recentSection.append(recentHeading, recentStrip);
    const resultsHeading = make('div', 'gh-section-heading gh-results-heading');
    resultsHeading.append(make('h3', '', 'Explore games'), make('span', 'gh-section-note', 'Select a game to launch'));
    const grid = make('div', 'gh-grid');
    const moreWrap = make('div', 'gh-more-wrap');
    const more = make('button', 'btn tab gh-more', 'Show more games');
    more.type = 'button';
    moreWrap.append(more);
    library.append(controls, recentSection, resultsHeading, grid, moreWrap);

    const cloud = make('section', 'gh-cloud');
    cloud.hidden = true;
    const cloudIntro = make('div', 'gh-cloud-intro');
    cloudIntro.append(make('span', 'gh-eyebrow', 'PLAY BEYOND YOUR LIBRARY'), make('h3', '', 'Cloud gaming services'), make('p', '', 'Open a provider in a new tab. Sign-in, subscriptions, and game availability are handled by that provider.'));
    const providers = make('div', 'gh-providers');
    PROVIDERS.forEach(provider => {
      const card = make('a', 'gh-provider');
      card.href = provider.url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      const glyph = make('span', 'gh-provider-glyph', provider.glyph);
      const copy = make('span', 'gh-provider-copy');
      copy.append(make('strong', '', provider.name), make('small', '', provider.note));
      card.append(glyph, copy, make('span', 'gh-provider-arrow', '↗'));
      providers.append(card);
    });
    cloud.append(cloudIntro, providers, make('p', 'gh-cloud-footnote', 'Provider logos and trademarks belong to their respective owners. IDK does not host or authenticate these services.'));

    root.replaceChildren(hero, stats, modeBar, library, cloud);

    let visibleLimit = PAGE_SIZE;
    let recentItems = [];
    const itemById = new Map(games.map(game => [game.id, game]));
    const updateStats = () => {
      statTotal.replaceChildren(make('strong', '', games.length.toLocaleString()), make('span', '', 'Games available'));
      statFavorites.replaceChildren(make('strong', '', favorites().size.toLocaleString()), make('span', '', 'Saved favorites'));
      statRecent.replaceChildren(make('strong', '', recents().length.toLocaleString()), make('span', '', 'Recently played'));
    };
    const renderRecent = () => {
      recentItems = recents().map(entry => itemById.get(entry.id)).filter(Boolean).slice(0, 8);
      recentStrip.replaceChildren();
      recentSection.hidden = !recentItems.length || filter.value !== 'all' || search.value.trim().length > 0;
      recentItems.forEach(item => {
        const button = make('button', 'gh-recent-card');
        button.type = 'button';
        if (item.icon) { const image = make('img', ''); image.src = item.icon; image.alt = ''; image.loading = 'lazy'; image.onerror = () => image.remove(); button.append(image); }
        button.append(make('span', '', item.title), make('small', '', 'Play again'));
        button.addEventListener('click', () => openGame(item).catch(error => notify(error.message || 'Could not launch this game.')));
        recentStrip.append(button);
      });
    };
    const render = () => {
      const query = search.value.trim().toLocaleLowerCase();
      const saved = favorites();
      let matches = games.filter(item => !query || item.search.includes(query));
      if (filter.value === 'favorites') matches = matches.filter(item => saved.has(item.id));
      if (filter.value === 'recent') {
        const order = new Map(recents().map((entry, index) => [entry.id, index]));
        matches = matches.filter(item => order.has(item.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
      } else if (sort.value === 'recent') {
        const order = new Map(recents().map((entry, index) => [entry.id, index]));
        matches.sort((a, b) => (order.get(a.id) ?? 99999) - (order.get(b.id) ?? 99999) || a.title.localeCompare(b.title));
      } else if (sort.value === 'za') matches.reverse();
      count.textContent = matches.length.toLocaleString() + ' games';
      grid.replaceChildren();
      if (!matches.length) {
        const empty = make('div', 'gh-empty');
        empty.append(make('strong', '', filter.value === 'favorites' ? 'No favorites yet.' : filter.value === 'recent' ? 'No recent games yet.' : 'No games match that search.'), make('p', '', filter.value === 'favorites' ? 'Tap the star on any game to save it here.' : 'Try a shorter title or a different search.'));
        grid.append(empty);
      }
      matches.slice(0, visibleLimit).forEach(item => {
        const card = make('article', 'gh-game-card');
        const play = make('button', 'gh-game-play');
        play.type = 'button';
        play.setAttribute('aria-label', 'Play ' + item.title);
        const art = make('span', 'gh-game-art');
        if (item.icon) {
          const image = make('img', '');
          image.src = item.icon; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
          image.onerror = () => { art.replaceChildren(make('span', 'gh-art-fallback', '🎮')); };
          art.append(image);
        } else art.append(make('span', 'gh-art-fallback', '🎮'));
        const details = make('span', 'gh-game-copy');
        details.append(make('strong', '', item.title), make('small', '', 'HTML game • Launch in IDK Player'));
        play.append(art, details);
        const star = make('button', 'gh-star' + (saved.has(item.id) ? ' is-saved' : ''), saved.has(item.id) ? '★' : '☆');
        star.type = 'button';
        star.title = saved.has(item.id) ? 'Remove from favorites' : 'Add to favorites';
        star.setAttribute('aria-label', star.title + ': ' + item.title);
        star.addEventListener('click', () => {
          const next = favorites();
          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
          writeList(FAVORITES_KEY, [...next]);
          window.IDKAccount?.sync?.();
          updateStats();
          render();
        });
        play.addEventListener('click', async () => {
          if (play.disabled) return;
          play.disabled = true;
          card.classList.add('is-loading');
          try { await openGame(item); }
          catch (error) { notify(error.message || 'Could not launch this game.'); }
          finally { play.disabled = false; card.classList.remove('is-loading'); updateStats(); renderRecent(); }
        });
        card.append(play, star);
        grid.append(card);
      });
      moreWrap.hidden = matches.length <= visibleLimit;
      renderRecent();
      updateStats();
    };

    const recent = recents().map(entry => itemById.get(entry.id)).find(Boolean);
    if (recent) {
      playRecent.disabled = false;
      playRecent.addEventListener('click', () => openGame(recent).catch(error => notify(error.message || 'Could not launch this game.')));
      playRecent.title = 'Continue ' + recent.title;
      playRecent.textContent = '▶  Continue ' + recent.title;
    } else {
      playRecent.disabled = true;
      playRecent.textContent = 'No recent game yet';
      playRecent.title = 'Launch a game to see it here.';
    }
    search.addEventListener('input', () => { visibleLimit = PAGE_SIZE; render(); });
    filter.addEventListener('change', () => { visibleLimit = PAGE_SIZE; render(); });
    sort.addEventListener('change', () => { visibleLimit = PAGE_SIZE; render(); });
    more.addEventListener('click', () => { visibleLimit += PAGE_SIZE; render(); });
    libraryTab.addEventListener('click', () => {
      library.hidden = false; cloud.hidden = true;
      libraryTab.classList.add('active'); cloudTab.classList.remove('active');
    });
    cloudTab.addEventListener('click', () => {
      library.hidden = true; cloud.hidden = false;
      cloudTab.classList.add('active'); libraryTab.classList.remove('active');
    });
    render();
    return root;
  }

  function install() {
    if (typeof APPS === 'undefined' || !APPS.games) return false;
    APPS.games.render = renderGamingHub;
    if (window.IDKGamesUI) window.IDKGamesUI.render = renderGamingHub;
    window.IDKGamingHub = { render: renderGamingHub, version: '2.0.0' };
    return true;
  }
  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => {
      if (install() || ++attempts >= 100) clearInterval(timer);
    }, 50);
  }
})();
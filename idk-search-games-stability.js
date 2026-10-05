(() => {
  'use strict';

  // Final crash-isolation layer for Search and Games.
  // These renderers never allow catalog/network errors to escape into the desktop.

  const safeText = value => String(value ?? '').replace(/[<>]/g, '');
  const make = (tag, props = {}) => Object.assign(document.createElement(tag), props);

  function errorCard(title, message) {
    const root = make('div', { className: 'empty-state' });
    root.append(
      make('strong', { textContent: title }),
      make('p', { textContent: message })
    );
    return root;
  }

  function install() {
    if (typeof window.APPS !== 'object' || !window.APPS) return false;
    if (typeof window.OS?.open !== 'function') return false;

    APPS.games = APPS.games || {};
    APPS.games.render = async () => {
      const root = make('div', { className: 'app games-app idk-stable-games' });
      const toolbar = make('div', { className: 'toolbar' });
      const input = make('input', {
        className: 'field',
        type: 'search',
        placeholder: 'Search games…',
        autocomplete: 'off'
      });
      const status = make('span', { className: 'count', textContent: 'Loading games…' });
      const grid = make('div', { className: 'search-results' });
      toolbar.append(input, status);
      root.append(toolbar, grid);

      let games = [];
      let loadError = null;

      const render = () => {
        const query = input.value.trim().toLowerCase();
        const visible = games.filter(game => !query || game.search.includes(query));
        grid.replaceChildren();

        if (!visible.length) {
          grid.append(errorCard(
            query ? 'No games found' : 'Games are unavailable',
            query ? 'Try another search.' : 'The game catalog could not be loaded, but IDK itself is still running.'
          ));
          return;
        }

        visible.slice(0, 300).forEach(game => {
          const button = make('button', { className: 'search-result', type: 'button' });
          if (game.iconURL) {
            const img = make('img', { src: game.iconURL, alt: '', loading: 'lazy' });
            img.width = 42;
            img.height = 42;
            img.onerror = () => img.remove();
            button.append(img);
          }
          button.append(make('span', { className: 'search-result-copy' }, []));
          const copy = button.lastElementChild;
          copy.append(
            make('strong', { className: 'tile-title', textContent: safeText(game.title) }),
            make('small', { textContent: 'Open game' })
          );
          button.addEventListener('click', () => {
            try {
              const opened = typeof window.openGame === 'function'
                ? window.openGame(game.id, game.title)
                : window.open('game.html?game=' + encodeURIComponent(game.id), '_blank', 'noopener');
              Promise.resolve(opened).catch(error => {
                window.OS?.notify?.('Games', error?.message || 'Could not open this game.', 'danger');
              });
            } catch (error) {
              window.OS?.notify?.('Games', error?.message || 'Could not open this game.', 'danger');
            }
          });
          grid.append(button);
        });

        status.textContent = query
          ? visible.length + ' result' + (visible.length === 1 ? '' : 's')
          : games.length + ' games';
      };

      input.addEventListener('input', render);

      try {
        const raw = await Promise.race([
          typeof window.loadJSON === 'function'
            ? window.loadJSON('games.json')
            : fetch('games.json', { cache: 'no-store' }).then(response => {
                if (!response.ok) throw new Error('Games catalog returned ' + response.status);
                return response.json();
              }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Games catalog timed out.')), 8000))
        ]);

        const names = Array.isArray(raw) ? raw : [];
        let icons = {};
        try {
          const iconData = await Promise.race([
            typeof window.loadJSON === 'function'
              ? window.loadJSON('game-icons.json')
              : fetch('game-icons.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : ({})),
            new Promise((_, reject) => setTimeout(() => reject(new Error('icon timeout')), 5000))
          ]);
          if (iconData && typeof iconData === 'object' && !Array.isArray(iconData)) icons = iconData;
        } catch (_) {
          icons = {};
        }

        games = names
          .filter(name => typeof name === 'string' && name.trim())
          .map(name => {
            const title = typeof window.gameTitle === 'function' ? window.gameTitle(name) : name;
            const iconURL = typeof window.gameIconURL === 'function' && icons[name]
              ? window.gameIconURL(icons[name])
              : '';
            return {
              id: name,
              title,
              iconURL,
              search: (name + ' ' + title).toLowerCase()
            };
          });

        render();
      } catch (error) {
        loadError = error;
        games = [];
        status.textContent = 'Games unavailable';
        grid.replaceChildren(errorCard(
          'Games catalog unavailable',
          'The Games app stayed open safely. Try again later.'
        ));
        window.OS?.notify?.('Games', error?.message || 'The games catalog could not be loaded.', 'warning');
      }

      return root;
    };

    APPS.search = APPS.search || {};
    APPS.search.render = async () => {
      const root = make('div', { className: 'search-app idk-stable-search' });
      const input = make('input', {
        className: 'field',
        type: 'search',
        placeholder: 'Search apps and games…',
        autocomplete: 'off'
      });
      const status = make('span', { className: 'count', textContent: 'Ready' });
      const results = make('div', { className: 'search-results' });
      root.append(make('div', { className: 'toolbar' }), results);
      root.firstElementChild.append(input, status);

      const appResults = Object.entries(APPS)
        .filter(([id, app]) => id !== 'player' && app && app.title)
        .map(([id, app]) => ({
          id,
          title: String(app.title),
          detail: 'IDK app',
          search: String(app.title).toLowerCase()
        }));

      let gameResults = [];
      const render = () => {
        const query = input.value.trim().toLowerCase();
        const matches = [...appResults, ...gameResults]
          .filter(item => !query || item.search.includes(query))
          .slice(0, 100);

        results.replaceChildren();
        status.textContent = matches.length + ' result' + (matches.length === 1 ? '' : 's');

        if (!matches.length) {
          results.append(errorCard('No results', 'Try a different search.'));
          return;
        }

        matches.forEach(item => {
          const button = make('button', { className: 'search-result', type: 'button' });
          button.append(
            make('span', { className: 'search-result-copy' })
          );
          const copy = button.firstElementChild;
          copy.append(
            make('strong', { textContent: safeText(item.title) }),
            make('small', { textContent: item.detail })
          );

          button.addEventListener('click', () => {
            try {
              if (item.type === 'game') {
                window.OS.open('games');
                return;
              }
              window.OS.open(item.id);
            } catch (error) {
              window.OS?.notify?.('Search', error?.message || 'Could not open that result.', 'danger');
            }
          });
          results.append(button);
        });
      };

      input.addEventListener('input', render);
      render();

      // Games are optional search data. Failure here must never break Search.
      try {
        const raw = await Promise.race([
          typeof window.loadJSON === 'function'
            ? window.loadJSON('games.json')
            : fetch('games.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : []),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        if (Array.isArray(raw)) {
          gameResults = raw
            .filter(name => typeof name === 'string' && name.trim())
            .map(name => {
              const title = typeof window.gameTitle === 'function' ? window.gameTitle(name) : name;
              return {
                id: name,
                title,
                detail: 'Game',
                type: 'game',
                search: (name + ' ' + title).toLowerCase()
              };
            });
          render();
        }
      } catch (_) {
        // Search remains fully usable with app results only.
      }

      setTimeout(() => input.focus(), 0);
      return root;
    };

    return true;
  }

  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => {
      if (install() || ++attempts > 100) clearInterval(timer);
    }, 50);
  }
})();

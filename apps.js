        : ['youtube.com', 'm.youtube.com'].includes(host)
          ? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]
          : '';
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : '';
  } catch {
    return '';
  }
}

function listApp({ items, placeholder, empty, onOpen, subtitle }) {
  const root = el('div');
  const search = el('input', { type: 'search', placeholder });
  const count = el('span', { className: 'count' });
  const grid = el('div', { className: 'tile-grid' });
  root.append(el('div', { className: 'toolbar' }, [search, count]), grid);

  if (!items.length) {
    grid.append(emptyState(empty));
    return root;
  }

  const render = () => {
    const query = search.value.trim().toLowerCase();
    const matches = query
      ? items.filter(item => item.search.includes(query))
      : items;
    grid.replaceChildren();
    count.textContent = `${matches.length} of ${items.length}`;
    matches.slice(0, 80).forEach(item => {
      const tile = el('button', { className: 'tile', type: 'button' });
      const tileIcon = el('span', { className: 'tile-icon' });
      tileIcon.setAttribute('aria-hidden', 'true');
      const fallbackIcon = () => tileIcon.replaceChildren(el('span', { className: 'tile-fallback', textContent: item.icon || '🎮' }));
      if (item.iconURL) {
        const image = el('img', { src: item.iconURL, alt: '', loading: 'lazy', decoding: 'async' });
        image.addEventListener('error', fallbackIcon, { once: true });
        tileIcon.append(image);
      } else {
        fallbackIcon();
      }
      tile.append(
        tileIcon,
        el('span', { className: 'tile-title', textContent: item.title })
      );
      const sub = subtitle && subtitle(item);
      if (sub) tile.append(el('span', { className: 'sub', textContent: sub }));
      tile.addEventListener('click', () => onOpen(item, tile));
      grid.append(tile);
    });
    if (matches.length > 400) {
      grid.append(emptyState('Showing the first 400 results — keep typing to narrow it down.'));
    }
    if (!matches.length) grid.append(emptyState('Nothing matched that search.'));
  };

  search.addEventListener('input', () => { visibleCount = PAGE_SIZE; render(); });
  render();
  return root;
}

async function searchApp() {
  const root = el('div', { className: 'search-app' });
  const input = el('input', { className: 'field', type: 'search', placeholder: 'Search apps and games…', autofocus: true });
  const status = el('span', { className: 'count', textContent: 'Loading index…' });
  const results = el('div', { className: 'search-results' });
  root.append(el('div', { className: 'toolbar' }, [input, status]), results);
(() => {
  'use strict';

  const KEY = 'idkDesktopWidgets';
  const TYPES = {
    weather: { label: 'Weather', icon: '☁', width: 245, height: 170 },
    news: { label: 'News', icon: '▤', width: 285, height: 205 },
    calendar: { label: 'Calendar events', icon: '□', width: 245, height: 180 },
    stocks: { label: 'Stock prices', icon: '↗', width: 245, height: 180 },
    sports: { label: 'Sports scores', icon: '★', width: 285, height: 205 }
  };

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const notify = (title, message) => window.OS?.notify?.(title, message);
  const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let desktop;
  let layer;
  let tray;
  let instances = [];

  function save() { write(KEY, instances); }

  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

  async function refresh(card, type) {
    const body = card.querySelector('.idk-free-widget-body');
    body.innerHTML = '<span class="idk-widget-loading">Updating...</span>';
    try {
      if (type === 'weather') {
        let coords = { latitude: 34.05, longitude: -118.25 };
        if (navigator.geolocation) {
          coords = await new Promise(resolve => navigator.geolocation.getCurrentPosition(
            position => resolve(position.coords), () => resolve(coords), { timeout: 2200 }
          ));
        }
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weather_code,wind_speed_10m`);
        const data = await response.json();
        body.innerHTML = `<strong>${Math.round(data.current.temperature_2m)}${esc(data.current_units.temperature_2m)}</strong><span>Current conditions · wind ${Math.round(data.current.wind_speed_10m)} km/h</span>`;
      } else if (type === 'calendar') {
        const todos = read('idkTodos', []).filter(item => item && !item.done).slice(0, 4);
        const events = read('idkCalendarEvents', []).filter(item => item && item.title).slice(0, 4);
        const items = [...events, ...todos];
        body.innerHTML = `<strong>${new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</strong>${items.length ? items.map(item => `<span class="idk-widget-line">${esc(item.title || item.text)}</span>`).join('') : '<span>No open events or tasks.</span>'}`;
      } else if (type === 'news') {
        const response = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page');
        const data = await response.json();
        const items = (data.hits || []).filter(item => item.title).slice(0, 4);
        body.innerHTML = items.length ? items.map(item => `<a class="idk-widget-line" href="${esc(item.url || '#')}" target="_blank" rel="noopener">${esc(item.title)}</a>`).join('') : '<span>No headlines available.</span>';
      } else if (type === 'stocks') {
        const symbols = ['AAPL', 'MSFT', 'GOOGL'];
        const prices = await Promise.all(symbols.map(async symbol => {
          const response = await fetch(`https://stooq.com/q/l/?s=${symbol.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`);
          const row = (await response.text()).split(/\r?\n/)[1] || '';
          return `${symbol}: ${row.split(',')[6] || '—'}`;
        }));
        body.innerHTML = prices.map(item => `<span class="idk-widget-line">${esc(item)}</span>`).join('');
      } else if (type === 'sports') {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');
        const data = await response.json();
        const games = (data.events || []).slice(0, 4);
        body.innerHTML = games.length ? games.map(game => {
          const teams = game.competitions?.[0]?.competitors || [];
          return `<span class="idk-widget-line"><b>${esc(teams[0]?.team?.abbreviation || 'TBD')} ${esc(teams[0]?.score || '—')}</b> · ${esc(teams[1]?.team?.abbreviation || 'TBD')} ${esc(teams[1]?.score || '—')}</span>`;
        }).join('') : '<span>No games scheduled.</span>';
      }
    } catch {
      body.innerHTML = '<span>Live data is unavailable. Select refresh to try again.</span>';
    }
  }

  function position(card, item) {
    const maxX = Math.max(10, (desktop?.clientWidth || innerWidth) - item.width - 10);
    const maxY = Math.max(64, (desktop?.clientHeight || innerHeight) - item.height - 72);
    item.x = clamp(Number(item.x) || 20, 10, maxX);
    item.y = clamp(Number(item.y) || 90, 64, maxY);
    card.style.left = `${item.x}px`;
    card.style.top = `${item.y}px`;
    card.style.width = `${item.width}px`;
    card.style.height = `${item.height}px`;
  }

  function saveAfterMotion(item, card) {
    position(card, item);
    save();
  }

  function attachMotion(card, item) {
    const header = card.querySelector('.idk-free-widget-title');
    const resize = card.querySelector('.idk-free-widget-resize');
    const drag = (event, resizing) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      const start = { x: item.x, y: item.y, width: item.width, height: item.height };
      const move = next => {
        if (resizing) {
          item.width = clamp(start.width + next.clientX - startX, 190, Math.min(460, innerWidth - 20));
          item.height = clamp(start.height + next.clientY - startY, 135, Math.min(420, innerHeight - 90));
        } else {
          item.x = start.x + next.clientX - startX;
          item.y = start.y + next.clientY - startY;
        }
        position(card, item);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        saveAfterMotion(item, card);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
    };
    header.addEventListener('pointerdown', event => drag(event, false));
    resize.addEventListener('pointerdown', event => drag(event, true));
  }

  function makeWidget(item) {
    const meta = TYPES[item.type];
    const card = document.createElement('article');
    card.className = 'idk-free-widget';
    card.dataset.widgetId = item.id;
    card.innerHTML = `<header class="idk-free-widget-title"><span>${meta.icon} ${meta.label}</span><button type="button" data-refresh aria-label="Refresh ${meta.label}">↻</button><button type="button" data-remove aria-label="Remove ${meta.label}">×</button></header><div class="idk-free-widget-body"></div><span class="idk-free-widget-resize" aria-hidden="true"></span>`;
    position(card, item);
    card.querySelector('[data-refresh]').onclick = () => refresh(card, item.type);
    card.querySelector('[data-remove]').onclick = () => {
      instances = instances.filter(value => value.id !== item.id);
      card.remove();
      save();
    };
    attachMotion(card, item);
    refresh(card, item.type);
    return card;
  }

  function add(type, x = 24, y = 92) {
    const meta = TYPES[type];
    if (!meta || instances.some(item => item.type === type)) {
      if (instances.some(item => item.type === type)) notify('Widgets', `${meta.label} is already on the desktop.`);
      return;
    }
    const item = { id: id(), type, x, y, width: meta.width, height: meta.height };
    instances.push(item);
    layer.append(makeWidget(item));
    save();
    tray?.remove();
    tray = null;
  }

  function openTray() {
    tray?.remove();
    tray = document.createElement('aside');
    tray.id = 'idk-widget-tray';
    tray.innerHTML = `<div class="idk-widget-tray-head"><strong>Desktop widgets</strong><button type="button" data-close aria-label="Close widgets">×</button></div><p>Drag a widget anywhere on the desktop, or select one to place it.</p><div class="idk-widget-tray-list"></div>`;
    const list = tray.querySelector('.idk-widget-tray-list');
    Object.entries(TYPES).forEach(([type, meta]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.draggable = true;
      button.dataset.widgetType = type;
      button.innerHTML = `<span>${meta.icon}</span><strong>${meta.label}</strong><small>Drag to place</small>`;
      button.onclick = () => add(type, 30 + instances.length * 18, 94 + instances.length * 18);
      button.ondragstart = event => { event.dataTransfer.setData('application/x-idk-widget', type); };
      list.append(button);
    });
    tray.querySelector('[data-close]').onclick = () => { tray.remove(); tray = null; };
    document.body.append(tray);
  }

  function install() {
    desktop = document.getElementById('desktop');
    if (!desktop) return;
    document.querySelector('.idk-glance-layer')?.remove();
    layer = document.createElement('div');
    layer.id = 'idk-free-widget-layer';
    desktop.append(layer);
    const saved = read(KEY, null);
    const legacy = read('idkDesktopCards', []);
    instances = Array.isArray(saved) ? saved.filter(item => TYPES[item.type]) : (Array.isArray(legacy) ? legacy.filter(type => TYPES[type]).map((type, index) => {
      const meta = TYPES[type];
      return { id: id(), type, x: 22 + (index % 2) * 250, y: 90 + Math.floor(index / 2) * 185, width: meta.width, height: meta.height };
    }) : []);
    instances.forEach(item => { item.width ||= TYPES[item.type].width; item.height ||= TYPES[item.type].height; layer.append(makeWidget(item)); });

    const toggle = document.getElementById('idk-upgrade-widgets-toggle');
    if (toggle) toggle.onclick = openTray;
    desktop.addEventListener('dragover', event => {
      if (event.dataTransfer?.types.includes('application/x-idk-widget')) { event.preventDefault(); desktop.classList.add('idk-widget-drop-target'); }
    }, true);
    desktop.addEventListener('dragleave', event => { if (!desktop.contains(event.relatedTarget)) desktop.classList.remove('idk-widget-drop-target'); }, true);
    desktop.addEventListener('drop', event => {
      const type = event.dataTransfer?.getData('application/x-idk-widget');
      if (!type || !TYPES[type]) return;
      event.preventDefault();
      event.stopPropagation();
      desktop.classList.remove('idk-widget-drop-target');
      const rect = desktop.getBoundingClientRect();
      add(type, event.clientX - rect.left - 90, event.clientY - rect.top - 24);
    }, true);
    window.IDKDesktopWidgets = { add, open: openTray, refresh: () => layer.querySelectorAll('.idk-free-widget').forEach(card => refresh(card, card.dataset.widgetType)) };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

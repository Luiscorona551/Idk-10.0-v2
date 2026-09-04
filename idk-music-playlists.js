(() => {
  'use strict';

  const KEY = 'idkMusicPlaylists';
  const mounted = new WeakSet();
  const objectUrls = new Set();

  const load = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const save = value => {
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {}
    try { window.IDKAccount?.sync?.(); } catch {}
  };

  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));

  function mount(root) {
    if (!root || mounted.has(root)) return;
    mounted.add(root);

    const playlists = load();
    let activeId = playlists[0]?.id || null;
    let currentIndex = -1;

    const panel = document.createElement('section');
    panel.className = 'idk-playlists-panel';
    panel.innerHTML = `
      <div class="idk-playlists-head">
        <div><strong>My Music Playlists</strong><small>Create playlists and keep your favorite tracks together.</small></div>
        <button type="button" class="idk-playlist-new">+ New playlist</button>
      </div>
      <div class="idk-playlists-layout">
        <aside class="idk-playlist-list"></aside>
        <div class="idk-playlist-main">
          <div class="idk-playlist-toolbar"></div>
          <div class="idk-playlist-tracks"></div>
          <div class="idk-playlist-empty">Create a playlist, then add songs by URL or add the song currently playing.</div>
        </div>
      </div>`;

    root.append(panel);

    const listEl = panel.querySelector('.idk-playlist-list');
    const toolbar = panel.querySelector('.idk-playlist-toolbar');
    const tracksEl = panel.querySelector('.idk-playlist-tracks');
    const emptyEl = panel.querySelector('.idk-playlist-empty');

    function active() { return playlists.find(p => p.id === activeId) || null; }

    function addTrack(track) {
      const playlist = active();
      if (!playlist || !track.url) return;
      playlist.tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
      playlist.tracks.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: track.title || 'Untitled track', url: track.url });
      save(playlists);
      render();
    }

    function playTrack(index) {
      const playlist = active();
      if (!playlist?.tracks?.[index]) return;
      const track = playlist.tracks[index];
      currentIndex = index;
      window.IDK_MUSIC_PLAYER?.setQueue(playlist.tracks, index, true);
      renderTracks();
    }

    function nextTrack() {
      const playlist = active();
      if (!playlist?.tracks?.length) return;
      playTrack((currentIndex + 1) % playlist.tracks.length);
    }

    function removeTrack(index) {
      const playlist = active();
      if (!playlist) return;
      const removed = playlist.tracks?.[index];
      if (removed?.url?.startsWith('blob:')) objectUrls.delete(removed.url);
      playlist.tracks.splice(index, 1);
      if (currentIndex === index) {
        window.IDK_MUSIC_PLAYER?.stop();
        currentIndex = -1;
      } else if (currentIndex > index) currentIndex -= 1;
      save(playlists);
      renderTracks();
    }

    function renderList() {
      listEl.replaceChildren();
      if (!playlists.length) {
        listEl.innerHTML = '<div class="idk-playlist-none">No playlists yet.</div>';
        return;
      }
      playlists.forEach(playlist => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `idk-playlist-item${playlist.id === activeId ? ' active' : ''}`;
        button.innerHTML = `<span>${esc(playlist.name)}</span><small>${playlist.tracks?.length || 0} song${(playlist.tracks?.length || 0) === 1 ? '' : 's'}</small>`;
        button.addEventListener('click', () => {
          activeId = playlist.id;
          currentIndex = -1;
          window.IDK_MUSIC_PLAYER?.stop();
          render();
        });
        listEl.append(button);
      });
    }

    function renderTracks() {
      const playlist = active();
      tracksEl.replaceChildren();
      emptyEl.hidden = Boolean(playlist?.tracks?.length);
      if (!playlist?.tracks?.length) return;
      playlist.tracks.forEach((track, index) => {
        const row = document.createElement('article');
        row.className = `idk-playlist-track${index === currentIndex ? ' playing' : ''}`;
        row.innerHTML = `<div class="idk-track-copy"><b>${esc(track.title)}</b><small>${esc(track.url.startsWith('blob:') ? 'Local track · this session' : track.url)}</small></div>`;
        const actions = document.createElement('div');
        actions.className = 'idk-track-actions';
        const play = document.createElement('button');
        play.type = 'button'; play.className = 'idk-play-btn'; play.textContent = index === currentIndex && window.IDK_AUDIO_STATE?.playing ? 'Pause' : 'Play';
        play.addEventListener('click', () => {
          if (index === currentIndex && window.IDK_AUDIO_STATE?.playing) window.IDK_MUSIC_PLAYER?.toggle();
          else playTrack(index);
          renderTracks();
        });
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'idk-remove-track'; remove.textContent = 'Remove';
        remove.addEventListener('click', () => removeTrack(index));
        actions.append(play, remove);
        row.append(actions);
        tracksEl.append(row);
      });
    }

    function renderToolbar() {
      toolbar.replaceChildren();
      const playlist = active();
      if (!playlist) {
        toolbar.innerHTML = '<span class="idk-playlist-hint">Select or create a playlist to start listening.</span>';
        return;
      }

      const name = document.createElement('div');
      name.className = 'idk-playlist-title-row';
      name.innerHTML = `<strong>${esc(playlist.name)}</strong>`;
      const rename = document.createElement('button');
      rename.type = 'button'; rename.textContent = 'Rename';
      rename.addEventListener('click', () => {
        const next = prompt('Playlist name:', playlist.name);
        if (next?.trim()) { playlist.name = next.trim().slice(0, 60); save(playlists); render(); }
      });
      const del = document.createElement('button');
      del.type = 'button'; del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (!confirm(`Delete playlist “${playlist.name}”?`)) return;
        playlists.splice(playlists.indexOf(playlist), 1);
        activeId = playlists[0]?.id || null;
        window.IDK_MUSIC_PLAYER?.stop(); currentIndex = -1;
        save(playlists); render();
      });
      name.append(rename, del);

      const add = document.createElement('form');
      add.className = 'idk-add-track';
      add.innerHTML = `<input type="text" placeholder="Song name" aria-label="Song name" required><input type="url" placeholder="Audio URL (https://...)" aria-label="Audio URL" required><button type="submit">Add song</button>`;
      add.addEventListener('submit', event => {
        event.preventDefault();
        const inputs = add.querySelectorAll('input');
        addTrack({ title: inputs[0].value.trim(), url: inputs[1].value.trim() });
        add.reset();
      });

      const playAll = document.createElement('button');
      playAll.type = 'button'; playAll.className = 'idk-play-all'; playAll.textContent = 'Play all';
      playAll.addEventListener('click', () => { if (playlist.tracks?.length) playTrack(0); });
      const queueAll = document.createElement('button');
      queueAll.type = 'button'; queueAll.className = 'idk-queue-all'; queueAll.textContent = 'Add all to Up Next';
      queueAll.addEventListener('click', () => playlist.tracks?.forEach(track => window.IDK_MUSIC_PLAYER?.enqueue(track)));

      const current = document.createElement('button');
      current.type = 'button'; current.className = 'idk-add-current'; current.textContent = '＋ Add current song';
      current.addEventListener('click', () => {
        const state = window.IDK_AUDIO_STATE;
        const liveAudio = state?.audio;
        const url = state?.track?.url || liveAudio?.currentSrc || liveAudio?.src || '';
        const title = state?.track?.title || state?.name || liveAudio?.dataset?.name || '';
        if (!url || url === window.location.href) {
          alert('Play a song first, then use “Add current song”.');
          return;
        }
        addTrack({ title: title || 'Current song', url });
      });

      const local = document.createElement('label');
      local.className = 'idk-local-track';
      local.textContent = 'Add local file';
      const file = document.createElement('input');
      file.type = 'file'; file.accept = 'audio/*';
      file.addEventListener('change', () => {
        const selected = file.files?.[0];
        if (!selected) return;
        const url = URL.createObjectURL(selected);
        objectUrls.add(url);
        addTrack({ title: selected.name.replace(/\.[^.]+$/, ''), url });
        file.value = '';
      });
      local.append(file);

      toolbar.append(name, playAll, queueAll, add, current, local);
    }

    function render() {
      renderList();
      renderToolbar();
      renderTracks();
    }

    panel.querySelector('.idk-playlist-new').addEventListener('click', () => {
      const name = prompt('New playlist name:', 'My Playlist');
      if (!name?.trim()) return;
      const playlist = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: name.trim().slice(0, 60), tracks: [] };
      playlists.push(playlist);
      activeId = playlist.id;
      save(playlists);
      render();
    });

    render();
    let lastAudioTrack = '';
    let lastAudioPlaying = false;
    const onAudio = event => {
      const detail = event.detail || {};
      const id = detail.track?.id || '';
      const playing = Boolean(detail.playing);
      const index = playlistForTrack(id);
      if (index >= 0) currentIndex = index;
      if (id === lastAudioTrack && playing === lastAudioPlaying) return;
      lastAudioTrack = id;
      lastAudioPlaying = playing;
      renderTracks();
    };
    const playlistForTrack = id => {
      const playlist = active();
      return id && playlist?.tracks ? playlist.tracks.findIndex(track => track.id === id) : -1;
    };
    window.addEventListener('idk-audio-state', onAudio);
    const cleanup = root.cleanup;
    root.cleanup = () => {
      window.removeEventListener('idk-audio-state', onAudio);
      cleanup?.();
    };
  }

  function scan() {
    document.querySelectorAll('.player-app').forEach(mount);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();

  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();

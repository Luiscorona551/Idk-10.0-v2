(() => {
  'use strict';
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const el = (tag, props = {}, children = []) => { const node = Object.assign(document.createElement(tag), props); Object.entries(props).filter(([key]) => key.startsWith('aria-') || key.startsWith('data-')).forEach(([key, value]) => node.setAttribute(key, String(value))); children.forEach(child => node.append(child)); return node; };
  const notify = (title, message) => window.OS?.notify?.(title, message);
  const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  function richNotes() {
    const old = read('idkNotesPair', []);
    let notes = read('idkRichNotes', null);
    if (!Array.isArray(notes)) notes = (Array.isArray(old) ? old : []).map((note, index) => ({ id: id('note'), title: note.title || `Notepad ${index + 1}`, text: note.text || '', tags: '', folder: index ? 'Personal' : 'Work', trashed: false, updated: Date.now() }));
    if (!notes.length) notes = [{ id: id('note'), title: 'Welcome note', text: '', tags: 'getting-started', folder: 'Personal', trashed: false, updated: Date.now() }];
    let selected = notes[0].id, folder = 'all', timer = 0;
    const root = el('div', { className: 'app rich-notes-app' });
    const search = el('input', { className: 'field', type: 'search', placeholder: 'Search notes…', 'aria-label': 'Search notes' });
    const add = el('button', { className: 'btn', type: 'button', textContent: 'New note' });
    const folders = el('nav', { className: 'notes-folders', 'aria-label': 'Note folders' });
    const list = el('div', { className: 'rich-notes-list' });
    const editor = el('section', { className: 'rich-note-editor' });
    const persist = () => { write('idkRichNotes', notes); write('idkNotes', notes.find(note => !note.trashed)?.text || ''); };
    const visible = () => notes.filter(note => folder === 'trash' ? note.trashed : !note.trashed && (folder === 'all' || note.folder === folder)).filter(note => { const q = search.value.trim().toLowerCase(); return !q || `${note.title} ${note.text} ${note.tags}`.toLowerCase().includes(q); });
    const renderFolders = () => { folders.replaceChildren(); [['all', 'All notes'], ['Work', 'Work'], ['Personal', 'Personal'], ['trash', 'Trash']].forEach(([value, label]) => { const b = el('button', { className: `btn tab${folder === value ? ' active' : ''}`, type: 'button', textContent: `${label}${value === 'trash' ? ` (${notes.filter(note => note.trashed).length})` : ''}` }); b.onclick = () => { folder = value; render(); }; folders.append(b); }); };
    const renderEditor = () => {
      const note = notes.find(item => item.id === selected) || visible()[0];
      if (!note) { editor.replaceChildren(el('div', { className: 'empty-state', textContent: 'Select a note to begin.' })); return; }
      selected = note.id;
      const title = el('input', { className: 'field', value: note.title, placeholder: 'Note title' });
      const tags = el('input', { className: 'field', value: note.tags, placeholder: 'Tags, separated by commas' });
      const area = el('textarea', { className: 'rich-note-area', placeholder: 'Start writing…', value: note.text });
      const status = el('span', { className: 'count', textContent: `Updated ${new Date(note.updated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` });
      const save = () => { note.title = title.value.trim() || 'Untitled note'; note.tags = tags.value; note.text = area.value; note.updated = Date.now(); persist(); status.textContent = 'Saved just now'; renderList(); };
      const delayed = () => { clearTimeout(timer); timer = setTimeout(save, 350); };
      title.oninput = tags.oninput = area.oninput = delayed;
      const trash = el('button', { className: 'btn tab', type: 'button', textContent: note.trashed ? 'Restore' : 'Move to trash' });
      trash.onclick = () => { note.trashed = !note.trashed; note.updated = Date.now(); persist(); folder = note.trashed ? 'trash' : 'all'; render(); };
      editor.replaceChildren(el('div', { className: 'rich-note-toolbar' }, [title, tags, status, trash]), area);
    };
    const renderList = () => { list.replaceChildren(); const items = visible(); if (!items.length) list.append(el('div', { className: 'empty-state', textContent: 'No matching notes.' })); items.forEach(note => { const b = el('button', { className: `rich-note-item${note.id === selected ? ' selected' : ''}`, type: 'button' }, [el('strong', { textContent: note.title || 'Untitled note' }), el('small', { textContent: note.tags || note.folder }), el('span', { textContent: (note.text || 'Empty note').slice(0, 80) })]); b.onclick = () => { selected = note.id; render(); }; list.append(b); }); };
    const render = () => { renderFolders(); renderList(); renderEditor(); };
    add.onclick = () => { const note = { id: id('note'), title: 'Untitled note', text: '', tags: '', folder: folder === 'Work' || folder === 'Personal' ? folder : 'Personal', trashed: false, updated: Date.now() }; notes.unshift(note); selected = note.id; folder = 'all'; persist(); render(); };
    search.oninput = render; root.append(el('div', { className: 'system-toolbar' }, [search, add]), el('div', { className: 'rich-notes-layout' }, [folders, list, editor])); render(); return root;
  }

  function calendarUpgrade() {
    let cursor = new Date(); cursor.setDate(1); let view = 'month';
    const events = Array.isArray(read('idkCalendarEvents', [])) ? read('idkCalendarEvents', []) : [];
    const root = el('div', { className: 'app upgraded-calendar' }); const title = el('strong'); const grid = el('div', { className: 'calendar-grid' });
    const eventTitle = el('input', { className: 'field', placeholder: 'Reminder title' }); const eventDate = el('input', { className: 'field', type: 'date' }); const eventTime = el('input', { className: 'field', type: 'time' });
    const repeat = el('select', { className: 'field', 'aria-label': 'Repeat reminder' }); [['none', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month']].forEach(([value, label]) => repeat.append(el('option', { value, textContent: label })));
    const status = el('span', { className: 'count', textContent: 'No reminders yet' });
    const key = date => date.toISOString().slice(0, 10);
    const persist = () => write('idkCalendarEvents', events);
    const eventFor = date => events.filter(item => item.date === key(date));
    const render = () => { grid.replaceChildren(); title.textContent = view === 'month' ? cursor.toLocaleDateString([], { month: 'long', year: 'numeric' }) : `Week of ${cursor.toLocaleDateString([], { month: 'short', day: 'numeric' })}`; if (view === 'month') { ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => grid.append(el('div', { className: 'calendar-weekday', textContent: day }))); const first = cursor.getDay(), total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate(); for (let i = 0; i < first; i += 1) grid.append(el('div', { className: 'calendar-day blank' })); for (let day = 1; day <= total; day += 1) { const date = new Date(cursor.getFullYear(), cursor.getMonth(), day); const cell = el('button', { className: `calendar-day${key(date) === key(new Date()) ? ' today' : ''}`, type: 'button' }, [el('strong', { textContent: String(day) })]); eventFor(date).forEach(item => cell.append(el('small', { textContent: item.title }))); cell.onclick = () => { eventDate.value = key(date); status.textContent = `${eventFor(date).length} reminder(s) on this day`; }; grid.append(cell); } } else { const start = new Date(cursor); start.setDate(cursor.getDate() - cursor.getDay()); for (let i = 0; i < 7; i += 1) { const date = new Date(start); date.setDate(start.getDate() + i); const cell = el('section', { className: 'calendar-week-cell' }, [el('strong', { textContent: date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) })]); eventFor(date).forEach(item => cell.append(el('p', { textContent: item.title }))); grid.append(cell); } } };
    const addEvent = () => { const titleValue = eventTitle.value.trim(), dateValue = eventDate.value; if (!titleValue || !dateValue) return; events.push({ id: id('event'), title: titleValue, date: dateValue, time: eventTime.value, repeat: repeat.value, reminded: false }); persist(); eventTitle.value = ''; status.textContent = 'Reminder added'; render(); };
    const previous = el('button', { className: 'btn tab', type: 'button', textContent: '‹', 'aria-label': 'Previous period' }); const next = el('button', { className: 'btn tab', type: 'button', textContent: '›', 'aria-label': 'Next period' }); const viewSelect = el('select', { className: 'field', 'aria-label': 'Calendar view' }); [['month', 'Month view'], ['week', 'Week view']].forEach(([value, label]) => viewSelect.append(el('option', { value, textContent: label })));
    previous.onclick = () => { cursor.setMonth(cursor.getMonth() + (view === 'month' ? -1 : 0)); cursor.setDate(cursor.getDate() + (view === 'week' ? -7 : 0)); render(); }; next.onclick = () => { cursor.setMonth(cursor.getMonth() + (view === 'month' ? 1 : 0)); cursor.setDate(cursor.getDate() + (view === 'week' ? 7 : 0)); render(); }; viewSelect.onchange = () => { view = viewSelect.value; render(); };
    const reminder = () => { const today = key(new Date()); events.filter(item => item.date === today && !item.reminded).forEach(item => { item.reminded = true; notify('Calendar reminder', item.title); }); persist(); }; const reminderTimer = setInterval(reminder, 30000); root.cleanup = () => clearInterval(reminderTimer);
    root.append(el('div', { className: 'calendar-toolbar' }, [previous, title, viewSelect, next]), grid, el('form', { className: 'calendar-event-form' }, [eventTitle, eventDate, eventTime, repeat, el('button', { className: 'btn', type: 'submit', textContent: 'Add reminder' }), status])); root.querySelector('form').onsubmit = event => { event.preventDefault(); addEvent(); }; render(); return root;
  }

  function todoUpgrade() {
    const items = (Array.isArray(read('idkTodos', [])) ? read('idkTodos', []) : []).map(item => ({ id: item.id || id('task'), text: item.text || '', done: Boolean(item.done), priority: item.priority || 'normal', due: item.due || '', repeat: item.repeat || 'none', added: item.added || Date.now(), completed: item.completed || 0 }));
    let filter = 'all'; const root = el('div', { className: 'app upgraded-todo' }); const search = el('input', { className: 'field', type: 'search', placeholder: 'Search tasks…' }); const text = el('input', { className: 'field', placeholder: 'Add a task…' }); const priority = el('select', { className: 'field', 'aria-label': 'Task priority' }); [['normal', 'Normal'], ['high', 'High'], ['low', 'Low']].forEach(([value, label]) => priority.append(el('option', { value, textContent: label }))); const due = el('input', { className: 'field', type: 'date', 'aria-label': 'Due date' }); const repeat = el('select', { className: 'field', 'aria-label': 'Repeat task' }); [['none', 'No repeat'], ['daily', 'Daily'], ['weekly', 'Weekly']].forEach(([value, label]) => repeat.append(el('option', { value, textContent: label }))); const list = el('div', { className: 'todo-list' });
    const persist = () => write('idkTodos', items); const render = () => { list.replaceChildren(); const q = search.value.toLowerCase().trim(); const shown = items.filter(item => filter === 'completed' ? item.done : filter === 'active' ? !item.done : true).filter(item => !q || item.text.toLowerCase().includes(q)); if (!shown.length) list.append(el('div', { className: 'empty-state', textContent: 'Nothing here yet.' })); shown.forEach(item => { const check = el('input', { type: 'checkbox', checked: item.done, 'aria-label': `Complete ${item.text}` }); const label = el('span', { className: `todo-text${item.done ? ' done' : ''}`, textContent: item.text }); const meta = el('small', { className: `todo-meta priority-${item.priority}`, textContent: `${item.priority} · ${item.due ? `due ${item.due}` : 'no due date'}${item.repeat !== 'none' ? ` · ${item.repeat}` : ''}` }); const remove = el('button', { className: 'btn tab todo-remove', type: 'button', textContent: '×', 'aria-label': `Remove ${item.text}` }); check.onchange = () => { item.done = check.checked; item.completed = item.done ? Date.now() : 0; persist(); render(); }; remove.onclick = () => { const index = items.indexOf(item); if (index >= 0) items.splice(index, 1); persist(); render(); }; list.append(el('div', { className: `todo-row priority-${item.priority}` }, [check, el('span', { className: 'todo-copy' }, [label, meta]), remove])); }); };
    const add = () => { const value = text.value.trim(); if (!value) return; items.unshift({ id: id('task'), text: value, done: false, priority: priority.value, due: due.value, repeat: repeat.value, added: Date.now(), completed: 0 }); text.value = ''; due.value = ''; persist(); render(); text.focus(); }; const filterSelect = el('select', { className: 'field', 'aria-label': 'Task filter' }); [['all', 'All'], ['active', 'Active'], ['completed', 'Completed history']].forEach(([value, label]) => filterSelect.append(el('option', { value, textContent: label }))); filterSelect.onchange = () => { filter = filterSelect.value; render(); }; const addButton = el('button', { className: 'btn', type: 'button', textContent: 'Add' }); addButton.onclick = add; text.onkeydown = event => { if (event.key === 'Enter') add(); }; search.oninput = render; root.append(el('div', { className: 'todo-upgrade-toolbar' }, [search, filterSelect]), el('div', { className: 'todo-upgrade-compose' }, [text, priority, due, repeat, addButton]), list); render(); return root;
  }

  function install() {
    if (typeof APPS === 'undefined') return;
    APPS.notes.render = richNotes;
    APPS.calendar.render = calendarUpgrade;
    APPS.todo.render = todoUpgrade;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

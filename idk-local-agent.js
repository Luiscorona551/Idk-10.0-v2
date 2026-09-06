(() => {
  'use strict';
  if (window.IDKLocalAgent) return;

  const ENDPOINT_KEY = 'idkLocalAgentEndpoint';
  const MODEL_KEY = 'idkLocalAgentModel';
  const PERMISSIONS_KEY = 'idkLocalAgentPermissions';
  const providers = {
    ollama: { endpoint: 'http://127.0.0.1:11434/v1', model: 'llama3.2', note: 'Ollama needs local API access enabled for this browser.' },
    lmstudio: { endpoint: 'http://127.0.0.1:1234/v1', model: 'local-model', note: 'LM Studio must have a model loaded and its local server running.' }
  };
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const array = key => { const value = read(key, []); return Array.isArray(value) ? value : []; };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const notify = (title, message, kind = 'info') => window.OS?.notify?.(title, message, kind);
  const open = (app, opts) => window.OS?.open?.(app, opts || {});
  const emit = type => window.dispatchEvent(new CustomEvent('idk-data-changed', { detail: { type, localAgent: true } }));
  const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
  const baseURL = value => String(value || '').trim().replace(/\/(chat\/completions|models)\/?$/i, '').replace(/\/+$/, '');

  function context() {
    const apps = typeof APPS === 'undefined' ? [] : Object.entries(APPS).filter(([, app]) => app?.title).map(([key, app]) => `${key}: ${app.title}`).slice(0, 80);
    const files = window.IDKFiles?.getFiles?.() || array('idkFileSystem');
    return JSON.stringify({ apps, tasks: array('idkTodos').filter(item => !item.done).slice(0, 20), notes: array('idkRichNotes').filter(item => !item.trashed).slice(0, 12).map(item => ({ title: item.title, text: String(item.text || '').slice(0, 180) })), reminders: array('idkCalendarEvents').slice(0, 20), files: files.slice(0, 60).map(item => ({ name: item.name, type: item.type, parent: item.parent })) });
  }

  async function localChat(endpoint, model, messages) {
    const response = await fetch(`${baseURL(endpoint)}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, messages, temperature: .2 }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `Local AI returned ${response.status}.`);
    return data.choices?.[0]?.message?.content || data.output_text || '';
  }

  function parsePlan(text) {
    const match = String(text || '').match(/\{[\s\S]*\}/); if (!match) return { message: text || 'The local model returned no message.', actions: [] };
    try { const value = JSON.parse(match[0]); return { message: String(value.message || ''), actions: Array.isArray(value.actions) ? value.actions.filter(item => item && typeof item.type === 'string').slice(0, 8) : [] }; } catch { return { message: text, actions: [] }; }
  }

  function permissions() { return { open: true, create: true, write: false, ...read(PERMISSIONS_KEY, {}) }; }
  function addMessage(log, role, text) { const row = document.createElement('article'); row.className = `idk-local-message ${role}`; row.innerHTML = `<span>${role === 'user' ? 'YOU' : 'LOCAL AGENT'}</span><p></p>`; row.querySelector('p').textContent = text; log.append(row); log.scrollTop = log.scrollHeight; }
  function actionLabel(action) { const labels = { open_app: `Open ${action.app || 'an IDK app'}`, open_url: `Open ${action.url || 'a web page'}`, create_note: `Create note: ${action.title || 'Untitled'}`, create_task: `Create task: ${action.text || 'New task'}`, create_reminder: `Create reminder: ${action.title || 'New reminder'}`, write_file: `Write file: ${action.name || 'New text file'}` }; return labels[action.type] || `Unknown action: ${action.type}`; }

  async function execute(action, allow) {
    const safeApps = new Set(['files', 'notes', 'todo', 'calendar', 'proxy', 'today', 'transfer', 'browserWorkspaces', 'settings', 'ai', 'localAgent']);
    if ((action.type === 'open_app' || action.type === 'open_url') && !allow.open) throw new Error('Opening apps and links is disabled.');
    if (['create_note', 'create_task', 'create_reminder'].includes(action.type) && !allow.create) throw new Error('Creating IDK items is disabled.');
    if (action.type === 'write_file' && !allow.write) throw new Error('Text-file writing is disabled.');
    if (action.type === 'open_app') { if (!safeApps.has(action.app) || !APPS?.[action.app]) throw new Error('That app is not on the safe action list.'); open(action.app); return `Opened ${APPS[action.app].title}.`; }
    if (action.type === 'open_url') { const url = String(action.url || '').trim(); if (!/^https?:\/\//i.test(url)) throw new Error('Only http and https links can be opened.'); open('proxy', { url }); return `Opened ${url}.`; }
    if (action.type === 'create_note') { const notes = array('idkRichNotes'); notes.unshift({ id: id('note'), title: String(action.title || 'Local agent note').slice(0, 80), text: String(action.text || '').slice(0, 6000), tags: 'local-agent', folder: 'Personal', trashed: false, updated: Date.now() }); write('idkRichNotes', notes.slice(0, 300)); emit('notes'); return 'Created the note.'; }
    if (action.type === 'create_task') { const tasks = array('idkTodos'); tasks.unshift({ id: id('task'), text: String(action.text || 'Local agent task').slice(0, 160), done: false, priority: ['high', 'normal', 'low'].includes(action.priority) ? action.priority : 'normal', due: /^\d{4}-\d{2}-\d{2}$/.test(action.due || '') ? action.due : '', repeat: 'none', added: Date.now(), completed: 0 }); write('idkTodos', tasks.slice(0, 300)); emit('tasks'); return 'Created the task.'; }
    if (action.type === 'create_reminder') { const events = array('idkCalendarEvents'); events.push({ id: id('event'), title: String(action.title || 'Local agent reminder').slice(0, 120), date: /^\d{4}-\d{2}-\d{2}$/.test(action.date || '') ? action.date : today(), time: /^\d{2}:\d{2}$/.test(action.time || '') ? action.time : '', repeat: 'none', reminded: false }); write('idkCalendarEvents', events.slice(-300)); emit('calendar'); return 'Created the reminder.'; }
    if (action.type === 'write_file') { const entries = window.IDKFiles?.getFiles?.() || []; const requestedParent = String(action.parent || '').toLowerCase(); const parent = entries.find(item => item.type === 'folder' && (item.id === action.parent || item.name.toLowerCase() === requestedParent))?.id || ''; if (!window.IDKFiles?.writeTextFile) throw new Error('IDK Files is unavailable.'); window.IDKFiles.writeTextFile(String(action.name || 'local-agent.txt').replace(/[^a-z0-9._ -]/gi, '').slice(0, 80) || 'local-agent.txt', String(action.content || '').slice(0, 12000), parent, 'text/plain'); return 'Wrote the text file.'; }
    throw new Error('This action is not supported.');
  }

  function app() {
    const root = document.createElement('div'); root.className = 'app idk-local-agent';
    const savedEndpoint = read(ENDPOINT_KEY, providers.ollama.endpoint), savedModel = read(MODEL_KEY, providers.ollama.model), savedPermissions = permissions();
    root.innerHTML = `<header class="idk-local-head"><div><span class="idk-flow-kicker">IDK LOCAL</span><h2>Local Agent</h2><p>Use a local model for private chat and approved IDK actions. Nothing is sent to Gemini or OpenAI from this window.</p></div><span class="idk-local-badge">NO CLOUD KEY</span></header><section class="idk-local-card"><div class="idk-local-config"><label>Runtime<select data-provider><option value="ollama">Ollama</option><option value="lmstudio">LM Studio</option></select></label><label>Local endpoint<input class="field" data-endpoint value="${esc(savedEndpoint)}" spellcheck="false"></label><label>Model<input class="field" data-model value="${esc(savedModel)}" spellcheck="false"></label><button class="btn" type="button" data-test>Test connection</button></div><p class="idk-local-note" data-note>Ollama: install a model, start it, and allow browser access from this page.</p></section><section class="idk-local-card"><header><h3>Permissions</h3><span class="count">Every action still needs approval</span></header><div class="idk-local-permissions"><label><input type="checkbox" data-permission="open" ${savedPermissions.open ? 'checked' : ''}> Open IDK apps and safe web links</label><label><input type="checkbox" data-permission="create" ${savedPermissions.create ? 'checked' : ''}> Create notes, tasks, and reminders</label><label><input type="checkbox" data-permission="write" ${savedPermissions.write ? 'checked' : ''}> Write text files</label></div></section><section class="idk-local-card idk-local-chat"><div class="idk-local-log" data-log></div><form data-chat><textarea class="field" name="prompt" rows="2" placeholder="Ask the local agent to organize your IDK workspace..."></textarea><button class="btn" type="submit">Ask local agent</button></form><p class="idk-local-status" data-status>Ready.</p></section>`;
    const provider = root.querySelector('[data-provider]'), endpoint = root.querySelector('[data-endpoint]'), model = root.querySelector('[data-model]'), note = root.querySelector('[data-note]'), log = root.querySelector('[data-log]'), status = root.querySelector('[data-status]'), chat = root.querySelector('[data-chat]');
    provider.value = savedEndpoint.includes('1234') ? 'lmstudio' : 'ollama';
    const save = () => { write(ENDPOINT_KEY, endpoint.value.trim()); write(MODEL_KEY, model.value.trim()); write(PERMISSIONS_KEY, Object.fromEntries([...root.querySelectorAll('[data-permission]')].map(input => [input.dataset.permission, input.checked]))); };
    provider.onchange = () => { const config = providers[provider.value]; endpoint.value = config.endpoint; model.value = config.model; note.textContent = config.note; save(); };
    root.querySelectorAll('[data-permission]').forEach(input => input.onchange = save);
    root.querySelector('[data-test]').onclick = async () => { save(); status.textContent = 'Connecting to local runtime...'; try { const response = await fetch(`${baseURL(endpoint.value)}/models`); if (!response.ok) throw new Error(`Runtime returned ${response.status}.`); const data = await response.json(); const names = (data.data || []).map(item => item.id).filter(Boolean); status.textContent = names.length ? `Connected. Available models: ${names.slice(0, 4).join(', ')}` : 'Connected. Enter the model name to use.'; } catch (error) { status.textContent = `Could not connect locally: ${error.message}.`; } };
    chat.onsubmit = async event => { event.preventDefault(); const prompt = chat.prompt.value.trim(); if (!prompt) return; save(); addMessage(log, 'user', prompt); chat.reset(); status.textContent = 'Thinking locally...'; const system = `You are the IDK Local Agent. Return ONLY valid JSON with this shape: {"message":"short answer","actions":[{"type":"open_app|open_url|create_note|create_task|create_reminder|write_file", ...}]}. Allowed fields: open_app app; open_url url; create_note title,text; create_task text,due,priority; create_reminder title,date,time; write_file name,content,parent. Never suggest shell commands, deletion, credentials, account changes, arbitrary code, or messages. Use actions only when the user clearly asks. Current IDK context: ${context()}`; try { const raw = await localChat(endpoint.value, model.value, [{ role: 'system', content: system }, { role: 'user', content: prompt }]); const plan = parsePlan(raw); addMessage(log, 'assistant', plan.message || 'I prepared an action plan.'); if (plan.actions.length) { const card = document.createElement('article'); card.className = 'idk-local-plan'; card.innerHTML = `<strong>Proposed actions</strong><div data-actions></div><div class="idk-flow-actions"><button class="btn" data-approve>Approve actions</button><button class="btn tab" data-dismiss>Dismiss</button></div>`; const actionList = card.querySelector('[data-actions]'); plan.actions.forEach(action => { const item = document.createElement('div'); item.textContent = actionLabel(action); actionList.append(item); }); card.querySelector('[data-dismiss]').onclick = () => card.remove(); card.querySelector('[data-approve]').onclick = async () => { card.querySelector('[data-approve]').disabled = true; const results = []; for (const action of plan.actions) { try { results.push(await execute(action, permissions())); } catch (error) { results.push(`Skipped: ${error.message}`); } } card.querySelector('[data-actions]').replaceChildren(...results.map(result => Object.assign(document.createElement('div'), { textContent: result }))); card.querySelector('[data-approve]').remove(); notify('Local Agent', 'Approved actions completed.', 'success'); }; log.append(card); log.scrollTop = log.scrollHeight; } status.textContent = 'Ready.'; } catch (error) { addMessage(log, 'assistant', `Local agent error: ${error.message}`); status.textContent = 'Connection error'; } };
    addMessage(log, 'assistant', 'Local Agent is ready. Test your local runtime, then ask me to create or open something in IDK.'); return root;
  }

  function install() { if (typeof APPS !== 'undefined') APPS.localAgent = { title: 'Local Agent', glyph: '⌘', desktop: true, dock: false, width: 940, height: 720, render: app }; }
  window.IDKLocalAgent = { open: () => window.OS?.open?.('localAgent'), render: app };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();

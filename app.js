/* Weekend Vibes v2 — tasks, activities, weather, Outlook mail flags and two-way calendar sync */
'use strict';
const CFG = window.WV_CONFIG || {};
const CAT = CFG.calendarCategory || 'Weekend Vibes';
const SLOTS = [
  { name: 'Morning', from: 7, to: 11, start: '09:00' },
  { name: 'Afternoon', from: 12, to: 16, start: '13:00' },
  { name: 'Evening', from: 17, to: 20, start: '18:00' }
];
const PRIS = ['High', 'Normal', 'Whenever'];
const WHERES = ['Outdoor', 'Indoor', 'Anywhere'];
const RECURS = { none: 'Doesn’t repeat', weekend: 'Every weekend', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' };
const DURS = [[30, '30m'], [60, '1h'], [120, '2h'], [180, '3h'], [240, '4h']];

/* ---------- Storage ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('wv:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('wv:' + k, JSON.stringify(v)); } catch { /* storage full or blocked */ } }
};
let tasks = LS.get('tasks', null);
let acts = LS.get('acts', null);
let settings = Object.assign({ rainPct: 50, windKmh: 25, locMode: 'auto', fixedLoc: null, reminderMin: 30, calDefault: true, todoSync: true }, LS.get('settings', {}));
let wxCache = LS.get('weather', null);
let syncMeta = Object.assign({ last: null, pendingDeletes: [], pendingTodoDeletes: [] }, LS.get('sync', {}));
const ui = { filter: 'All', wxOpen: false, syncMsgs: [], syncing: false, signedIn: false, account: null, sheet: null, form: null, wxError: '' };
function save() { LS.set('tasks', tasks); LS.set('acts', acts); LS.set('settings', settings); LS.set('sync', syncMeta); }

/* ---------- Helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const fmtD = s => s ? parseISO(s).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
const dayShort = s => parseISO(s).toLocaleDateString('en-NZ', { weekday: 'short' });
const dayLong = s => parseISO(s).toLocaleDateString('en-NZ', { weekday: 'long' });
function fmtT(t) { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; }
function addMins(date, time, mins) { const [y, mo, d] = date.split('-').map(Number); const [h, m] = time.split(':').map(Number); const x = new Date(y, mo - 1, d, h, m + mins); return { date: iso(x), time: `${pad(x.getHours())}:${pad(x.getMinutes())}` }; }
const durLabel = m => m < 60 ? `${m} min` : (m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`);
const slotFor = t => { if (!t) return null; const h = +t.split(':')[0]; return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'; };
function weekend() {
  const d = new Date(); const wd = d.getDay(); const sat = new Date(d);
  if (wd === 0) sat.setDate(d.getDate() - 1); else sat.setDate(d.getDate() + (6 - wd));
  return [iso(sat), addDays(iso(sat), 1)];
}
function nextDate(date, recur) {
  if (recur === 'weekly') return addDays(date, 7);
  if (recur === 'fortnightly') return addDays(date, 14);
  if (recur === 'monthly') { const d = parseISO(date); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return iso(d); }
  if (recur === 'weekend') { const wd = parseISO(date).getDay(); if (wd === 6 || wd === 0) return addDays(date, 7); return addDays(date, 6 - wd); }
  return date;
}
function newTask(o) {
  const now = Date.now();
  return Object.assign({ id: uid(), title: '', notes: '', date: '', time: '', dur: 60, pri: 'Normal', where: 'Anywhere', recur: 'none', cal: false, done: false, createdAt: now, updatedAt: now, source: 'app' }, o);
}

/* ---------- First launch sample data ---------- */
if (!tasks) {
  const [sat, sun] = weekend();
  tasks = [
    newTask({ title: 'Mow the lawns', date: sat, time: '10:00', dur: 60, pri: 'High', where: 'Outdoor', sample: true }),
    newTask({ title: 'Clean the BBQ', date: sun, time: '14:00', dur: 60, where: 'Outdoor', sample: true }),
    newTask({ title: 'Water the vege garden', date: sat, time: '08:00', dur: 30, pri: 'Whenever', where: 'Outdoor', recur: 'weekend', sample: true }),
    newTask({ title: 'Sort the garage shelves', date: sat, pri: 'Whenever', where: 'Indoor', sample: true })
  ];
  acts = [
    { id: uid(), title: 'Morning walk and coffee', date: sat, slot: 'Morning', where: 'Outdoor', done: false, sample: true },
    { id: uid(), title: 'Movie night', date: sun, slot: 'Evening', where: 'Indoor', done: false, sample: true }
  ];
  save();
}
acts = acts || [];

/* ---------- Weather (Open-Meteo, no key needed) ---------- */
function wxEmoji(code) {
  if (code === 0) return '☀️'; if (code <= 2) return '🌤️'; if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️'; if (code >= 51 && code <= 57) return '🌦️';
  if (code >= 61 && code <= 67) return '🌧️'; if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️'; if (code >= 85 && code <= 86) return '🌨️'; if (code >= 95) return '⛈️';
  return '🌤️';
}
async function getLoc() {
  if (settings.locMode === 'auto' && navigator.geolocation) {
    try {
      const p = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 3600e3 }));
      return { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: 'Your location' };
    } catch { /* fall through to fixed location */ }
  }
  return settings.fixedLoc || CFG.fallbackLocation || { name: 'Tauranga', lat: -37.6878, lon: 176.1651 };
}
async function loadWeather(force) {
  if (!force && wxCache && Date.now() - wxCache.at < 30 * 60e3) return;
  try {
    const loc = await getLoc();
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      '&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max' +
      '&timezone=auto&forecast_days=14';
    const r = await fetch(u);
    if (!r.ok) throw new Error('Forecast service returned ' + r.status);
    const j = await r.json();
    const days = {};
    j.daily.time.forEach((d, i) => {
      days[d] = { hi: Math.round(j.daily.temperature_2m_max[i]), lo: Math.round(j.daily.temperature_2m_min[i]),
        rain: j.daily.precipitation_probability_max[i] ?? 0, wind: Math.round(j.daily.wind_speed_10m_max[i] ?? 0), code: j.daily.weather_code[i], slots: {} };
    });
    const acc = {};
    j.hourly.time.forEach((t, i) => {
      const date = t.slice(0, 10), h = +t.slice(11, 13);
      const s = SLOTS.find(x => h >= x.from && h <= x.to); if (!s || !days[date]) return;
      const k = date + '|' + s.name; const a = acc[k] || (acc[k] = { temps: [], rain: 0, wind: 0, code: 0 });
      a.temps.push(j.hourly.temperature_2m[i]); a.rain = Math.max(a.rain, j.hourly.precipitation_probability[i] ?? 0);
      a.wind = Math.max(a.wind, j.hourly.wind_speed_10m[i] ?? 0); a.code = Math.max(a.code, j.hourly.weather_code[i] ?? 0);
    });
    Object.entries(acc).forEach(([k, a]) => { const [date, name] = k.split('|');
      days[date].slots[name] = { t: Math.round(a.temps.reduce((x, y) => x + y, 0) / a.temps.length), rain: a.rain, wind: Math.round(a.wind), code: a.code }; });
    wxCache = { at: Date.now(), loc, days }; LS.set('weather', wxCache); ui.wxError = '';
  } catch (e) {
    ui.wxError = wxCache ? 'Showing the last forecast — couldn’t refresh just now.' : 'Forecast unavailable offline. It will load when you’re connected.';
  }
  render();
}
function wxFor(date, time) {
  const day = wxCache?.days?.[date]; if (!day) return null;
  const s = slotFor(time);
  if (s && day.slots[s]) return { ...day.slots[s], slot: s };
  return { t: day.hi, rain: day.rain, wind: day.wind, code: day.code, slot: null };
}
const isBad = w => !!w && (w.rain >= settings.rainPct || w.wind >= settings.windKmh);
function badReason(w) { const r = []; if (w.rain >= settings.rainPct) r.push(`${w.rain}% rain`); if (w.wind >= settings.windKmh) r.push(`${w.wind} km/h wind`); return r.join(', '); }
function bestSlot() {
  let best = null; const now = new Date(); const td = today();
  weekend().forEach(d => SLOTS.forEach(s => {
    if (d < td || (d === td && now.getHours() > s.to)) return;
    const w = wxCache?.days?.[d]?.slots?.[s.name]; if (!w) return;
    const score = w.rain + Math.max(0, w.wind - 15) * 2;
    if (!best || score < best.score) best = { date: d, slot: s.name, score, w };
  }));
  return best;
}

/* ---------- Microsoft sign-in and Graph ---------- */
const SCOPES = ['User.Read', 'Mail.ReadWrite', 'Calendars.ReadWrite', 'Tasks.ReadWrite'];
const IANA = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Pacific/Auckland';
const WIN_TZ = { 'Pacific/Auckland': 'New Zealand Standard Time', 'Pacific/Chatham': 'Chatham Islands Standard Time',
  'Australia/Sydney': 'AUS Eastern Standard Time', 'Australia/Melbourne': 'AUS Eastern Standard Time', 'Australia/Brisbane': 'E. Australia Standard Time',
  'Europe/London': 'GMT Standard Time', 'UTC': 'UTC' };
const TZ = WIN_TZ[IANA] || IANA;
let msalApp = null;
const configured = () => !!(CFG.clientId && window.msal);

async function initAuth() {
  if (!configured()) return;
  msalApp = new msal.PublicClientApplication({
    auth: { clientId: CFG.clientId, authority: 'https://login.microsoftonline.com/consumers',
      redirectUri: location.origin + location.pathname, navigateToLoginRequestUrl: false },
    cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: true }
  });
  try {
    const r = await msalApp.handleRedirectPromise();
    if (r && r.account) { msalApp.setActiveAccount(r.account); toast('Outlook connected'); }
  } catch (e) { toast('Sign-in didn’t finish. Tap Connect Outlook to try again.'); }
  const acc = msalApp.getActiveAccount() || msalApp.getAllAccounts()[0];
  if (acc) { msalApp.setActiveAccount(acc); ui.signedIn = true; ui.account = acc; }
}
function signIn() {
  if (!configured()) { openSheet('setup'); return; }
  msalApp.loginRedirect({ scopes: SCOPES, prompt: 'select_account' });
}
async function signOut() {
  if (!msalApp) return;
  const account = msalApp.getActiveAccount();
  // Clears the sign-in on this phone without leaving the app
  await msalApp.logoutRedirect({ account, onRedirectNavigate: () => false });
  ui.signedIn = false; ui.account = null;
  tasks.forEach(t => { t.dirty = false; t.todoDirty = false; });
  save(); closeSheet(); render(); toast('Outlook disconnected');
}
async function token() {
  const account = msalApp.getActiveAccount();
  try { return (await msalApp.acquireTokenSilent({ scopes: SCOPES, account })).accessToken; }
  catch (e) {
    if (e instanceof msal.InteractionRequiredAuthError) { await msalApp.acquireTokenRedirect({ scopes: SCOPES, account }); }
    throw e;
  }
}
async function g(path, { method = 'GET', body } = {}) {
  const tk = await token();
  const r = await fetch(path.startsWith('http') ? path : 'https://graph.microsoft.com/v1.0' + path, {
    method, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', Prefer: `outlook.timezone="${TZ}", outlook.body-content-type="text"` },
    body: body ? JSON.stringify(body) : undefined
  });
  if (r.status === 204) return null;
  if (!r.ok) { const err = new Error('Outlook returned ' + r.status); err.status = r.status; try { err.detail = (await r.json()).error?.message; } catch { /* no body */ } throw err; }
  return r.json();
}

/* Calendar: app -> Outlook */
function eventBody(t) {
  const subject = (t.done && t.recur === 'none' ? 'Done: ' : '') + t.title;
  const body = { contentType: 'text', content: (t.notes ? t.notes + '\n\n' : '') + 'Added by Weekend Vibes' };
  if (t.time) {
    const end = addMins(t.date, t.time, t.dur || 60);
    return { subject, body, categories: [CAT], showAs: 'busy',
      start: { dateTime: `${t.date}T${t.time}:00`, timeZone: TZ }, end: { dateTime: `${end.date}T${end.time}:00`, timeZone: TZ },
      isAllDay: false, isReminderOn: settings.reminderMin > 0, reminderMinutesBeforeStart: settings.reminderMin || 0 };
  }
  return { subject, body, categories: [CAT], showAs: 'free', isAllDay: true,
    start: { dateTime: `${t.date}T00:00:00`, timeZone: TZ }, end: { dateTime: `${addDays(t.date, 1)}T00:00:00`, timeZone: TZ },
    isReminderOn: settings.reminderMin > 0, reminderMinutesBeforeStart: settings.reminderMin > 0 ? 15 * 60 : 0 };
}
async function pushTask(t) {
  if (!ui.signedIn) { t.dirty = true; return; }
  if (!t.cal || !t.date) {
    if (t.eventId) { try { await g(`/me/events/${t.eventId}`, { method: 'DELETE' }); } catch (e) { if (e.status !== 404) throw e; } t.eventId = null; t.evMod = null; }
    t.dirty = false; return;
  }
  const body = eventBody(t); let ev = null;
  if (t.eventId) { try { ev = await g(`/me/events/${t.eventId}`, { method: 'PATCH', body }); } catch (e) { if (e.status === 404) t.eventId = null; else throw e; } }
  if (!t.eventId) { ev = await g('/me/events', { method: 'POST', body }); t.eventId = ev.id; }
  t.evMod = ev.lastModifiedDateTime; t.dirty = false;
}
async function pushFlag(t) {
  if (!ui.signedIn || !t.emailId) return;
  t.emailPending = true;
  try { await g(`/me/messages/${t.emailId}`, { method: 'PATCH', body: { flag: { flagStatus: t.done ? 'complete' : 'flagged' } } }); t.emailPending = false; }
  catch (e) { if (e.status === 404) { t.emailPending = false; t.emailId = null; } }
}

/* Calendar: Outlook -> app */
function fromEvent(e) {
  const sd = e.start.dateTime, ed = e.end.dateTime;
  const date = sd.slice(0, 10);
  const time = e.isAllDay ? '' : sd.slice(11, 16);
  const dur = e.isAllDay ? 60 : Math.max(15, Math.round((Date.parse(ed.slice(0, 19) + 'Z') - Date.parse(sd.slice(0, 19) + 'Z')) / 60000));
  return { date, time, dur, title: (e.subject || 'Untitled').replace(/^Done:\s*/i, '') };
}
async function pullCalendar(msgs) {
  const start = addDays(today(), -7), end = addDays(today(), 120);
  let url = `/me/calendarView?startDateTime=${start}T00:00:00&endDateTime=${end}T23:59:59` +
    '&$select=id,subject,start,end,isAllDay,categories,lastModifiedDateTime,isCancelled&$top=250';
  const evs = [];
  while (url) { const j = await g(url); evs.push(...j.value.filter(e => (e.categories || []).includes(CAT) && !e.isCancelled)); url = j['@odata.nextLink'] || null; }
  const byId = new Map(evs.map(e => [e.id, e]));
  for (const t of tasks.filter(x => x.eventId)) {
    const e = byId.get(t.eventId);
    if (!e) {
      if (t.date >= start && t.date <= end && !t.dirty) {
        t.eventId = null; t.evMod = null; t.cal = false; t.olChanged = true;
        msgs.push(`${t.title}: removed from your calendar — task kept`);
      }
      continue;
    }
    byId.delete(t.eventId);
    if (e.lastModifiedDateTime === t.evMod) continue;
    if (t.dirty && t.updatedAt > Date.parse(e.lastModifiedDateTime)) continue; // the app's edit is newer
    const r = fromEvent(e); const ch = [];
    if (r.date !== t.date) ch.push('moved to ' + fmtD(r.date));
    if (r.time !== t.time) ch.push(r.time ? 'now ' + fmtT(r.time) : 'now all day');
    if (r.time && r.dur !== t.dur) ch.push(durLabel(r.dur));
    if (r.title !== t.title) ch.push(`renamed from “${t.title}”`);
    Object.assign(t, { date: r.date, time: r.time, dur: r.time ? r.dur : t.dur, title: r.title, evMod: e.lastModifiedDateTime, dirty: false });
    if (ch.length) { t.olChanged = true; msgs.push(`${t.title}: ${ch.join(', ')}`); }
  }
  for (const e of byId.values()) {
    const r = fromEvent(e);
    tasks.push(newTask({ ...r, source: 'outlook', cal: true, eventId: e.id, evMod: e.lastModifiedDateTime, olChanged: true }));
    msgs.push(`New from your calendar: ${r.title} (${fmtD(r.date)}${r.time ? ', ' + fmtT(r.time) : ''})`);
  }
}
/* Flagged email -> tasks */
async function syncEmail(msgs) {
  for (const t of tasks.filter(x => x.emailPending)) await pushFlag(t);
  const j = await g("/me/messages?$filter=flag/flagStatus eq 'flagged'&$select=id,subject,from,flag,webLink&$top=100");
  const ids = new Set();
  for (const m of j.value) {
    ids.add(m.id);
    const t = tasks.find(x => x.emailId === m.id);
    const due = m.flag?.dueDateTime?.dateTime?.slice(0, 10) || '';
    if (!t) {
      tasks.push(newTask({ title: m.subject || '(no subject)', source: 'email', emailId: m.id, emailLink: m.webLink,
        from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || '', date: due }));
      msgs.push(`New flagged email: ${m.subject || '(no subject)'}`);
    } else if (t.done) { t.done = false; t.doneAt = null; msgs.push(`${t.title}: flagged again in Outlook`); }
  }
  for (const t of tasks.filter(x => x.emailId && !x.done && !ids.has(x.emailId))) {
    t.done = true; t.doneAt = Date.now(); msgs.push(`${t.title}: flag cleared in Outlook`);
  }
}
/* Microsoft To Do <-> tasks */
const IMP_TO_PRI = { high: 'High', normal: 'Normal', low: 'Whenever' };
const PRI_TO_IMP = { High: 'high', Normal: 'normal', Whenever: 'low' };
const todoPath = t => `/me/todo/lists/${encodeURIComponent(t.todoList)}/tasks/${encodeURIComponent(t.todoId)}`;
function todoDate(d) {
  if (!d || !d.dateTime) return '';
  const tz = (d.timeZone || '').toUpperCase();
  if (tz === 'UTC' || tz === 'ETC/UTC' || tz === 'COORDINATED UNIVERSAL TIME') return iso(new Date(d.dateTime.slice(0, 19) + 'Z'));
  return d.dateTime.slice(0, 10);
}
function todoBody(t) {
  return { title: t.title, importance: PRI_TO_IMP[t.pri] || 'normal', status: t.done ? 'completed' : 'notStarted',
    dueDateTime: t.date ? { dateTime: `${t.date}T00:00:00`, timeZone: TZ } : null,
    body: { contentType: 'text', content: t.notes || '' } };
}
async function pushTodo(t) {
  if (!ui.signedIn || !t.todoId) return;
  try {
    const x = await g(todoPath(t), { method: 'PATCH', body: todoBody(t) });
    t.todoMod = x && x.lastModifiedDateTime; t.todoDirty = false;
  } catch (e) {
    if (e.status === 404) { t.todoId = null; t.todoList = null; t.todoDirty = false; } else throw e;
  }
}
function applyTodo(x, list, msgs) {
  const r = { title: x.title || '(untitled)', date: todoDate(x.dueDateTime), pri: IMP_TO_PRI[x.importance] || 'Normal',
    notes: (x.body && x.body.content || '').trim() };
  let t = tasks.find(y => y.todoId === x.id);
  if (!t) {
    tasks.push(newTask({ ...r, source: 'todo', todoId: x.id, todoList: list.id, listName: list.displayName, todoMod: x.lastModifiedDateTime, cal: false }));
    msgs.push(`New from To Do (${list.displayName}): ${r.title}`);
    return;
  }
  t.todoList = list.id; t.listName = list.displayName;
  if (t.todoDirty) return; // the app has a newer change waiting to go up
  if (t.done) { t.done = false; t.doneAt = null; msgs.push(`${t.title}: reopened in To Do`); }
  if (x.lastModifiedDateTime === t.todoMod) return;
  const ch = [];
  if (r.title !== t.title) ch.push(`renamed from “${t.title}”`);
  if (r.date !== t.date) ch.push(r.date ? 'now due ' + fmtD(r.date) : 'due date removed');
  if (r.pri !== t.pri) ch.push(r.pri.toLowerCase() + ' priority');
  if (r.notes !== (t.notes || '').trim()) ch.push('notes updated');
  Object.assign(t, { title: r.title, date: r.date, pri: r.pri, notes: r.notes, todoMod: x.lastModifiedDateTime });
  if (ch.length) { t.olChanged = true; if (t.cal) { t.dirty = true; t.updatedAt = Date.now(); } msgs.push(`${t.title}: ${ch.join(', ')}`); }
}
async function getAll(url) {
  const out = [];
  while (url) { const j = await g(url); out.push(...j.value); url = j['@odata.nextLink'] || null; }
  return out;
}
async function pullTodo(msgs) {
  if (!settings.todoSync) return;
  // Skip To Do's automatic "Flagged email" list: those already come in as flagged-email tasks
  const lists = (await getAll('/me/todo/lists?$top=100')).filter(l => l.wellknownListName !== 'flaggedEmails');
  const seen = new Set(), readOk = new Set();
  for (const l of lists) {
    const base = `/me/todo/lists/${encodeURIComponent(l.id)}/tasks`;
    let items;
    try { items = await getAll(`${base}?$filter=status ne 'completed'&$top=100`); }
    catch (e) {
      if (e.status === 401 || e.status === 403) throw e;
      try { items = (await getAll(`${base}?$top=100`)).filter(x => x.status !== 'completed'); } catch { continue; }
    }
    readOk.add(l.id);
    items.forEach(x => { seen.add(x.id); applyTodo(x, l, msgs); });
  }
  const listIds = new Set(lists.map(l => l.id));
  for (const t of tasks.filter(x => x.todoId)) {
    if (!listIds.has(t.todoList)) { t.todoId = null; t.todoList = null; continue; } // list was deleted
    if (readOk.has(t.todoList) && !seen.has(t.todoId) && !t.done && !t.todoDirty) {
      t.done = true; t.doneAt = Date.now(); msgs.push(`${t.title}: completed in To Do`);
    }
  }
}
async function syncAll(manual) {
  if (!ui.signedIn || ui.syncing) { if (manual && !ui.signedIn) signIn(); return; }
  ui.syncing = true; render();
  const msgs = [];
  try {
    for (const id of [...syncMeta.pendingDeletes]) {
      try { await g(`/me/events/${id}`, { method: 'DELETE' }); } catch (e) { if (e.status !== 404) continue; }
      syncMeta.pendingDeletes = syncMeta.pendingDeletes.filter(x => x !== id);
    }
    for (const d of [...syncMeta.pendingTodoDeletes]) {
      try { await g(`/me/todo/lists/${encodeURIComponent(d.list)}/tasks/${encodeURIComponent(d.id)}`, { method: 'DELETE' }); } catch (e) { if (e.status !== 404) continue; }
      syncMeta.pendingTodoDeletes = syncMeta.pendingTodoDeletes.filter(x => x.id !== d.id);
    }
    for (const t of tasks.filter(x => x.todoDirty)) { try { await pushTodo(t); } catch { /* stays queued */ } }
    await pullTodo(msgs);
    await pullCalendar(msgs);
    for (const t of tasks.filter(x => x.dirty)) { try { await pushTask(t); } catch { /* stays queued */ } }
    await syncEmail(msgs);
    syncMeta.last = Date.now();
    ui.syncMsgs = msgs;
    if (manual && !msgs.length) toast('Everything’s up to date');
  } catch (e) {
    if (e.status === 401 || e.status === 403) toast('Outlook needs you to sign in again. Tap Connect Outlook in Settings.');
    else if (e.name !== 'BrowserAuthError') toast('Couldn’t reach Outlook. Your changes will sync next time.');
  }
  ui.syncing = false; save(); render();
}

/* ---------- Actions ---------- */
async function commit(t, { quiet } = {}) {
  t.updatedAt = Date.now(); t.dirty = true; t.olChanged = false;
  if (t.todoId) t.todoDirty = true;
  save(); render();
  if (ui.signedIn && t.todoId) {
    try { await pushTodo(t); save(); render(); }
    catch { if (!quiet) toast('Saved. It’ll sync to To Do when Outlook is reachable.'); }
  }
  if (ui.signedIn && (t.cal || t.eventId)) {
    try { await pushTask(t); save(); render(); }
    catch { if (!quiet) toast('Saved. It’ll sync to your calendar when Outlook is reachable.'); }
  }
}
async function toggleTask(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  if (!t.done && t.recur !== 'none' && t.date) {
    t.date = nextDate(t.date, t.recur);
    toast(`Done. Next one is ${fmtD(t.date)}`);
    await commit(t); return;
  }
  t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
  if (t.emailId) { save(); render(); await pushFlag(t); toast(t.done ? 'Flag marked complete in Outlook' : 'Email flagged again in Outlook'); save(); return; }
  if (t.todoId) toast(t.done ? 'Marked complete in To Do' : 'Reopened in To Do');
  else if (t.done) toast('Nice one');
  await commit(t);
}
function moveTask(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  const [sat, sun] = weekend(); const other = t.date === sun ? sat : sun;
  t.date = other; commit(t);
  toast(`${t.title} moved to ${dayLong(other)}${t.cal && ui.signedIn ? ' — calendar updated' : ''}`);
}
async function deleteTask(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  tasks = tasks.filter(x => x !== t);
  if (t.eventId) {
    if (ui.signedIn) { try { await g(`/me/events/${t.eventId}`, { method: 'DELETE' }); } catch (e) { if (e.status !== 404) syncMeta.pendingDeletes.push(t.eventId); } }
    else syncMeta.pendingDeletes.push(t.eventId);
  }
  if (t.todoId) {
    const d = { list: t.todoList, id: t.todoId };
    if (ui.signedIn) { try { await g(`/me/todo/lists/${encodeURIComponent(d.list)}/tasks/${encodeURIComponent(d.id)}`, { method: 'DELETE' }); } catch (e) { if (e.status !== 404) syncMeta.pendingTodoDeletes.push(d); } }
    else syncMeta.pendingTodoDeletes.push(d);
  }
  save(); closeSheet(); render();
  toast(`Deleted${t.todoId ? ' — also removed from To Do' : ''}${t.eventId ? ' — removed from your calendar' : ''}`);
}
function toggleAct(id) { const a = acts.find(x => x.id === id); if (!a) return; a.done = !a.done; save(); render(); }
function moveAct(id) {
  const a = acts.find(x => x.id === id); const b = bestSlot(); if (!a || !b) return;
  a.date = b.date; a.slot = b.slot; save(); render();
  toast(`${a.title} moved to ${dayLong(b.date)} ${b.slot.toLowerCase()}`);
}
function clearSamples() {
  tasks = tasks.filter(t => !t.sample); acts = acts.filter(a => !a.sample); save(); render(); toast('Sample items cleared');
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg) {
  const r = document.getElementById('toast-root');
  r.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { r.innerHTML = ''; }, 3200);
}

/* ---------- Icons ---------- */
const I = {
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>'
};

/* ---------- Rendering ---------- */
function wxCardHtml() {
  const [sat, sun] = weekend();
  const loc = wxCache?.loc?.name || (settings.locMode === 'auto' ? 'Your location' : (settings.fixedLoc?.name || CFG.fallbackLocation?.name || ''));
  const d = date => {
    const w = wxCache?.days?.[date];
    if (!w) return `<div class="wx-day"><span class="wx-emoji" aria-hidden="true">🌤️</span><div><div class="wx-name">${dayLong(date)}</div><div class="wx-meta">Loading…</div></div></div>`;
    return `<div class="wx-day"><span class="wx-emoji" aria-hidden="true">${wxEmoji(w.code)}</span><div>
      <div class="wx-name">${dayLong(date)}</div><div class="wx-temp">${w.hi}° <small>${w.lo}°</small></div>
      <div class="wx-meta">${w.rain}% rain · ${w.wind} km/h</div></div></div>`;
  };
  let detail = '';
  if (ui.wxOpen && wxCache) {
    [sat, sun].forEach(date => {
      const w = wxCache.days[date]; if (!w) return;
      detail += `<div class="wx-label">${dayLong(date)}</div><div class="wx-slots">${SLOTS.map(s => { const x = w.slots[s.name]; if (!x) return '';
        return `<div class="wx-slot ${isBad(x) ? 'bad' : ''}">${s.name}<b aria-hidden="true">${wxEmoji(x.code)}</b>${x.t}° · ${x.rain}%<br>${x.wind} km/h</div>`; }).join('')}</div>`;
    });
    const b = bestSlot();
    if (b) detail += `<p class="wx-tip">Best window for outdoor jobs: ${dayLong(b.date)} ${b.slot.toLowerCase()}, ${b.w.rain}% chance of rain.</p>`;
  }
  return `<button class="wx" data-act="wx" aria-expanded="${ui.wxOpen}">
    <div class="wx-head"><span>${esc(loc)} · this weekend</span><span>${ui.wxOpen ? 'Hide detail' : 'Show detail'}</span></div>
    <div class="wx-days">${d(sat)}${d(sun)}</div>${detail}
    ${ui.wxError ? `<p class="wx-tip" style="color:var(--sun-soft)">${esc(ui.wxError)}</p>` : ''}</button>`;
}
function taskHtml(t) {
  const w = t.date ? wxFor(t.date, t.time) : null;
  const clash = !t.done && t.where === 'Outdoor' && isBad(w);
  const [sat, sun] = weekend();
  const td = today();
  const due = !t.done && t.date ? (t.date < td ? '<span class="chip c-overdue">Overdue</span>' : t.date === td ? '<span class="chip c-today">Today</span>' : '') : '';
  const canMove = clash && (t.date === sat || t.date === sun);
  const otherW = canMove ? wxFor(t.date === sat ? sun : sat, t.time) : null;
  return `<div class="item ${t.done ? 'done' : ''}">
    <button class="ck" role="checkbox" aria-checked="${t.done}" aria-label="Mark ${esc(t.title)} ${t.done ? 'not done' : 'done'}" data-act="toggle" data-id="${t.id}">${t.done ? I.check : ''}</button>
    <button class="body" data-act="edit" data-id="${t.id}" aria-label="Edit ${esc(t.title)}">
      <div class="title">${esc(t.title)}</div>
      <div class="meta">
        ${t.emailId ? `<span class="chip c-mail">✉ ${esc(t.from || 'Email')}</span>` : ''}
        ${t.todoId ? `<span class="chip c-todo">☑ ${esc(t.listName || 'To Do')}</span>` : ''}
        ${t.olChanged ? `<span class="chip c-ol">Updated in ${t.todoId ? 'To Do' : 'Outlook'}</span>` : ''}
        ${due}<span class="chip c-${t.pri}">${t.pri}</span>
        ${t.date ? `<span>${fmtD(t.date)}${t.time ? ', ' + fmtT(t.time) : ''}</span>` : ''}
        ${w ? `<span>${wxEmoji(w.code)} ${w.rain}%</span>` : ''}
        ${t.where !== 'Anywhere' ? `<span>${t.where}</span>` : ''}
        ${t.recur !== 'none' ? `<span>↻ ${RECURS[t.recur]}</span>` : ''}
        ${t.cal ? `<span>${!ui.signedIn ? '📅 Waiting to sync' : t.dirty ? '📅 Syncing' : '📅 In calendar'}</span>` : ''}
      </div>
    </button></div>
    ${clash ? `<div class="warn" style="margin:-4px 0 10px 40px"><span>${esc(badReason(w))} ${t.time ? 'then' : 'that day'}</span>${canMove && otherW && !isBad(otherW) ? `<button data-act="move" data-id="${t.id}">Move to ${dayLong(t.date === sat ? sun : sat)}</button>` : ''}</div>` : ''}`;
}
function actHtml(a) {
  const w = wxCache?.days?.[a.date]?.slots?.[a.slot];
  const clash = !a.done && a.where === 'Outdoor' && isBad(w);
  const b = clash ? bestSlot() : null;
  const better = b && !(b.date === a.date && b.slot === a.slot) && !isBad(b.w);
  return `<div class="item plan ${a.done ? 'done' : ''}">
    <button class="ck" role="checkbox" aria-checked="${a.done}" aria-label="Mark ${esc(a.title)} ${a.done ? 'not done' : 'done'}" data-act="toggle-act" data-id="${a.id}">${a.done ? I.check : ''}</button>
    <button class="body" data-act="edit-act" data-id="${a.id}" aria-label="Edit ${esc(a.title)}">
      <div class="title">${esc(a.title)}</div>
      <div class="meta"><span class="chip c-slot">${dayShort(a.date)} ${a.slot.toLowerCase()}</span><span>${a.where}</span>
      ${w ? `<span>${wxEmoji(w.code)} ${w.t}° · ${w.rain}%</span>` : ''}</div>
    </button></div>
    ${clash ? `<div class="warn" style="margin:-4px 0 10px 40px"><span>${esc(badReason(w))}</span>${better ? `<button data-act="move-act" data-id="${a.id}">Try ${dayShort(b.date)} ${b.slot.toLowerCase()}</button>` : ''}</div>` : ''}`;
}
function render() {
  const [sat, sun] = weekend(); const td = today();
  const open = tasks.filter(t => !t.done);
  const clashes = open.filter(t => t.where === 'Outdoor' && isBad(t.date && wxFor(t.date, t.time))).length +
    acts.filter(a => !a.done && a.where === 'Outdoor' && isBad(wxCache?.days?.[a.date]?.slots?.[a.slot])).length;
  const overdue = open.filter(t => t.date && t.date < td).length, dueToday = open.filter(t => t.date === td).length;
  const pending = tasks.some(t => t.dirty && t.cal) || syncMeta.pendingDeletes.length;
  const visActs = acts.filter(a => a.date >= sat).sort((a, b) => (a.date + SLOTS.findIndex(s => s.name === a.slot)).localeCompare(b.date + SLOTS.findIndex(s => s.name === b.slot)));
  const f = ui.filter;
  const list = tasks.filter(t => f === 'All' || (f === 'To do' && !t.done) || (f === 'Outdoor' && t.where === 'Outdoor' && !t.done) ||
    (f === 'Due' && t.date && !t.done) || (f === 'From To Do' && t.todoId && !t.done) || (f === 'Completed' && t.done))
    .sort((a, b) => (a.done - b.done) || ((a.date || '9999') + (a.time || '99')).localeCompare((b.date || '9999') + (b.time || '99')) || PRIS.indexOf(a.pri) - PRIS.indexOf(b.pri));
  const b = bestSlot();
  const lastSync = syncMeta.last ? new Date(syncMeta.last).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' }) : null;

  document.getElementById('app').innerHTML = `
  <header class="top">
    <div class="brand"><div class="sunmark" aria-hidden="true"></div><div><h1>Weekend Vibes</h1>
      <div class="sub">${fmtD(sat)} – ${fmtD(sun)}${ui.signedIn && lastSync ? ` · synced ${lastSync}` : ''}</div></div></div>
    <div style="display:flex;gap:8px">
      <button class="iconbtn ${ui.syncing ? 'spin' : ''} ${pending && ui.signedIn ? 'attn' : ''}" data-act="sync" aria-label="${ui.signedIn ? 'Sync with Outlook' : 'Connect Outlook'}">${I.refresh}</button>
      <button class="iconbtn" data-act="settings" aria-label="Settings">${I.gear}</button>
    </div>
  </header>
  ${wxCardHtml()}
  ${ui.syncMsgs.length ? `<div class="note sync"><div><b>${ui.syncMsgs.length} change${ui.syncMsgs.length > 1 ? 's' : ''} from Outlook and To Do</b>${ui.syncMsgs.slice(0, 8).map(m => `<p>${esc(m)}</p>`).join('')}${ui.syncMsgs.length > 8 ? `<p>…and ${ui.syncMsgs.length - 8} more</p>` : ''}</div><button class="x" data-act="dismiss-sync" aria-label="Dismiss">×</button></div>` : ''}
  ${overdue || dueToday ? `<div class="note due"><p>${[overdue ? `<b>${overdue} overdue</b>` : '', dueToday ? `<b>${dueToday} due today</b>` : ''].filter(Boolean).join(' and ')}</p></div>` : ''}
  ${!ui.signedIn ? `<div class="note connect"><p>Bring in flagged emails and sync tasks with your Hotmail calendar.</p><button class="btn btn-foam btn-sm" data-act="connect">Connect Outlook</button></div>` : ''}
  ${tasks.some(t => t.sample) || acts.some(a => a.sample) ? `<div class="note sample"><p>These are sample items to show how things work.</p><button class="btn btn-ghost btn-sm" data-act="clear-samples">Clear samples</button></div>` : ''}
  <div class="pills">
    <span class="pill p-plan">${visActs.filter(a => !a.done).length} plans</span>
    <span class="pill p-todo">${open.length} to do</span>
    <span class="pill p-done">${tasks.length - open.length} done</span>
    ${ui.signedIn ? `<span class="pill p-sync">${tasks.filter(t => t.cal).length} in calendar</span>` : ''}
    ${clashes ? `<span class="pill p-clash">${clashes} weather clash${clashes > 1 ? 'es' : ''}</span>` : ''}
  </div>
  <div class="actions">
    <button class="btn btn-sun" data-act="new-act">＋ Add activity</button>
    <button class="btn btn-foam" data-act="new-task">＋ Add task</button>
  </div>
  <div class="sec"><h2>Weekend plans</h2>${b ? `<span>Driest: ${dayShort(b.date)} ${b.slot.toLowerCase()}</span>` : ''}</div>
  ${visActs.map(actHtml).join('') || '<p class="empty">Nothing planned yet. Add something fun for the weekend.</p>'}
  <div class="sec"><h2>Tasks</h2></div>
  <div class="tabs" role="group" aria-label="Filter tasks">${['All', 'To do', 'Outdoor', 'Due', ...(tasks.some(t => t.todoId) ? ['From To Do'] : []), 'Completed'].map(x => `<button class="tab" aria-pressed="${f === x}" data-act="filter" data-v="${x}">${x}</button>`).join('')}</div>
  ${list.map(taskHtml).join('') || `<p class="empty">${f === 'Completed' ? 'Nothing ticked off yet.' : 'No tasks here. Tap Add task to create one.'}</p>`}
  <div class="foot"><button class="btn btn-ghost btn-sm" data-act="export">Export list</button><button class="btn btn-ghost btn-sm" data-act="settings">Settings</button></div>`;
}

/* ---------- Sheets ---------- */
const seg = (key, opts, val) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" aria-pressed="${String(val) === String(v)}" data-act="seg" data-k="${key}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
let lastFocus = null;
function openSheet(kind, id) {
  lastFocus = document.activeElement;
  const [sat] = weekend();
  if (kind === 'task') {
    const t = id ? tasks.find(x => x.id === id) : null;
    ui.form = t ? { ...t } : newTask({ date: sat, where: 'Outdoor', cal: settings.calDefault });
    ui.form.isNew = !t;
  } else if (kind === 'act') {
    const a = id ? acts.find(x => x.id === id) : null;
    ui.form = a ? { ...a } : { id: uid(), title: '', date: weekend()[1], slot: 'Afternoon', where: 'Outdoor', done: false };
    ui.form.isNew = !a;
  }
  ui.sheet = kind; renderSheet();
  setTimeout(() => (document.querySelector('.sheet [autofocus]') || document.querySelector('.sheet button,.sheet input'))?.focus(), 30);
}
function closeSheet() { ui.sheet = null; ui.form = null; document.getElementById('sheet-root').innerHTML = ''; lastFocus?.focus?.(); }
function sheetWrap(title, inner) {
  return `<div class="scrim" data-act="scrim"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="grab" aria-hidden="true"></div><h3 id="sheet-title">${title}</h3>${inner}</section></div>`;
}
function taskSheet() {
  const f = ui.form; const w = f.date ? wxFor(f.date, f.time) : null; const bad = f.where === 'Outdoor' && isBad(w);
  return sheetWrap(f.isNew ? 'New task' : 'Edit task', `
    ${f.todoId ? `<p class="hint">From your To Do list “${esc(f.listName || 'Tasks')}”. Changes to the name, due date, priority, notes or completion sync back to To Do.</p>` : ''}
    ${f.emailId ? `<p class="hint">From a flagged email${f.from ? ' from ' + esc(f.from) : ''}. ${f.emailLink ? `<a href="${esc(f.emailLink)}" target="_blank" rel="noopener">Open email</a>` : ''}</p>` : ''}
    <div class="field"><label for="f-title">Task</label><input id="f-title" class="in" data-k="title" value="${esc(f.title)}" placeholder="Pick up firewood" autocomplete="off" ${f.isNew ? 'autofocus' : ''}><div class="err" id="f-err"></div></div>
    <div class="row"><div class="field"><label for="f-date">Due date</label><input id="f-date" type="date" class="in" data-k="date" value="${esc(f.date)}"></div>
      <div class="field"><label for="f-time">Time <span style="opacity:.7">(optional)</span></label><input id="f-time" type="time" class="in" data-k="time" value="${esc(f.time)}" step="900"></div></div>
    ${f.time ? `<div class="field"><span class="lbl">How long</span>${seg('dur', DURS, f.dur)}</div>` : ''}
    <div class="field"><span class="lbl">Priority</span>${seg('pri', PRIS.map(p => [p, p]), f.pri)}</div>
    <div class="field"><span class="lbl">Setting</span>${seg('where', WHERES.map(p => [p, p]), f.where)}</div>
    <div class="field"><label for="f-recur">Repeats</label><select id="f-recur" class="in" data-k="recur">${Object.entries(RECURS).map(([k, l]) => `<option value="${k}" ${f.recur === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" class="in" data-k="notes" placeholder="Anything to remember">${esc(f.notes)}</textarea></div>
    <div class="toggle"><span id="cal-l">Add to Hotmail calendar</span><button type="button" class="sw" role="switch" aria-labelledby="cal-l" aria-checked="${f.cal}" data-act="toggle-cal"><span></span></button></div>
    ${f.cal && !f.date ? '<p class="hint warnc">Add a due date to put this in your calendar.</p>' : ''}
    ${f.cal && f.date && !f.time ? '<p class="hint">No time set, so it goes in as an all-day event.</p>' : ''}
    ${f.cal && !ui.signedIn ? '<p class="hint warnc">Syncs once Outlook is connected.</p>' : ''}
    ${w ? `<div class="wxline ${bad ? 'bad' : 'ok'}">${wxEmoji(w.code)} ${fmtD(f.date)}${f.time ? ' ' + fmtT(f.time) : ''}: ${w.t}°, ${w.rain}% rain, ${w.wind} km/h${bad ? ' — not great for outdoor work' : ' — looks good'}</div>` : ''}
    <div class="sheet-actions">${f.isNew ? '<button class="btn btn-ghost" data-act="close">Cancel</button>' : `<button class="btn btn-danger" data-act="delete-task">Delete</button>`}<button class="btn btn-foam" data-act="save-task">${f.isNew ? 'Add task' : 'Save changes'}</button></div>`);
}
function actSheet() {
  const f = ui.form; const [sat, sun] = weekend();
  const w = wxCache?.days?.[f.date]?.slots?.[f.slot]; const bad = f.where === 'Outdoor' && isBad(w);
  return sheetWrap(f.isNew ? 'New activity' : 'Edit activity', `
    <div class="field"><label for="a-title">What are you doing?</label><input id="a-title" class="in" data-k="title" value="${esc(f.title)}" placeholder="Bike ride along the waterfront" autocomplete="off" ${f.isNew ? 'autofocus' : ''}><div class="err" id="f-err"></div></div>
    <div class="field"><span class="lbl">Day</span>${seg('date', [[sat, dayLong(sat)], [sun, dayLong(sun)]], f.date)}</div>
    <div class="field"><span class="lbl">Time of day</span>${seg('slot', SLOTS.map(s => [s.name, s.name]), f.slot)}</div>
    <div class="field"><span class="lbl">Setting</span>${seg('where', [['Outdoor', 'Outdoor'], ['Indoor', 'Indoor']], f.where)}</div>
    ${w ? `<div class="wxline ${bad ? 'bad' : 'ok'}">${wxEmoji(w.code)} ${dayLong(f.date)} ${f.slot.toLowerCase()}: ${w.t}°, ${w.rain}% rain, ${w.wind} km/h${bad ? ' — might be a wet one' : ' — looks good'}</div>` : ''}
    <div class="sheet-actions">${f.isNew ? '<button class="btn btn-ghost" data-act="close">Cancel</button>' : '<button class="btn btn-danger" data-act="delete-act">Delete</button>'}<button class="btn btn-sun" data-act="save-act">${f.isNew ? 'Add activity' : 'Save changes'}</button></div>`);
}
function settingsSheet() {
  const acc = ui.account;
  return sheetWrap('Settings', `
    <div class="setgroup" style="border:none;margin-top:4px"><h4>Outlook</h4>
      ${ui.signedIn ? `<p class="hint">Connected as ${esc(acc?.username || acc?.name || 'your Microsoft account')}. To Do tasks, flagged emails and calendar events sync each time you open the app or tap refresh.</p>
        <div class="sheet-actions"><button class="btn btn-ghost" data-act="disconnect">Disconnect</button><button class="btn btn-foam" data-act="sync-now">Sync now</button></div>`
      : `<p class="hint">${configured() ? 'Not connected.' : 'Needs a one-time setup first.'}</p><div class="sheet-actions"><button class="btn btn-foam" data-act="connect">Connect Outlook</button></div>`}
      <div class="toggle"><span id="td-l">Bring in my Microsoft To Do tasks</span><button type="button" class="sw" role="switch" aria-labelledby="td-l" aria-checked="${settings.todoSync}" data-act="set-todo"><span></span></button></div>
      <div class="toggle"><span id="cd-l">Add new tasks to calendar by default</span><button type="button" class="sw" role="switch" aria-labelledby="cd-l" aria-checked="${settings.calDefault}" data-act="set-caldefault"><span></span></button></div>
      <div class="field"><label for="s-rem">Calendar reminder</label><select id="s-rem" class="in" data-set="reminderMin">${[[0, 'No reminder'], [15, '15 minutes before'], [30, '30 minutes before'], [60, '1 hour before'], [120, '2 hours before']].map(([v, l]) => `<option value="${v}" ${settings.reminderMin === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <p class="hint">All-day tasks remind you the afternoon before.</p></div>
    </div>
    <div class="setgroup"><h4>Weather</h4>
      <div class="field"><span class="lbl">Forecast location</span>${seg('locMode', [['auto', 'Use my location'], ['fixed', 'Set a town']], settings.locMode)}</div>
      ${settings.locMode === 'fixed' ? `<div class="field"><label for="s-town">Town</label><div class="row"><input id="s-town" class="in" value="${esc(settings.fixedLoc?.name || CFG.fallbackLocation?.name || '')}" autocomplete="off"><button class="btn btn-foam" style="flex:0 0 auto" data-act="find-town">Set</button></div><div class="err" id="town-err"></div></div>` : ''}
      <div class="field"><label for="s-rain">Warn about outdoor plans when rain chance is ${settings.rainPct}% or more</label><input id="s-rain" class="range" type="range" min="20" max="90" step="5" value="${settings.rainPct}" data-set="rainPct"></div>
      <div class="field"><label for="s-wind">…or wind is ${settings.windKmh} km/h or more</label><input id="s-wind" class="range" type="range" min="10" max="60" step="5" value="${settings.windKmh}" data-set="windKmh"></div>
    </div>
    <div class="setgroup"><h4>Your data</h4><p class="hint">Everything is stored on this phone. Outlook data goes only between your phone and Microsoft.</p>
      <div class="sheet-actions"><button class="btn btn-ghost" data-act="export">Export list</button><button class="btn btn-danger" data-act="clear-done">Clear completed</button></div></div>
    <div class="sheet-actions"><button class="btn btn-foam" data-act="close">Done</button></div>`);
}
function setupSheet() {
  return sheetWrap('Connect Outlook', `
    <p class="hint" style="font-size:14px">Outlook sync needs a free, one-time setup so Microsoft knows this app is yours:</p>
    <ol class="steps"><li>Host the app on GitHub Pages and open it from that web address.</li>
      <li>Register the app in the Azure portal with your Hotmail account.</li>
      <li>Paste the Application (client) ID into <code>config.js</code>.</li></ol>
    <p class="hint" style="font-size:14px">The README in the download walks through each step. Everything else in the app works without it.</p>
    <div class="sheet-actions"><button class="btn btn-foam" data-act="close">Got it</button></div>`);
}
function exportSheet() {
  return sheetWrap('Export list', `<p class="hint" style="font-size:14px">Save or share your tasks and plans.</p>
    <div class="sheet-actions" style="flex-direction:column"><button class="btn btn-foam" data-act="exp" data-v="txt">Plain text</button><button class="btn btn-ghost" data-act="exp" data-v="csv">Spreadsheet (CSV)</button><button class="btn btn-ghost" data-act="exp" data-v="md">Markdown</button><button class="btn btn-ghost" data-act="close">Cancel</button></div>`);
}
function renderSheet() {
  const r = document.getElementById('sheet-root');
  const map = { task: taskSheet, act: actSheet, settings: settingsSheet, setup: setupSheet, export: exportSheet };
  const active = document.activeElement?.id;
  r.innerHTML = ui.sheet ? map[ui.sheet]() : '';
  if (active) document.getElementById(active)?.focus();
}

/* ---------- Export ---------- */
async function doExport(kind) {
  const [sat, sun] = weekend();
  const ts = [...tasks].sort((a, b) => ((a.date || '9') + (a.time || '')).localeCompare((b.date || '9') + (b.time || '')));
  const line = t => `${t.title}${t.date ? ' — ' + fmtD(t.date) + (t.time ? ' ' + fmtT(t.time) : '') : ''} (${t.pri}${t.where !== 'Anywhere' ? ', ' + t.where.toLowerCase() : ''})`;
  const as = acts.filter(a => a.date >= sat);
  let text, mime, ext;
  if (kind === 'csv') {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    text = ['Type,Title,Date,Time,Duration (min),Priority,Setting,Repeats,Done,In calendar,Notes',
      ...ts.map(t => ['Task', t.title, t.date, t.time, t.time ? t.dur : '', t.pri, t.where, RECURS[t.recur], t.done ? 'Yes' : 'No', t.cal ? 'Yes' : 'No', t.notes].map(q).join(',')),
      ...as.map(a => ['Activity', a.title, a.date, a.slot, '', '', a.where, '', a.done ? 'Yes' : 'No', '', ''].map(q).join(','))].join('\n');
    mime = 'text/csv'; ext = 'csv';
  } else if (kind === 'md') {
    text = `# Weekend Vibes — ${fmtD(sat)} to ${fmtD(sun)}\n\n## Plans\n${as.map(a => `- [${a.done ? 'x' : ' '}] ${a.title} — ${dayShort(a.date)} ${a.slot.toLowerCase()}`).join('\n') || '- None'}\n\n## Tasks\n${ts.map(t => `- [${t.done ? 'x' : ' '}] ${line(t)}`).join('\n') || '- None'}\n`;
    mime = 'text/markdown'; ext = 'md';
  } else {
    text = `Weekend Vibes — ${fmtD(sat)} to ${fmtD(sun)}\n\nPLANS\n${as.map(a => `${a.done ? '✓' : '○'} ${a.title} — ${dayShort(a.date)} ${a.slot.toLowerCase()}`).join('\n') || 'None'}\n\nTASKS\n${ts.map(t => `${t.done ? '✓' : '○'} ${line(t)}`).join('\n') || 'None'}\n`;
    mime = 'text/plain'; ext = 'txt';
  }
  const name = `weekend-vibes-${sat}.${ext}`;
  try {
    const file = new File([text], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Weekend Vibes' }); closeSheet(); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); closeSheet(); toast('Exported');
}

/* ---------- Events ---------- */
async function onClick(e) {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if (act === 'scrim') { if (e.target === el) closeSheet(); return; }
  switch (act) {
    case 'wx': ui.wxOpen = !ui.wxOpen; render(); break;
    case 'sync': ui.signedIn ? syncAll(true) : signIn(); break;
    case 'connect': closeSheet(); signIn(); break;
    case 'disconnect': signOut(); break;
    case 'sync-now': closeSheet(); syncAll(true); break;
    case 'settings': openSheet('settings'); break;
    case 'export': openSheet('export'); break;
    case 'exp': doExport(el.dataset.v); break;
    case 'close': closeSheet(); break;
    case 'dismiss-sync': ui.syncMsgs = []; tasks.forEach(t => { t.olChanged = false; }); save(); render(); break;
    case 'clear-samples': clearSamples(); break;
    case 'clear-done': { const n = tasks.filter(t => t.done && t.recur === 'none').length; tasks = tasks.filter(t => !(t.done && t.recur === 'none')); acts = acts.filter(a => !a.done); save(); render(); toast(`Cleared ${n} completed task${n === 1 ? '' : 's'}`); break; }
    case 'filter': ui.filter = el.dataset.v; render(); break;
    case 'new-task': openSheet('task'); break;
    case 'new-act': openSheet('act'); break;
    case 'edit': openSheet('task', id); break;
    case 'edit-act': openSheet('act', id); break;
    case 'toggle': toggleTask(id); break;
    case 'toggle-act': toggleAct(id); break;
    case 'move': moveTask(id); break;
    case 'move-act': moveAct(id); break;
    case 'seg': {
      const k = el.dataset.k; let v = el.dataset.v; if (k === 'dur') v = +v;
      if (k === 'locMode') { settings.locMode = v; save(); renderSheet(); loadWeather(true); break; }
      ui.form[k] = v; renderSheet(); break;
    }
    case 'toggle-cal': ui.form.cal = !ui.form.cal; renderSheet(); break;
    case 'set-todo': settings.todoSync = !settings.todoSync; save(); renderSheet(); if (settings.todoSync) syncAll(false); break;
    case 'set-caldefault': settings.calDefault = !settings.calDefault; save(); renderSheet(); break;
    case 'find-town': findTown(); break;
    case 'save-task': {
      const f = ui.form; f.title = (f.title || '').trim();
      if (!f.title) { document.getElementById('f-err').textContent = 'Give the task a name.'; document.getElementById('f-title').focus(); return; }
      const { isNew, ...data } = f;
      let t = tasks.find(x => x.id === f.id);
      if (!t) { t = newTask(data); tasks.push(t); } else Object.assign(t, data);
      t.sample = false;
      closeSheet();
      toast(`${isNew ? 'Added' : 'Saved'}${t.cal && t.date ? (ui.signedIn ? ' — syncing to your calendar' : ' — will sync once Outlook is connected') : ''}`);
      commit(t);
      break;
    }
    case 'delete-task': deleteTask(ui.form.id); break;
    case 'save-act': {
      const f = ui.form; f.title = (f.title || '').trim();
      if (!f.title) { document.getElementById('f-err').textContent = 'Give the activity a name.'; document.getElementById('a-title').focus(); return; }
      const { isNew, ...data } = f; data.sample = false;
      const a = acts.find(x => x.id === f.id); if (a) Object.assign(a, data); else acts.push(data);
      save(); closeSheet(); render(); toast(isNew ? `${data.title} added` : 'Saved');
      break;
    }
    case 'delete-act': acts = acts.filter(x => x.id !== ui.form.id); save(); closeSheet(); render(); toast('Activity deleted'); break;
  }
}
function onInput(e) {
  const el = e.target;
  if (el.dataset.k && ui.form) {
    ui.form[el.dataset.k] = el.value;
    if (el.dataset.k === 'title') { const er = document.getElementById('f-err'); if (er) er.textContent = ''; }
    if (['date', 'time', 'recur'].includes(el.dataset.k) && e.type === 'change') renderSheet();
  }
  if (el.dataset.set) {
    settings[el.dataset.set] = +el.value; save();
    if (e.type === 'change' || el.type === 'range') { const lbl = document.querySelector(`label[for="${el.id}"]`);
      if (el.dataset.set === 'rainPct' && lbl) lbl.textContent = `Warn about outdoor plans when rain chance is ${el.value}% or more`;
      if (el.dataset.set === 'windKmh' && lbl) lbl.textContent = `…or wind is ${el.value} km/h or more`; }
    render();
    if (el.dataset.set === 'reminderMin' && ui.signedIn) tasks.filter(t => t.cal).forEach(t => commit(t, { quiet: true }));
  }
}
async function findTown() {
  const inp = document.getElementById('s-town'); const er = document.getElementById('town-err'); const q = inp.value.trim();
  if (!q) { er.textContent = 'Type a town name.'; return; }
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en`);
    const j = await r.json(); const p = j.results?.[0];
    if (!p) { er.textContent = `Couldn’t find “${q}”. Try a nearby larger town.`; return; }
    settings.fixedLoc = { name: p.name, lat: p.latitude, lon: p.longitude }; save();
    toast(`Forecast set to ${p.name}${p.admin1 ? ', ' + p.admin1 : ''}`); renderSheet(); loadWeather(true);
  } catch { er.textContent = 'Couldn’t look that up. Check your connection.'; }
}
document.addEventListener('click', onClick);
document.addEventListener('input', onInput);
document.addEventListener('change', onInput);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.sheet) { closeSheet(); return; }
  if (e.key === 'Enter' && ui.sheet && e.target.matches('input.in:not([type=date]):not([type=time])')) {
    if (e.target.id === 's-town') { e.preventDefault(); findTown(); return; }
    const btn = document.querySelector('[data-act="save-task"],[data-act="save-act"]'); if (btn) { e.preventDefault(); btn.click(); } return;
  }
  if (ui.sheet || e.target.matches('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'n') { e.preventDefault(); openSheet('task'); }
  if (e.key === 'a') { e.preventDefault(); openSheet('act'); }
  if (e.key === 'r') { e.preventDefault(); ui.signedIn ? syncAll(true) : signIn(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { loadWeather(false); if (ui.signedIn) syncAll(false); render(); }
});

/* ---------- Start ---------- */
(async function start() {
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  await initAuth();
  render();
  loadWeather(false);
  if (ui.signedIn) syncAll(false);
})();

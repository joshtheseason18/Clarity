/* ══════════════════════════════════════════
   Luclaro — Store (state spine)
   ══════════════════════════════════════════
   Single source of truth. Reads/writes localStorage.
   Any feature mutates state only through LC.set().
   On every set(), the UI re-renders.
*/

(function () {
  'use strict';

  const PREFIX = 'clarity_';

  /* ── Accent palettes ── */
  const ACCENTS = {
    green:  { n: '#3DDC84', d: '#1FA45C', nrgb: '61,220,132',  drgb: '31,164,92',   onN: '#06170d', onD: '#ffffff' },
    rose:   { n: '#E0789B', d: '#C2557A', nrgb: '224,120,155', drgb: '194,85,122',  onN: '#2a0f18', onD: '#ffffff' },
    blue:   { n: '#5E9BE8', d: '#2F6FC0', nrgb: '94,155,232',  drgb: '47,111,192',  onN: '#08172a', onD: '#ffffff' },
    amber:  { n: '#E0A24A', d: '#A8761F', nrgb: '224,162,74',  drgb: '168,118,31',  onN: '#1f1305', onD: '#ffffff' },
    purple: { n: '#A78BDD', d: '#7C5FC4', nrgb: '167,139,221', drgb: '124,95,196',  onN: '#150c28', onD: '#ffffff' },
  };

  /* ── Default state ── */
  const DEFAULTS = {
    screen: 'today',
    cal: 'day',
    theme: 'night',
    accent: 'green',
    dayBg: 'cream',
    nightBg: 'ink',
    dayLayout: 'grid',
    weekStart: 1,
    clockFmt: '12',
    lens: 'dump',
    projView: 'urgency',
    projOpen: null,
    sessionOpen: null,
    editor: null,
    focusMode: 'task',
    focusCustomMin: 25,
    focusRunning: false,
    focusTaskId: null,
    focusDone: false,
    notesScope: 'daily',
    user: null,          // { id, email, name } when signed in; null = guest
    authOpen: false,     // auth overlay visible
    syncStatus: 'idle',  // 'idle' | 'syncing' | 'synced' | 'offline'
    weekSel: null,
    weekGoalsOpen: true,
    monthGoalsOpen: true,
    yearGoalsOpen: true,
    yearSelMonth: null,
    calAnchor: null,
    federalHolidays: false,
  };

  /* ── Persisted keys (preferences) ── */
  const PREF_KEYS = ['theme', 'accent', 'dayBg', 'nightBg', 'dayLayout', 'weekStart', 'clockFmt', 'projView', 'federalHolidays'];

  /* ── State ── */
  let state = {};
  let listeners = [];
  let dataListeners = [];   // notified when persisted DATA (not prefs/UI state) changes → drives sync

  function load(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : undefined;
    } catch { return undefined; }
  }

  function save(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch {}
  }

  function init() {
    state = Object.assign({}, DEFAULTS);
    PREF_KEYS.forEach(k => {
      const v = load(k);
      if (v !== undefined) state[k] = v;
    });
    applyTheme();
    applyAccent();
    // notify synchronously: all feature modules register LC.on before main.js calls init(),
    // and rAF doesn't fire in a backgrounded tab (would leave the first paint blank).
    notify();
  }

  function get(key) {
    return key ? state[key] : Object.assign({}, state);
  }

  function set(updates) {
    let themeChanged = false;
    let accentChanged = false;

    let prefChanged = false;
    for (const k in updates) {
      if (state[k] === updates[k]) continue;
      state[k] = updates[k];
      if (PREF_KEYS.includes(k)) { save(k, updates[k]); prefChanged = true; }
      if (k === 'theme' || k === 'dayBg' || k === 'nightBg') themeChanged = true;
      if (k === 'accent' || k === 'theme') accentChanged = true;
    }
    if (prefChanged) dataListeners.forEach(fn => { try { fn('__pref__', null); } catch (e) {} });

    if (themeChanged) applyTheme();
    if (accentChanged) applyAccent();
    notify();
  }

  /* Re-read persisted prefs into in-memory state and reapply theme/accent.
     Called after a cloud pull replaces localStorage wholesale (sync). */
  function reloadPrefs() {
    PREF_KEYS.forEach(k => { const v = load(k); if (v !== undefined) state[k] = v; });
    applyTheme();
    applyAccent();
    notify();
  }

  function on(fn) {
    listeners.push(fn);
    return function off() { listeners = listeners.filter(f => f !== fn); };
  }

  function notify() {
    listeners.forEach(fn => fn(state));
  }

  /* ── Theme application ── */
  function resolvedTheme() {
    const t = state.theme;
    if (t === 'system') {
      const h = new Date().getHours();
      return (h >= 7 && h < 19) ? 'day' : 'night';
    }
    return t;
  }

  function applyTheme() {
    const t = resolvedTheme();
    const el = document.documentElement;
    el.setAttribute('data-theme', t);

    const bgKey = t === 'day' ? state.dayBg : state.nightBg;
    const defaultBg = t === 'day' ? 'cream' : 'ink';
    if (bgKey !== defaultBg) {
      el.setAttribute('data-bg', bgKey);
    } else {
      el.removeAttribute('data-bg');
    }
  }

  function applyAccent() {
    const t = resolvedTheme();
    const pal = ACCENTS[state.accent] || ACCENTS.green;
    const isNight = t === 'night';
    const base = isNight ? pal.n : pal.d;
    const rgb = isNight ? pal.nrgb : pal.drgb;
    const onAccent = isNight ? pal.onN : pal.onD;

    const el = document.documentElement;
    el.style.setProperty('--accent', base);
    el.style.setProperty('--accent-soft', `rgba(${rgb},.12)`);
    el.style.setProperty('--accent-line', `rgba(${rgb},${isNight ? '.32' : '.34'})`);
    el.style.setProperty('--accent-nest', `rgba(${rgb},${isNight ? '.05' : '.06'})`);
    el.style.setProperty('--on-accent', onAccent);
    el.style.setProperty('--accent-rgb', rgb);
  }

  /* ── localStorage data helpers ── */
  function loadData(key) { return load(key); }
  function saveData(key, val) {
    save(key, val);
    dataListeners.forEach(fn => { try { fn(key, val); } catch (e) {} });
  }

  /* Subscribe to persisted-data changes (used by sync). Returns an unsubscribe fn. */
  function onData(fn) {
    dataListeners.push(fn);
    return function off() { dataListeners = dataListeners.filter(f => f !== fn); };
  }

  /* Prefix helpers so sync can snapshot/restore the whole data blob. */
  function allData() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) out[k.slice(PREFIX.length)] = load(k.slice(PREFIX.length));
    }
    return out;
  }
  function replaceAllData(obj) {
    // clear existing clarity_ keys, then write the incoming blob (no data-change events)
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    Object.keys(obj || {}).forEach(k => save(k, obj[k]));
  }

  /* ── Time formatting ── */
  function fmtTime(min, fmt) {
    fmt = fmt || state.clockFmt;
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    if (fmt === '24') return h + ':' + String(m).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? h12 + ' ' + ampm : h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }

  function fmtDur(m) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return (h ? h + 'h' : '') + (h && mm ? ' ' : '') + (mm ? mm + 'm' : '') || '0m';
  }

  /* ── Public API ── */
  window.LC = {
    init,
    get,
    set,
    on,
    loadData,
    saveData,
    onData,
    allData,
    replaceAllData,
    reloadPrefs,
    fmtTime,
    fmtDur,
    resolvedTheme,
    ACCENTS,
  };
})();

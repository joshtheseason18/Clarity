/* ══════════════════════════════════════════
   Luclaro — Calendar (Week / Month / Year)
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var KEY_TASKS = 'tasks';
  var KEY_WGOALS = 'weekgoals';
  var KEY_WNOTE = 'weeknote';

  function loadTasks() { return LC.loadData(KEY_TASKS) || []; }
  function loadWGoals() { return LC.loadData(KEY_WGOALS) || []; }
  function saveWGoals(arr) { LC.saveData(KEY_WGOALS, arr); }
  function loadWNote() { return LC.loadData(KEY_WNOTE) || ''; }
  function saveWNote(v) { LC.saveData(KEY_WNOTE, v); }

  var KEY_MGOALS = 'monthgoals';
  var KEY_MREFLECT = 'monthreflect';
  var KEY_MNOTE = 'monthnote';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function loadMGoals() { return LC.loadData(KEY_MGOALS) || []; }
  function saveMGoals(arr) { LC.saveData(KEY_MGOALS, arr); }
  function loadMReflect() { return LC.loadData(KEY_MREFLECT) || {}; }
  function saveMReflect(o) { LC.saveData(KEY_MREFLECT, o); }
  function loadMNote() { return LC.loadData(KEY_MNOTE) || ''; }
  function saveMNote(v) { LC.saveData(KEY_MNOTE, v); }

  var mgEditIdx = -1;
  var mgDraft = '';

  var KEY_YGOALS = 'yeargoals';
  var KEY_YNOTE = 'yearnote';
  var KEY_YTHEME = 'yeartheme';

  function loadYGoals() { return LC.loadData(KEY_YGOALS) || []; }
  function saveYGoals(arr) { LC.saveData(KEY_YGOALS, arr); }
  function loadYNote() { return LC.loadData(KEY_YNOTE) || ''; }
  function saveYNote(v) { LC.saveData(KEY_YNOTE, v); }
  function loadYTheme() { return LC.loadData(KEY_YTHEME) || ''; }
  function saveYTheme(v) { LC.saveData(KEY_YTHEME, v); }

  var ygEditIdx = -1;
  var ygDraft = '';
  var ytEditing = false;
  var ytDraft = '';

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function dstr(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
  function anchorDate() { var a = LC.get('calAnchor'); return a ? new Date(a + 'T00:00:00') : new Date(); }

  /* Shared notes store — month/year notes live in clarity_notes (same as the Notes screen), per period. */
  function loadNotesObj() { return LC.loadData('notes') || {}; }
  function getNoteField(key, field) { var n = loadNotesObj()[key]; return (n && n[field]) ? n[field] : ''; }
  function setNoteField(key, field, val) {
    var notes = loadNotesObj();
    notes[key] = notes[key] || {};
    notes[key][field] = val;
    notes[key]._saved = Date.now();
    LC.saveData('notes', notes);
  }
  function attachNoteFields() {
    [].forEach.call(document.querySelectorAll('[data-notekey]'), function (ta) {
      ta.addEventListener('blur', function () { setNoteField(ta.dataset.notekey, ta.dataset.field, ta.value); });
    });
  }

  /* Project sessions scheduled on a date, normalized for calendar rendering. */
  function loadProjects() { var v = LC.loadData('projects'); return Array.isArray(v) ? v : []; }
  function sessionsForDate(date) {
    var out = [];
    loadProjects().forEach(function (p) {
      (p.sessions || []).forEach(function (s, idx) {
        if (s.date === date && s.startMin != null) {
          out.push({ startMin: s.startMin, duration: s.durationMin || 60, title: p.title, label: s.label, done: !!s.done, isSession: true, projectId: p.id, sessionIdx: idx });
        }
      });
    });
    return out;
  }

  /* ── Holidays (custom + optional US federal presets) ── */
  function loadHolidays() { var v = LC.loadData('holidays'); return Array.isArray(v) ? v : []; }
  function saveHolidays(a) { LC.saveData('holidays', a); }
  function iso(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function nthWeekday(y, m, wd, n) { var first = new Date(y, m, 1).getDay(); var day = 1 + ((wd - first + 7) % 7) + (n - 1) * 7; return iso(y, m, day); }
  function lastWeekday(y, m, wd) { var last = new Date(y, m + 1, 0); var day = last.getDate() - ((last.getDay() - wd + 7) % 7); return iso(y, m, day); }
  function federalHolidays(y) {
    return [
      { date: iso(y, 0, 1), name: "New Year's Day" },
      { date: nthWeekday(y, 0, 1, 3), name: 'MLK Jr. Day' },
      { date: nthWeekday(y, 1, 1, 3), name: "Presidents' Day" },
      { date: lastWeekday(y, 4, 1), name: 'Memorial Day' },
      { date: iso(y, 5, 19), name: 'Juneteenth' },
      { date: iso(y, 6, 4), name: 'Independence Day' },
      { date: nthWeekday(y, 8, 1, 1), name: 'Labor Day' },
      { date: nthWeekday(y, 9, 1, 2), name: 'Columbus Day' },
      { date: iso(y, 10, 11), name: 'Veterans Day' },
      { date: nthWeekday(y, 10, 4, 4), name: 'Thanksgiving' },
      { date: iso(y, 11, 25), name: 'Christmas Day' }
    ];
  }
  /* All holidays (custom + federal-if-enabled) for a year → sorted list. */
  function holidaysForYear(y) {
    var out = loadHolidays().filter(function (h) { return h.date && h.date.slice(0, 4) === String(y); })
      .map(function (h) { return { date: h.date, name: h.name, kind: h.kind || 'holiday', id: h.id }; });
    if (LC.get('federalHolidays')) federalHolidays(y).forEach(function (h) { out.push({ date: h.date, name: h.name, kind: 'federal' }); });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function holidayMap(y) { var m = {}; holidaysForYear(y).forEach(function (h) { (m[h.date] = m[h.date] || []).push(h); }); return m; }

  var wgEditIdx = -1;
  var wgDraft = '';
  var hAdding = false;   // holiday add-form open

  function weekInfo() {
    var d = anchorDate();
    var ws = LC.get('weekStart');
    var offset = (d.getDay() - ws + 7) % 7;
    var days = [];
    for (var i = 0; i < 7; i++) days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset + i));
    var todayS = dstr(new Date());
    var tIdx = -1;
    days.forEach(function (dt, i) { if (dstr(dt) === todayS) tIdx = i; });
    return { days: days, todayIndex: tIdx };
  }

  /* ── Render ── */
  function render() {
    if (LC.get('screen') !== 'calendar') return;
    var el = document.getElementById('screen-calendar');
    var cal = LC.get('cal');

    if (cal === 'week') {
      el.innerHTML = renderWeek();
      attachWeekInputs();
    } else if (cal === 'month') {
      el.innerHTML = renderMonth();
      attachMonthInputs();
    } else if (cal === 'year') {
      el.innerHTML = renderYear();
      attachYearInputs();
    } else {
      el.innerHTML = '<div class="screen-placeholder">' + (cal.charAt(0).toUpperCase() + cal.slice(1)) + ' view — coming soon</div>';
    }
  }

  /* ══════════════════════════════════════════
     Week view — expanding day board
     ══════════════════════════════════════════ */
  function renderWeek() {
    var info = weekInfo();
    var days = info.days;
    var tIdx = info.todayIndex;
    var sel = LC.get('weekSel');
    if (sel == null) sel = (tIdx >= 0 ? tIdx : 0);
    var tasks = loadTasks();
    var goals = loadWGoals();
    var goalsDone = goals.filter(function (g) { return g.done; }).length;
    var open = LC.get('weekGoalsOpen') !== false;

    var html = '<div class="wk-wrap">';

    /* Goals strip */
    html += '<div class="wk-goals-strip">';
    html += '<div class="wk-goals-head">';
    html += '<span class="wk-goals-toggle" data-action="toggle-week-goals"><i class="ti ti-target wk-goals-icon"></i> Goals ' + goalsDone + '/' + goals.length + ' <i class="ti ' + (open ? 'ti-chevron-up' : 'ti-chevron-down') + '"></i></span>';
    if (open && goals.length < 3) {
      html += '<button class="wk-goals-add-btn" data-action="add-week-goal"><i class="ti ti-plus"></i> Add goal</button>';
    }
    html += '</div>';
    if (open) {
      html += '<div class="wk-goals-chips">';
      goals.forEach(function (g, i) { html += renderGoalChip(g, i); });
      if (goals.length === 0) html += '<span class="wk-goals-empty">Set up to 3 goals for the week.</span>';
      html += '</div>';
    }
    html += '</div>';

    /* Day board */
    html += '<div class="wk-board">';
    days.forEach(function (dt, i) { html += renderDayCol(dt, i, i === sel, i === tIdx, tasks); });
    html += '</div>';

    html += '<div class="wk-hint"><i class="ti ti-pointer"></i> Tap any day — it widens to show full names and times, the rest tuck in.</div>';

    /* Week note */
    html += '<div class="wk-note">';
    html += '<div class="wk-note-head"><span class="wk-note-label"><i class="ti ti-pencil"></i> This week\'s note</span></div>';
    html += '<textarea class="wk-note-input" placeholder="A line about the shape of your week…">' + esc(loadWNote()) + '</textarea>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderGoalChip(g, i) {
    if (wgEditIdx === i) {
      return '<span class="wk-goal-chip editing"><i class="ti ti-circle wk-goal-check"></i><input class="wk-goal-input" type="text" value="' + esc(wgDraft) + '" placeholder="Name this goal…"></span>';
    }
    var cls = 'wk-goal-chip' + (g.done ? ' done' : '');
    var html = '<span class="' + cls + '">';
    html += '<i class="ti ' + (g.done ? 'ti-circle-check-filled' : 'ti-circle') + ' wk-goal-check" data-action="toggle-week-goal" data-goal="' + i + '"></i>';
    html += '<span class="wk-goal-text' + (g.done ? ' done' : '') + '" data-action="edit-week-goal" data-goal="' + i + '">' + esc(g.t) + '</span>';
    html += '<i class="ti ti-pencil wk-goal-pencil" data-action="edit-week-goal" data-goal="' + i + '"></i>';
    html += '</span>';
    return html;
  }

  /* Unified, time-sorted list of tasks + sessions for a date. */
  function dayItems(dt, tasks) {
    var ds = dstr(dt);
    var items = tasks.filter(function (t) { return t.date === ds && t.startMin != null; })
      .map(function (t) {
        return { id: t.id, startMin: t.startMin, duration: t.duration || 30, title: t.title || 'Untitled', kind: t.type === 'event' ? 'event' : 'task', done: !!t.done };
      });
    sessionsForDate(ds).forEach(function (s) {
      items.push({ startMin: s.startMin, duration: s.duration, title: s.title, kind: 'session', label: s.label, done: s.done, projectId: s.projectId, sessionIdx: s.sessionIdx });
    });
    return items.sort(function (a, b) { return a.startMin - b.startMin; });
  }

  /* data-attrs to make a week item open its editor (task) or session drawer (session) */
  function itemAttrs(t) {
    if (t.kind === 'session') return ' data-cal-open="session" data-project-id="' + esc(t.projectId) + '" data-session-idx="' + t.sessionIdx + '"';
    if (t.id) return ' data-cal-open="task" data-task-id="' + esc(t.id) + '"';
    return '';
  }

  function renderDayCol(dt, i, isSel, isToday, tasks) {
    var items = dayItems(dt, tasks);

    var html = '<div class="wk-col' + (isSel ? ' sel' : '') + '" data-action="select-week-day" data-day="' + i + '">';
    html += '<div class="wk-col-head' + (isSel ? ' sel' : '') + '"><span class="wk-dow">' + DOW[dt.getDay()] + '</span><span class="wk-num' + ((isToday || isSel) ? ' accent' : '') + '">' + dt.getDate() + '</span></div>';

    if (isSel) {
      html += '<div class="wk-col-items">';
      if (items.length === 0) {
        html += '<div class="wk-empty">Nothing scheduled — a clear day.</div>';
      }
      items.forEach(function (t) {
        var c = t.kind === 'event' ? 'blue' : 'accent';
        var end = t.startMin + t.duration;
        var typeLabel = t.kind === 'event' ? 'Event' : (t.kind === 'session' ? 'Session' : 'Task');
        var tag = t.kind === 'session' ? '<i class="ti ti-target wk-item-tag"></i> ' : '';
        html += '<div class="wk-item' + (t.done ? ' done' : '') + '"' + itemAttrs(t) + '>';
        html += '<div class="wk-chip" style="background:var(--' + c + '-soft);color:var(--' + c + ')">' + LC.fmtTime(t.startMin) + '</div>';
        html += '<div class="wk-item-main"><div class="wk-item-name">' + tag + esc(t.title) + (t.kind === 'session' && t.label ? ' <span class="wk-item-sub">· ' + esc(t.label) + '</span>' : '') + '</div>';
        html += '<div class="wk-item-range">' + LC.fmtTime(t.startMin) + ' – ' + LC.fmtTime(end) + ' · ' + typeLabel + '</div></div>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="wk-col-compact">';
      items.forEach(function (t) {
        var c = t.kind === 'event' ? 'blue' : 'accent';
        var tag = t.kind === 'session' ? '<i class="ti ti-target wk-compact-tag"></i>' : '';
        html += '<div class="wk-compact-item"' + itemAttrs(t) + '>';
        html += '<span class="wk-compact-bar" style="background:var(--' + c + ')"></span>';
        html += '<div class="wk-compact-main"><div class="wk-compact-start" style="color:var(--' + c + ')">' + LC.fmtTime(t.startMin) + '</div>';
        html += '<div class="wk-compact-name">' + tag + esc(t.title) + '</div></div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  /* ── Week goal editing ── */
  function wgStartEdit(i) {
    wgEditIdx = i;
    wgDraft = loadWGoals()[i].t;
    render();
  }
  function wgCommit(val) {
    if (wgEditIdx < 0) return;
    var i = wgEditIdx;
    wgEditIdx = -1;
    var v = (val || '').trim();
    var arr = loadWGoals();
    if (v) { arr[i].t = v; } else { arr.splice(i, 1); }
    saveWGoals(arr);
    render();
  }

  function attachWeekInputs() {
    var gi = document.querySelector('.wk-goal-input');
    if (gi) {
      gi.focus();
      gi.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); wgCommit(gi.value); }
        if (e.key === 'Escape') { wgEditIdx = -1; render(); }
      });
      gi.addEventListener('blur', function () { wgCommit(gi.value); });
    }
    var nt = document.querySelector('.wk-note-input');
    if (nt) {
      nt.addEventListener('blur', function () { saveWNote(nt.value); });
    }
  }

  /* ══════════════════════════════════════════
     Month view — weekday-aligned grid
     ══════════════════════════════════════════ */
  function renderMonth() {
    var d = anchorDate();
    var year = d.getFullYear(), month = d.getMonth();
    var ws = LC.get('weekStart');
    var open = LC.get('monthGoalsOpen') !== false;
    var goals = loadMGoals();
    var tasks = loadTasks();
    var mKey = 'monthly:' + year + '-' + String(month + 1).padStart(2, '0');

    var html = '<div class="mo-wrap">';

    /* Goals card */
    html += '<div class="mo-goals-card">';
    html += '<div class="mo-goals-toggle" data-action="toggle-month-goals"><i class="ti ti-target mo-goals-icon"></i><span class="mo-goals-label">Goals this month</span><span class="mo-goals-spacer"></span><i class="ti ' + (open ? 'ti-chevron-up' : 'ti-chevron-down') + '"></i></div>';
    if (open) {
      html += '<div class="mo-goals-grid">';
      html += '<div class="mo-goals-list">';
      goals.forEach(function (g, i) { html += renderMonthGoal(g, i); });
      html += '<div class="mo-goal-add" data-action="add-month-goal"><i class="ti ti-plus"></i> Add a goal</div>';
      html += '</div>';
      html += '<div class="mo-reflect">';
      html += reflectBlock('Looking forward to', 'lookingForward', mKey);
      html += reflectBlock('What went well', 'wentWell', mKey);
      html += reflectBlock('To improve', 'toImprove', mKey);
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';

    /* Day headers */
    html += '<div class="mo-heads">';
    for (var i = 0; i < 7; i++) html += '<div class="mo-head">' + DOW[(ws + i) % 7] + '</div>';
    html += '</div>';

    /* Grid cells */
    var first = new Date(year, month, 1);
    var lead = (first.getDay() - ws + 7) % 7;
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var cells = [];
    for (var L = 0; L < lead; L++) cells.push({ date: new Date(year, month, 1 - (lead - L)), muted: true });
    for (var n = 1; n <= daysInMonth; n++) cells.push({ date: new Date(year, month, n), muted: false });
    while (cells.length % 7 !== 0) { var last = cells[cells.length - 1].date; cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), muted: true }); }

    // merge adjacent years so lead/trailing cells (prev Dec / next Jan) show their holidays too
    var hmap = Object.assign({}, holidayMap(year - 1), holidayMap(year), holidayMap(year + 1));
    html += '<div class="mo-grid">';
    cells.forEach(function (c) { html += renderMonthCell(c, tasks, hmap); });
    html += '</div>';

    /* Selected-day preview (click a cell; double-click opens the day) */
    var selDay = LC.get('monthSelDay');
    if (selDay) {
      var sp = selDay.split('-');
      if (+sp[0] === year && +sp[1] === month + 1) {
        var sdt = new Date(+sp[0], +sp[1] - 1, +sp[2]);
        var items = dayItems(sdt, tasks);
        var dHols = hmap[selDay] || [];
        html += '<div class="mo-daypreview">';
        html += '<div class="mo-daypreview-head"><span class="mo-daypreview-title serif">' + DOW[sdt.getDay()] + ', ' + MONTHS[month] + ' ' + sdt.getDate() + '</span>';
        html += '<button class="mo-daypreview-open" data-action="open-month-day" data-day-iso="' + selDay + '">Open day <i class="ti ti-arrow-right"></i></button></div>';
        dHols.forEach(function (ho) { html += '<div class="mo-daypreview-hol"><i class="ti ti-confetti"></i> ' + esc(ho.name) + '</div>'; });
        if (items.length === 0 && dHols.length === 0) {
          html += '<div class="mo-daypreview-empty">Nothing scheduled — a clear day.</div>';
        }
        items.forEach(function (t) {
          var c2 = t.kind === 'event' ? 'blue' : 'accent';
          var typeLbl = t.kind === 'event' ? 'Event' : (t.kind === 'session' ? 'Session' : 'Task');
          html += '<div class="mo-daypreview-item"' + itemAttrs(t) + '>';
          html += '<span class="mo-daypreview-chip" style="background:var(--' + c2 + '-soft);color:var(--' + c2 + ')">' + LC.fmtTime(t.startMin) + '</span>';
          html += '<span class="mo-daypreview-name' + (t.done ? ' done' : '') + '">' + (t.kind === 'session' ? '<i class="ti ti-target"></i> ' : '') + esc(t.title) + '</span>';
          html += '<span class="mo-daypreview-type">' + typeLbl + '</span>';
          html += '</div>';
        });
        html += '<div class="mo-daypreview-hint">Double-click a day to open it in the Day view.</div>';
        html += '</div>';
      }
    }

    /* Legend */
    html += '<div class="mo-legend">';
    html += '<span class="mo-leg"><span class="mo-dot" style="background:var(--accent)"></span> Task / focus</span>';
    html += '<span class="mo-leg"><span class="mo-dot" style="background:var(--blue)"></span> Event</span>';
    html += '<span class="mo-leg"><span class="mo-dot" style="background:var(--amber)"></span> Deadline</span>';
    html += '</div>';

    /* Month note */
    html += '<div class="wk-note">';
    html += '<div class="wk-note-head"><span class="wk-note-label"><i class="ti ti-pencil"></i> Theme this month</span><span class="wk-note-meta">' + MONTHS[month] + '</span></div>';
    html += '<textarea class="mo-note-input" data-notekey="' + mKey + '" data-field="theme" placeholder="The theme for ' + MONTHS[month] + '…">' + esc(getNoteField(mKey, 'theme')) + '</textarea>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderMonthCell(c, tasks, hmap) {
    var dt = c.date;
    var ds = dstr(dt);
    var isToday = !c.muted && ds === dstr(new Date());
    var isSel = !c.muted && LC.get('monthSelDay') === ds;
    var hols = (hmap && hmap[ds]) || [];
    var dayTasks = dayItems(dt, tasks);
    var shown = dayTasks.slice(0, hols.length ? 1 : 2);
    var more = dayTasks.length - shown.length;

    var html = '<div class="mo-cell' + (isToday ? ' today' : '') + (isSel ? ' sel' : '') + (hols.length ? ' has-holiday' : '') + (c.muted ? '' : ' clickable') + '"' + (c.muted ? '' : ' data-action="select-month-day" data-day-iso="' + ds + '"') + '>';
    html += '<div class="mo-cell-top"><span class="mo-num' + (isToday ? ' today' : (c.muted ? ' muted' : '')) + '">' + dt.getDate() + '</span></div>';
    if (hols.length || shown.length || more > 0) {
      html += '<div class="mo-previews">';
      hols.forEach(function (ho) {
        html += '<div class="mo-preview mo-holiday"><i class="ti ti-confetti mo-holiday-icon"></i><span class="mo-preview-text">' + esc(ho.name) + '</span></div>';
      });
      shown.forEach(function (t) {
        var col = t.kind === 'event' ? 'blue' : 'accent';
        var tag = t.kind === 'session' ? '<i class="ti ti-target mo-preview-tag"></i>' : '<span class="mo-dot" style="background:var(--' + col + ')"></span>';
        html += '<div class="mo-preview">' + tag + '<span class="mo-preview-text">' + esc(t.title) + '</span></div>';
      });
      if (more > 0) html += '<div class="mo-more">+' + more + ' more</div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderMonthGoal(g, i) {
    if (mgEditIdx === i) {
      return '<div class="mo-goal"><i class="ti ti-circle mo-goal-check"></i><input class="mo-goal-input" type="text" value="' + esc(mgDraft) + '" placeholder="Name this goal…"></div>';
    }
    var html = '<div class="mo-goal">';
    html += '<i class="ti ' + (g.done ? 'ti-circle-check-filled' : 'ti-circle') + ' mo-goal-check' + (g.done ? ' done' : '') + '" data-action="toggle-month-goal" data-goal="' + i + '"></i>';
    html += '<span class="mo-goal-text' + (g.done ? ' done' : '') + '" data-action="edit-month-goal" data-goal="' + i + '">' + esc(g.t) + '</span>';
    html += '<i class="ti ti-pencil mo-goal-pencil" data-action="edit-month-goal" data-goal="' + i + '"></i>';
    html += '</div>';
    return html;
  }

  function reflectBlock(label, field, mKey) {
    return '<div class="mo-reflect-block"><div class="mo-reflect-label">' + label + '</div><textarea class="mo-reflect-input" data-notekey="' + mKey + '" data-field="' + field + '" placeholder="Add a note…">' + esc(getNoteField(mKey, field)) + '</textarea></div>';
  }

  function mgStartEdit(i) { mgEditIdx = i; mgDraft = loadMGoals()[i].t; render(); }
  function mgCommit(val) {
    if (mgEditIdx < 0) return;
    var i = mgEditIdx; mgEditIdx = -1;
    var v = (val || '').trim();
    var arr = loadMGoals();
    if (v) { arr[i].t = v; } else { arr.splice(i, 1); }
    saveMGoals(arr);
    render();
  }

  function attachMonthInputs() {
    var gi = document.querySelector('.mo-goal-input');
    if (gi) {
      gi.focus();
      gi.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); mgCommit(gi.value); }
        if (e.key === 'Escape') { mgEditIdx = -1; render(); }
      });
      gi.addEventListener('blur', function () { mgCommit(gi.value); });
    }
    attachNoteFields();
  }

  /* ══════════════════════════════════════════
     Year view — 12 mini-month grids
     ══════════════════════════════════════════ */
  function buildYearMonths(year) {
    var ws = LC.get('weekStart');   // honor the week-start pref (was hardcoded Monday-first)
    var HEADS = [];
    for (var hi = 0; hi < 7; hi++) HEADS.push(DOW[(ws + hi) % 7].charAt(0));
    var tasks = loadTasks();
    var taskDays = {};
    tasks.forEach(function (t) { if (t.date) taskDays[t.date] = true; });
    loadProjects().forEach(function (p) {
      (p.sessions || []).forEach(function (s) { if (s.date) taskDays[s.date] = true; });
    });
    var hmap = holidayMap(year);
    var now = new Date();
    var months = [];
    for (var mi = 0; mi < 12; mi++) {
      var first = new Date(year, mi, 1);
      var lead = (first.getDay() - ws + 7) % 7;
      var dim = new Date(year, mi + 1, 0).getDate();
      var cells = [];
      for (var i = 0; i < lead; i++) cells.push({ empty: true });
      for (var dd = 1; dd <= dim; dd++) {
        var ds = year + '-' + String(mi + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
        var realDow = (ws + ((lead + dd - 1) % 7)) % 7;   // actual weekday (getDay values)
        cells.push({
          day: dd,
          isToday: now.getFullYear() === year && now.getMonth() === mi && now.getDate() === dd,
          weekend: realDow === 0 || realDow === 6,
          hasTask: !!taskDays[ds],
          holiday: !!hmap[ds]
        });
      }
      months.push({ name: MONTHS[mi], isCurMonth: now.getFullYear() === year && now.getMonth() === mi, cells: cells });
    }
    return { months: months, heads: HEADS };
  }

  function renderYear() {
    var year = anchorDate().getFullYear();
    var open = LC.get('yearGoalsOpen') !== false;
    var goals = loadYGoals();
    var yd = buildYearMonths(year);
    var yKey = 'yearly:' + year;
    var theme = getNoteField(yKey, 'theme');

    var html = '<div class="yr-wrap">';

    html += '<div class="yr-top">';

    /* Theme banner */
    html += '<div class="yr-theme" data-action="edit-year-theme">';
    html += '<i class="ti ti-compass yr-theme-icon"></i><span class="yr-theme-label">Theme</span>';
    if (ytEditing) {
      html += '<input class="yr-theme-input" type="text" value="' + esc(ytDraft) + '" placeholder="Set your theme for the year…">';
    } else if (theme) {
      html += '<span class="yr-theme-text serif">' + esc(theme) + '</span>';
    } else {
      html += '<span class="yr-theme-text serif yr-theme-ph">Set your theme for the year…</span>';
    }
    html += '</div>';

    /* Goals this year */
    html += '<div class="yr-goals-toggle" data-action="toggle-year-goals"><i class="ti ti-target yr-goals-icon"></i><span class="yr-goals-label">Goals this year</span><span class="yr-goals-spacer"></span><i class="ti ' + (open ? 'ti-chevron-up' : 'ti-chevron-down') + '"></i></div>';
    if (open) {
      html += '<div class="yr-goals-grid">';
      goals.forEach(function (g, i) { html += renderYearGoal(g, i); });
      html += '<div class="yr-goal-add" data-action="add-year-goal"><i class="ti ti-plus"></i> Add a goal</div>';
      html += '</div>';
    }
    html += '</div>';

    /* 12 mini-month grids */
    var sel = LC.get('yearSelMonth');
    html += '<div class="yr-months">';
    yd.months.forEach(function (m, mi) {
      html += '<div class="yr-month' + (mi === sel ? ' sel' : '') + '" data-action="select-year-month" data-month="' + mi + '">';
      html += '<div class="yr-month-name serif' + (m.isCurMonth ? ' accent' : '') + '">' + m.name + '</div>';
      html += '<div class="yr-mini-heads">';
      yd.heads.forEach(function (h) { html += '<div class="yr-mini-head">' + h + '</div>'; });
      html += '</div>';
      html += '<div class="yr-mini-cells">';
      m.cells.forEach(function (c) {
        if (c.empty) { html += '<div class="yr-mini-cell empty"></div>'; return; }
        var cls = 'yr-mini-cell';
        if (c.isToday) cls += ' today';
        else if (c.holiday) cls += ' holiday';
        else if (c.hasTask) cls += ' task';
        else if (c.weekend) cls += ' weekend';
        html += '<div class="' + cls + '">' + c.day + '</div>';
      });
      html += '</div>';
      if (mi === sel) html += renderYearPreview(year, mi);
      html += '</div>';
    });
    html += '</div>';

    /* Holidays & time off */
    html += renderHolidaysSection(year);

    /* Year note */
    html += '<div class="yr-note wk-note">';
    html += '<div class="wk-note-head"><span class="wk-note-label"><i class="ti ti-pencil"></i> This year\'s intentions</span><span class="wk-note-meta">' + year + '</span></div>';
    html += '<textarea class="yr-note-input" data-notekey="' + yKey + '" data-field="intentions" placeholder="What this year is for…">' + esc(getNoteField(yKey, 'intentions')) + '</textarea>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  /* Expanding preview under a selected mini-month. */
  function renderYearPreview(year, mi) {
    var mk = year + '-' + String(mi + 1).padStart(2, '0');
    var tasks = loadTasks().filter(function (t) { return t.date && t.date.slice(0, 7) === mk; });
    var taskN = tasks.filter(function (t) { return t.type !== 'event'; }).length;
    var eventN = tasks.filter(function (t) { return t.type === 'event'; }).length;
    var sessN = 0;
    loadProjects().forEach(function (p) { (p.sessions || []).forEach(function (s) { if (s.date && s.date.slice(0, 7) === mk) sessN++; }); });
    var hols = holidaysForYear(year).filter(function (h) { return h.date.slice(0, 7) === mk; });

    var h = '<div class="yr-preview" data-action="ignore">';
    h += '<div class="yr-preview-counts">';
    h += '<span><b>' + taskN + '</b> task' + (taskN !== 1 ? 's' : '') + '</span>';
    h += '<span><b>' + eventN + '</b> event' + (eventN !== 1 ? 's' : '') + '</span>';
    h += '<span><b>' + sessN + '</b> session' + (sessN !== 1 ? 's' : '') + '</span>';
    h += '</div>';
    if (hols.length) {
      h += '<div class="yr-preview-hols">';
      hols.forEach(function (x) { h += '<div class="yr-preview-hol"><i class="ti ti-confetti"></i> ' + (+x.date.slice(8)) + ' · ' + esc(x.name) + '</div>'; });
      h += '</div>';
    }
    h += '<button class="yr-preview-open" data-action="open-year-month" data-month="' + mi + '">Open ' + MONTHS[mi] + ' <i class="ti ti-arrow-right"></i></button>';
    h += '</div>';   // close .yr-preview — without this every later month nests inside the selected one
    return h;
  }

  /* Holidays & time off manager (year view). */
  function renderHolidaysSection(year) {
    var hols = holidaysForYear(year);
    var h = '<div class="yr-holidays">';
    h += '<div class="yr-hol-head"><span class="wk-note-label"><i class="ti ti-confetti"></i> Holidays & time off</span>';
    h += '<button class="yr-hol-add-btn" data-action="add-holiday"><i class="ti ti-plus"></i> Add</button></div>';

    if (hAdding) {
      h += '<div class="yr-hol-form">';
      h += '<input type="date" class="yr-hol-date" id="yr-hol-date" value="' + year + '-01-01">';
      h += '<input type="text" class="yr-hol-name" id="yr-hol-name" placeholder="Name (e.g. Vacation)">';
      h += '<select class="yr-hol-kind" id="yr-hol-kind"><option value="holiday">Holiday</option><option value="timeoff">Time off</option></select>';
      h += '<button class="yr-hol-save" data-action="save-holiday">Add</button>';
      h += '<button class="yr-hol-cancel" data-action="cancel-holiday">Cancel</button>';
      h += '</div>';
    }

    if (hols.length === 0) {
      h += '<div class="yr-hol-empty">No holidays yet.' + (LC.get('federalHolidays') ? '' : ' Turn on US federal holidays in Settings, or add your own.') + '</div>';
    } else {
      h += '<div class="yr-hol-list">';
      hols.forEach(function (x) {
        var p = x.date.split('-'); var lbl = MONTHS[+p[1] - 1].slice(0, 3) + ' ' + (+p[2]);
        h += '<div class="yr-hol-row">';
        h += '<span class="yr-hol-badge ' + x.kind + '">' + (x.kind === 'timeoff' ? 'Time off' : (x.kind === 'federal' ? 'Federal' : 'Holiday')) + '</span>';
        h += '<span class="yr-hol-date-lbl">' + lbl + '</span>';
        h += '<span class="yr-hol-name-lbl">' + esc(x.name) + '</span>';
        if (x.kind !== 'federal') h += '<button class="yr-hol-del" data-action="del-holiday" data-id="' + esc(x.id) + '" aria-label="Remove"><i class="ti ti-x"></i></button>';
        h += '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderYearGoal(g, i) {
    if (ygEditIdx === i) {
      return '<div class="mo-goal"><i class="ti ti-circle mo-goal-check"></i><input class="mo-goal-input yr-goal-input" type="text" value="' + esc(ygDraft) + '" placeholder="Name this goal…"></div>';
    }
    var html = '<div class="mo-goal">';
    html += '<i class="ti ' + (g.done ? 'ti-circle-check-filled' : 'ti-circle') + ' mo-goal-check' + (g.done ? ' done' : '') + '" data-action="toggle-year-goal" data-goal="' + i + '"></i>';
    html += '<span class="mo-goal-text' + (g.done ? ' done' : '') + '" data-action="edit-year-goal" data-goal="' + i + '">' + esc(g.t) + '</span>';
    html += '<i class="ti ti-pencil mo-goal-pencil" data-action="edit-year-goal" data-goal="' + i + '"></i>';
    html += '</div>';
    return html;
  }

  function ygStartEdit(i) { ygEditIdx = i; ygDraft = loadYGoals()[i].t; render(); }
  function ygCommit(val) {
    if (ygEditIdx < 0) return;
    var i = ygEditIdx; ygEditIdx = -1;
    var v = (val || '').trim();
    var arr = loadYGoals();
    if (v) { arr[i].t = v; } else { arr.splice(i, 1); }
    saveYGoals(arr);
    render();
  }
  function ytCommit(val) {
    ytEditing = false;
    setNoteField('yearly:' + anchorDate().getFullYear(), 'theme', (val || '').trim());
    render();
  }

  function attachYearInputs() {
    var gi = document.querySelector('.yr-goal-input');
    if (gi) {
      gi.focus();
      gi.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); ygCommit(gi.value); }
        if (e.key === 'Escape') { ygEditIdx = -1; render(); }
      });
      gi.addEventListener('blur', function () { ygCommit(gi.value); });
    }
    var ti = document.querySelector('.yr-theme-input');
    if (ti) {
      ti.focus();
      ti.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); ytCommit(ti.value); }
        if (e.key === 'Escape') { ytEditing = false; render(); }
      });
      ti.addEventListener('blur', function () { ytCommit(ti.value); });
    }
    attachNoteFields();
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    // Week item → open editor (task) or session drawer. Checked first: items sit inside
    // a .wk-col that carries select-week-day, so this must win over day selection.
    var open = e.target.closest('[data-cal-open]');
    if (open) {
      var todayISO2 = dstr(new Date());
      if (open.dataset.calOpen === 'task') {
        // anchor the Day view to the task's own date so the card is visible next to its editor
        var opTask = loadTasks().find(function (t) { return t.id === open.dataset.taskId; });
        var opDate = opTask && opTask.date ? opTask.date : todayISO2;
        LC.set({ screen: 'today', calAnchor: null, dayAnchor: opDate === todayISO2 ? null : opDate, editor: open.dataset.taskId, sessionOpen: null });
      } else if (open.dataset.calOpen === 'session') {
        var opProj = loadProjects().find(function (pp) { return pp.id === open.dataset.projectId; });
        var opSess = opProj && opProj.sessions ? opProj.sessions[parseInt(open.dataset.sessionIdx, 10)] : null;
        var sDate = opSess && opSess.date ? opSess.date : todayISO2;
        LC.set({ screen: 'today', calAnchor: null, dayAnchor: sDate === todayISO2 ? null : sDate, projOpen: open.dataset.projectId, sessionOpen: parseInt(open.dataset.sessionIdx, 10), editor: null });
      }
      return;
    }

    var action = e.target.closest('[data-action]');
    if (!action) return;
    var a = action.dataset.action;

    if (a === 'select-week-day') {
      LC.set({ weekSel: parseInt(action.dataset.day, 10) });
      return;
    }
    if (a === 'toggle-week-goals') {
      LC.set({ weekGoalsOpen: !(LC.get('weekGoalsOpen') !== false) });
      return;
    }
    if (a === 'toggle-week-goal') {
      var gi2 = parseInt(action.dataset.goal, 10);
      var arr = loadWGoals();
      if (arr[gi2]) { arr[gi2].done = !arr[gi2].done; saveWGoals(arr); render(); }
      return;
    }
    if (a === 'edit-week-goal') {
      wgStartEdit(parseInt(action.dataset.goal, 10));
      return;
    }
    if (a === 'add-week-goal') {
      var arr2 = loadWGoals();
      if (arr2.length >= 3) return;
      arr2.push({ t: '', done: false });
      saveWGoals(arr2);
      wgEditIdx = arr2.length - 1;
      wgDraft = '';
      render();
      return;
    }

    if (a === 'toggle-month-goals') {
      LC.set({ monthGoalsOpen: !(LC.get('monthGoalsOpen') !== false) });
      return;
    }
    if (a === 'toggle-month-goal') {
      var mi = parseInt(action.dataset.goal, 10);
      var marr = loadMGoals();
      if (marr[mi]) { marr[mi].done = !marr[mi].done; saveMGoals(marr); render(); }
      return;
    }
    if (a === 'edit-month-goal') {
      mgStartEdit(parseInt(action.dataset.goal, 10));
      return;
    }
    if (a === 'add-month-goal') {
      var marr2 = loadMGoals();
      marr2.push({ t: '', done: false });
      saveMGoals(marr2);
      mgEditIdx = marr2.length - 1;
      mgDraft = '';
      render();
      return;
    }

    if (a === 'edit-year-theme') {
      if (ytEditing) return;
      ytEditing = true;
      ytDraft = getNoteField('yearly:' + anchorDate().getFullYear(), 'theme');
      render();
      return;
    }
    if (a === 'toggle-year-goals') {
      LC.set({ yearGoalsOpen: !(LC.get('yearGoalsOpen') !== false) });
      return;
    }
    if (a === 'toggle-year-goal') {
      var yi = parseInt(action.dataset.goal, 10);
      var yarr = loadYGoals();
      if (yarr[yi]) { yarr[yi].done = !yarr[yi].done; saveYGoals(yarr); render(); }
      return;
    }
    if (a === 'edit-year-goal') {
      ygStartEdit(parseInt(action.dataset.goal, 10));
      return;
    }
    if (a === 'add-year-goal') {
      var yarr2 = loadYGoals();
      yarr2.push({ t: '', done: false });
      saveYGoals(yarr2);
      ygEditIdx = yarr2.length - 1;
      ygDraft = '';
      render();
      return;
    }

    /* Month view: day select / drill-in */
    if (a === 'select-month-day') {
      var mds = action.dataset.dayIso;
      LC.set({ monthSelDay: LC.get('monthSelDay') === mds ? null : mds });
      return;
    }
    if (a === 'open-month-day') {
      var ods = action.dataset.dayIso;
      LC.set({ screen: 'today', dayAnchor: ods === dstr(new Date()) ? null : ods, editor: null, monthSelDay: null, calAnchor: null });
      return;
    }

    /* Year view: month select / drill-in / holidays */
    if (a === 'select-year-month') {
      var smi = parseInt(action.dataset.month, 10);
      LC.set({ yearSelMonth: LC.get('yearSelMonth') === smi ? null : smi });
      return;
    }
    if (a === 'open-year-month') {
      var omi = parseInt(action.dataset.month, 10);
      var y = anchorDate().getFullYear();
      LC.set({ cal: 'month', calAnchor: iso(y, omi, 1), yearSelMonth: null, weekSel: null, monthSelDay: null });
      return;
    }
    if (a === 'add-holiday') { hAdding = true; render(); return; }
    if (a === 'cancel-holiday') { hAdding = false; render(); return; }
    if (a === 'save-holiday') {
      var dv = (document.getElementById('yr-hol-date') || {}).value;
      var nv = ((document.getElementById('yr-hol-name') || {}).value || '').trim();
      var kv = (document.getElementById('yr-hol-kind') || {}).value || 'holiday';
      if (dv && nv) {
        var arr = loadHolidays();
        arr.push({ id: 'h' + Date.now(), date: dv, name: nv, kind: kv });
        saveHolidays(arr);
        hAdding = false;
        render();
      }
      return;
    }
    if (a === 'del-holiday') {
      saveHolidays(loadHolidays().filter(function (x) { return x.id !== action.dataset.id; }));
      render();
      return;
    }
  });

  /* Double-click a mini-month → drill into its Month view. */
  document.addEventListener('dblclick', function (e) {
    if (LC.get('screen') !== 'calendar') return;
    var mo = e.target.closest('[data-action="select-year-month"]');
    if (mo && LC.get('cal') === 'year') {
      var mi = parseInt(mo.dataset.month, 10);
      var y = anchorDate().getFullYear();
      LC.set({ cal: 'month', calAnchor: iso(y, mi, 1), yearSelMonth: null, weekSel: null, monthSelDay: null });
      return;
    }
    /* Double-click a month day → open that exact date in the Day view. */
    var mc = e.target.closest('[data-action="select-month-day"]');
    if (mc && LC.get('cal') === 'month') {
      var ods2 = mc.dataset.dayIso;
      LC.set({ screen: 'today', dayAnchor: ods2 === dstr(new Date()) ? null : ods2, editor: null, monthSelDay: null, calAnchor: null });
    }
  });

  /* One-time migration: fold old calendar-only month/year note storage into clarity_notes. */
  (function migrateCalendarNotes() {
    if (LC.loadData('calNotesMigrated')) return;
    var notes = LC.loadData('notes') || {};
    var d = new Date();
    var mKey = 'monthly:' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    var yKey = 'yearly:' + d.getFullYear();
    function seed(key, field, val) { if (!val) return; notes[key] = notes[key] || {}; if (!notes[key][field]) notes[key][field] = val; }
    var mr = LC.loadData('monthreflect') || {};
    seed(mKey, 'lookingForward', mr.lookingForward);
    seed(mKey, 'wentWell', mr.wentWell);
    seed(mKey, 'toImprove', mr.toImprove);
    seed(mKey, 'theme', LC.loadData('monthnote'));
    seed(yKey, 'theme', LC.loadData('yeartheme'));
    seed(yKey, 'intentions', LC.loadData('yearnote'));
    LC.saveData('notes', notes);
    LC.saveData('calNotesMigrated', true);
  })();

  LC.on(render);
  window.LC_Calendar = { render: render };
})();


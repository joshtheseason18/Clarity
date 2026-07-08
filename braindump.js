/* ══════════════════════════════════════════
   Luclaro — Brain Dump + Projects
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var KEY = 'braindump';
  var KEY_PROJ = 'projects';
  var subAdding = false;

  function loadDump() { return LC.loadData(KEY) || []; }
  function saveDump(arr) { LC.saveData(KEY, arr); }
  function loadProjects() { return LC.loadData(KEY_PROJ) || []; }
  function saveProjects(arr) { LC.saveData(KEY_PROJ, arr); }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function two(n) { return String(n).padStart(2, '0'); }
  function clockParts(min) {
    var h = Math.floor(min / 60) % 24, m = ((min % 60) + 60) % 60;
    var ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 === 0 ? 12 : h % 12;
    return { h12: h12, m: m, ap: ap };
  }
  function fmtClock(min) { var p = clockParts(min); return p.h12 + ':' + two(p.m) + ' ' + p.ap; }
  function fmtRange(start, dur) {
    var a = clockParts(start), b = clockParts(start + dur);
    var aStr = a.h12 + ':' + two(a.m) + (a.ap !== b.ap ? ' ' + a.ap : '');
    return aStr + ' – ' + b.h12 + ':' + two(b.m) + ' ' + b.ap;
  }
  function fmtDurShort(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + 'h' : '') + (h && m ? ' ' : '') + (m ? m + 'm' : '') || '0m';
  }
  var SDOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var SMO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); }
  function fmtSessionDate(iso) {
    if (!iso) return 'Not scheduled';
    var p = iso.split('-'); var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return SDOW[dt.getDay()] + ', ' + SMO[dt.getMonth()] + ' ' + dt.getDate();
  }
  function shiftISO(iso, days) {
    var base = iso ? (function () { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); })() : new Date();
    base.setDate(base.getDate() + days);
    return base.getFullYear() + '-' + two(base.getMonth() + 1) + '-' + two(base.getDate());
  }

  function relTime(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    var m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24);
    if (d === 1) return 'yesterday';
    return d + ' days ago';
  }

  function render() {
    if (LC.get('screen') === 'braindump') {
      var el = document.getElementById('screen-braindump');
      var lens = LC.get('lens');

      if (lens === 'dump') {
        el.innerHTML = renderDumpView();
      } else if (LC.get('projOpen')) {
        el.innerHTML = renderProjectDetail(LC.get('projOpen'));
      } else {
        el.innerHTML = renderProjectsView();
      }
    }
    renderDrawer();
  }

  /* ══════════════════════════════════════════
     Brain Dump View
     ══════════════════════════════════════════ */
  function renderDumpView() {
    var items = loadDump();
    var d = new Date();
    var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var dateStr = DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ' · ' + LC.fmtTime(d.getHours() * 60 + d.getMinutes());

    var html = '<div class="bd-wrap">';
    html += '<div class="bd-grid">';

    /* ── Left column ── */
    html += '<div class="bd-left">';
    html += '<div class="bd-header">';
    html += '<h1 class="bd-title serif">Brain dump</h1>';
    html += '<div class="bd-date"><i class="ti ti-calendar"></i> ' + dateStr + '</div>';
    html += '<p class="bd-desc">Empty your head here — capture any task, thought, or plan the moment it lands. Sort, schedule, and turn them into projects later.</p>';
    html += '</div>';

    // Input bar
    html += '<div class="bd-input" data-action="add-dump">';
    html += '<i class="ti ti-plus bd-input-icon"></i>';
    html += '<span class="bd-input-placeholder">Add a task or thought…</span>';
    html += '<span class="bd-input-spacer"></span>';
    html += '<div class="bd-input-types">';
    html += '<span class="bd-type-pill active"><i class="ti ti-circle"></i> Task</span>';
    html += '<span class="bd-type-pill"><i class="ti ti-calendar"></i> Event</span>';
    html += '<span class="bd-type-pill"><i class="ti ti-target"></i> Project</span>';
    html += '</div>';
    html += '</div>';

    // Section label
    var unplanned = items.filter(function (i) { return !i.date; });
    html += '<div class="bd-section-label"><i class="ti ti-stack-2"></i><span class="bd-section-count">Unplanned · ' + unplanned.length + '</span><span class="bd-section-sort">oldest first</span></div>';

    // Items
    html += '<div class="bd-items">';
    if (items.length === 0) {
      html += '<div class="bd-empty">No thoughts yet. Add something above.</div>';
    }
    items.forEach(function (item) {
      var hasDate = !!item.date;
      var opacity = hasDate ? '' : ' style="opacity:.66"';
      var borderClass = hasDate ? ' bd-item-scheduled' : '';

      html += '<div class="bd-item' + borderClass + '"' + opacity + ' data-dump-id="' + item.id + '">';
      if (item.type === 'event') {
        html += '<span class="bd-item-bar-event"></span>';
      }
      html += '<div class="bd-item-body">';
      html += '<div class="bd-item-title">';
      html += esc(item.title);
      if (item.type === 'event') {
        html += ' <span class="bd-item-badge event">Event</span>';
      }
      html += '</div>';
      html += '<div class="bd-item-meta">' + relTime(item.created) + '</div>';
      html += '</div>';

      if (hasDate) {
        html += '<span class="bd-item-check done"><i class="ti ti-check"></i></span>';
      } else {
        html += '<span class="bd-item-date-btn" data-action="schedule-dump" data-dump-id="' + item.id + '"><i class="ti ti-calendar-plus"></i> Date & time</span>';
      }
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    /* ── Right column ── */
    html += '<div class="bd-right">';

    // Carried over panel
    html += '<div class="bd-carried">';
    html += '<div class="bd-carried-header"><div class="bd-carried-label"><i class="ti ti-history"></i><span>Carried over · 0</span></div></div>';
    html += '<div class="bd-carried-empty">Nothing carried over. Nice work!</div>';
    html += '</div>';

    // History
    html += '<div class="bd-history"><i class="ti ti-chevron-right"></i><span>History</span><span class="bd-history-count">· 0 scheduled</span></div>';

    html += '</div>';
    html += '</div>'; // bd-grid
    html += '</div>'; // bd-wrap

    return html;
  }

  /* ══════════════════════════════════════════
     Projects View
     ══════════════════════════════════════════ */
  function daysToGo(p) { return typeof p.daysToGo === 'number' ? p.daysToGo : 999; }
  function byDays(a, b) { return daysToGo(a) - daysToGo(b); }

  function renderProjectsView() {
    var projects = loadProjects();
    var view = LC.get('projView') || 'urgency';
    var active = projects.filter(function (p) { return !p.completed; });
    var completedCount = projects.filter(function (p) { return p.completed; }).length;

    var html = '<div class="pj-wrap"><div class="pj-panel">';

    /* Topbar: sort label + New project */
    html += '<div class="pj-topbar">';
    html += '<span class="pj-sort-label">Sorted by ' + (view === 'spine' ? 'deadline' : 'urgency') + '</span>';
    html += '<button class="pj-new-btn" data-action="new-project"><i class="ti ti-plus"></i> New project</button>';
    html += '</div>';

    if (active.length === 0) {
      html += '<div class="pj-empty">';
      html += '<i class="ti ti-target" style="font-size:28px;color:var(--haze);margin-bottom:12px"></i>';
      html += '<div style="font-size:14px;color:var(--haze);margin-bottom:6px">No projects yet</div>';
      html += '<div style="font-size:12px;color:var(--haze)">Add one with “New project”, or turn a Brain dump item into a project.</div>';
      html += '</div>';
    } else if (view === 'spine') {
      html += renderSpineView(active);
    } else {
      html += renderUrgencyView(active);
    }

    /* Completed footer */
    if (active.length > 0) {
      html += '<div class="pj-completed" data-action="open-completed">';
      html += '<i class="ti ti-chevron-right"></i>';
      html += '<i class="ti ti-circle-check-filled pj-completed-check"></i>';
      html += '<span class="pj-completed-label">Completed</span>';
      if (completedCount > 0) {
        html += '<span class="pj-completed-count">· ' + completedCount + ' project' + (completedCount !== 1 ? 's' : '') + '</span>';
      }
      html += '</div>';
    }

    html += '</div></div>';
    return html;
  }

  /* ── Urgency list ── */
  function renderUrgencyView(active) {
    var week = active.filter(function (p) { return daysToGo(p) <= 7; }).sort(byDays);
    var later = active.filter(function (p) { return daysToGo(p) > 7; }).sort(byDays);
    var html = '';

    if (week.length) {
      html += '<div class="pj-section-label">This week</div>';
      html += '<div class="pj-list">';
      week.forEach(function (p) { html += renderUrgencyRow(p); });
      html += '</div>';
    }
    if (later.length) {
      html += '<div class="pj-section-label pj-section-later">Later</div>';
      html += '<div class="pj-list">';
      later.forEach(function (p) { html += renderUrgencyRow(p); });
      html += '</div>';
    }
    return html;
  }

  function renderUrgencyRow(p) {
    var total = p.total || 0, done = p.done || 0;
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var left = Math.max(0, total - done);
    var d = daysToGo(p);

    var html = '<button class="pj-urow' + (p.urgent ? ' urgent' : '') + '" data-action="open-project" data-project-id="' + esc(p.id) + '">';
    html += '<div class="pj-urow-main">';
    html += '<div class="pj-urow-title">' + esc(p.title) + '</div>';
    if (p.urgent) {
      html += '<div class="pj-urow-sub urgent"><i class="ti ti-alert-triangle"></i> ' + left + ' session' + (left !== 1 ? 's' : '') + ' left · ' + d + ' day' + (d !== 1 ? 's' : '') + ' to go</div>';
    } else {
      html += '<div class="pj-urow-sub">' + esc(p.sub || ('due ' + (p.due || ''))) + '</div>';
    }
    html += '</div>';
    html += '<div class="pj-urow-prog">';
    html += '<div class="pj-urow-prog-head"><span>' + done + ' of ' + total + '</span><span>sessions</span></div>';
    html += '<div class="pj-urow-bar"><span class="pj-urow-fill" style="width:' + pct + '%"></span></div>';
    html += '</div>';
    html += '<i class="ti ti-chevron-right pj-urow-chev"></i>';
    html += '</button>';
    return html;
  }

  /* ── Deadline spine ── */
  function renderSpineView(active) {
    var sorted = active.slice().sort(byDays);
    var html = '<div class="pj-spine">';
    html += '<span class="pj-spine-line"></span>';
    sorted.forEach(function (p) { html += renderSpineRow(p); });
    html += '</div>';
    return html;
  }

  function renderSpineRow(p) {
    var total = p.total || 0, done = p.done || 0;
    var left = Math.max(0, total - done);
    var d = daysToGo(p);

    var html = '<div class="pj-spine-row">';
    html += '<div class="pj-spine-badge' + (p.urgent ? ' urgent' : '') + '">';
    html += '<span class="pj-spine-days">' + d + '</span>';
    html += '<span class="pj-spine-dayslabel">days</span>';
    html += '</div>';
    html += '<button class="pj-spine-card' + (p.urgent ? ' urgent' : '') + '" data-action="open-project" data-project-id="' + esc(p.id) + '">';
    html += '<div class="pj-spine-main">';
    html += '<div class="pj-spine-title">' + esc(p.title) + '</div>';
    if (p.urgent) {
      html += '<div class="pj-spine-sub urgent">' + left + ' session' + (left !== 1 ? 's' : '') + ' left to finish in time</div>';
    } else {
      html += '<div class="pj-spine-sub">' + esc(p.subSpine || p.sub || ('due ' + (p.due || ''))) + '</div>';
    }
    html += '</div>';
    html += '<div class="pj-spine-dots">';
    for (var i = 0; i < total; i++) {
      html += '<span class="pj-dot' + (i < done ? ' filled' : '') + '"></span>';
    }
    html += '</div>';
    html += '</button>';
    html += '</div>';
    return html;
  }

  /* ══════════════════════════════════════════
     Project Detail
     ══════════════════════════════════════════ */
  function defaultPlan(p) {
    return { count: p.total || 4, dayFlags: [true, false, true, false, true, false, false], start: '4:00 PM', length: '1h' };
  }

  /* Plan parsing for auto-placement (①c). dayFlags are Mon-first; map to getDay(). */
  function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parsePlanClock(str) {
    var m = /(\d+):(\d+)\s*(AM|PM)?/i.exec(str || '');
    if (!m) return 960;
    var h = parseInt(m[1], 10), min = parseInt(m[2], 10), ap = (m[3] || '').toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  function parsePlanLength(str) {
    var s = (str || '').toLowerCase();
    var hm = /([\d.]+)\s*h/.exec(s), mm = /(\d+)\s*m/.exec(s);
    var total = 0;
    if (hm) total += Math.round(parseFloat(hm[1]) * 60);
    if (mm) total += parseInt(mm[1], 10);
    return total || 60;
  }
  function planWeekdays(plan) {
    var out = [];
    (plan.dayFlags || []).forEach(function (on, i) { if (on) out.push((i + 1) % 7); }); // Mon-first idx → getDay()
    return out;
  }

  function getSessions(p) {
    if (p.sessions && p.sessions.length) return p.sessions;
    var arr = [];
    var total = p.total || 0, done = p.done || 0;
    for (var i = 0; i < total; i++) {
      arr.push({ label: 'Session ' + (i + 1), dateLabel: '', timeLabel: '', done: i < done });
    }
    return arr;
  }

  function renderProjectDetail(id) {
    var projects = loadProjects();
    var p = projects.find(function (x) { return x.id === id; });
    if (!p) return renderProjectsView();

    var plan = p.plan || defaultPlan(p);
    var sessions = getSessions(p);
    var total = sessions.length;
    var done = sessions.filter(function (s) { return s.done; }).length;
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var left = Math.max(0, total - done);
    var d = daysToGo(p);
    var kind = p.kind || 'Project';
    var dueFull = p.dueFull || p.due || '';

    var html = '<div class="pd-wrap"><div class="pd-panel">';

    /* Header */
    html += '<div class="pd-head">';
    html += '<div class="pd-head-main">';
    html += '<div class="pd-title serif">' + esc(p.title) + '</div>';
    html += '<div class="pd-subtitle">' + esc(kind) + ' · ' + total + ' session' + (total !== 1 ? 's' : '') + ' planned</div>';
    html += '</div>';
    html += '<span class="pd-due"><i class="ti ti-calendar-event"></i> Due ' + esc(dueFull) + ' <i class="ti ti-pencil pd-due-edit"></i></span>';
    html += '</div>';

    /* Status row */
    html += '<div class="pd-status">';
    if (p.urgent) {
      html += '<div class="pd-alert"><i class="ti ti-alert-triangle"></i><span>' + left + ' session' + (left !== 1 ? 's' : '') + ' left, ' + d + ' day' + (d !== 1 ? 's' : '') + ' to go.</span></div>';
    } else {
      html += '<div class="pd-alert calm"><i class="ti ti-clock"></i><span>' + left + ' session' + (left !== 1 ? 's' : '') + ' left · due in ' + d + ' day' + (d !== 1 ? 's' : '') + '.</span></div>';
    }
    html += '<div class="pd-overall">';
    html += '<div class="pd-overall-head"><span>Overall</span><span>' + done + ' of ' + total + ' done</span></div>';
    html += '<div class="pd-overall-bar"><span class="pd-overall-fill" style="width:' + pct + '%"></span></div>';
    html += '</div>';
    html += '</div>';

    /* Session plan */
    html += '<div class="pd-plan">';
    html += '<div class="pd-plan-label">Session plan</div>';
    html += '<div class="pd-plan-row">';
    html += '<div class="pd-plan-field"><div class="pd-plan-field-label">Sessions</div>';
    html += '<div class="pd-stepper"><button class="pd-step" data-action="proj-sessions-minus">−</button><span class="pd-step-val">' + total + '</span><button class="pd-step" data-action="proj-sessions-plus">+</button></div></div>';
    html += '<div class="pd-plan-field"><div class="pd-plan-field-label">Days</div><div class="pd-days">';
    var letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    letters.forEach(function (ltr, i) {
      var on = plan.dayFlags && plan.dayFlags[i];
      html += '<span class="pd-day' + (on ? ' on' : '') + '" data-action="proj-day" data-day="' + i + '">' + ltr + '</span>';
    });
    html += '</div></div>';
    html += '<div class="pd-plan-field"><div class="pd-plan-field-label">Start</div><span class="pd-plan-pill"><i class="ti ti-clock"></i> ' + esc(plan.start) + '</span></div>';
    html += '<div class="pd-plan-field"><div class="pd-plan-field-label">Length</div><span class="pd-plan-pill"><i class="ti ti-hourglass"></i> ' + esc(plan.length) + '</span></div>';
    html += '</div></div>';

    /* Sessions */
    html += '<div class="pd-sessions-head"><span>Sessions</span><span class="pd-sessions-hint">tap a row to edit</span></div>';
    html += '<div class="pd-sessions">';
    sessions.forEach(function (s, i) { html += renderSession(s, i); });
    html += '<button class="pd-add-session" data-action="proj-add-session"><i class="ti ti-plus"></i> Add a session</button>';
    html += '</div>';

    /* Approve footer */
    var cleanPending = sessions.filter(function (s) { return !s.done && !s.conflict && !s.confirmed; }).length;
    if (cleanPending > 0) {
      html += '<div class="pd-approve">';
      html += '<span class="pd-approve-text">One busy slot won’t block the rest — approve the clean sessions now.</span>';
      html += '<button class="pd-approve-btn" data-action="proj-approve">Approve ' + cleanPending + ' clean session' + (cleanPending !== 1 ? 's' : '') + ' <i class="ti ti-arrow-right"></i></button>';
      html += '</div>';
    }

    html += '</div></div>';
    return html;
  }

  function sessionTime(s) {
    if (s.startMin != null) return fmtRange(s.startMin, s.durationMin || 60);
    return s.timeLabel || '';
  }

  function renderSession(s, i) {
    var timeStr = sessionTime(s);
    var meta = s.dateLabel ? (esc(s.dateLabel) + (timeStr ? ' · ' + esc(timeStr) : '')) : 'Not scheduled yet';

    if (s.conflict) {
      var ch = '<div class="pd-session-conflict">';
      ch += '<button class="pd-session in-conflict" data-action="open-session" data-session="' + i + '">';
      ch += '<span class="pd-session-num amber" data-action="toggle-session" data-session="' + i + '">' + (i + 1) + '</span>';
      ch += '<div class="pd-session-main"><div class="pd-session-title amber">' + esc(s.label) + '</div>';
      ch += '<div class="pd-session-meta">' + meta + (s.secondSameDay ? ' <span class="pd-amber">· second session that day</span>' : '') + '</div></div>';
      ch += '<i class="ti ti-pencil pd-session-pencil"></i>';
      ch += '</button>';
      ch += '<div class="pd-conflict-note"><span class="pd-conflict-text">' + s.conflict.note + '</span><span class="pd-conflict-spacer"></span><span class="pd-conflict-assign" data-action="proj-assign-anyway" data-session="' + i + '">Assign anyway</span><span class="pd-conflict-pick" data-action="proj-pick-time" data-session="' + i + '">Pick a date &amp; time</span></div>';
      ch += '</div>';
      return ch;
    }

    var cls = 'pd-session' + (s.done ? ' done' : ' pending');
    var html = '<button class="' + cls + '" data-action="open-session" data-session="' + i + '">';
    if (s.done) {
      html += '<span class="pd-session-check" data-action="toggle-session" data-session="' + i + '"><i class="ti ti-check"></i></span>';
    } else {
      html += '<span class="pd-session-num pending" data-action="toggle-session" data-session="' + i + '">' + (i + 1) + '</span>';
    }
    html += '<div class="pd-session-main">';
    html += '<div class="pd-session-title' + (s.done ? ' done' : ' pending') + '">' + esc(s.label) + (s.today ? ' <span class="pd-session-today">· today</span>' : '') + '</div>';
    html += '<div class="pd-session-meta">' + meta + '</div>';
    html += '</div>';
    if (!s.done) html += '<i class="ti ti-pencil pd-session-pencil"></i>';
    html += '</button>';
    return html;
  }

  function updateProject(id, fn) {
    var projects = loadProjects();
    var p = projects.find(function (x) { return x.id === id; });
    if (!p) return;
    fn(p);
    saveProjects(projects);
    render();
  }

  /* ══════════════════════════════════════════
     Session drawer (LucSession)
     ══════════════════════════════════════════ */
  function clearOwnDrawer(overlay) {
    if (overlay.getAttribute('data-drawer') === 'session') {
      overlay.innerHTML = '';
      overlay.removeAttribute('data-drawer');
      overlay.classList.remove('open');
    }
  }

  function renderDrawer() {
    var overlay = document.getElementById('overlay');
    if (!overlay) return;
    var sIdx = LC.get('sessionOpen');
    var show = LC.get('projOpen') && sIdx != null;

    if (!show) { clearOwnDrawer(overlay); return; }

    var p = loadProjects().find(function (x) { return x.id === LC.get('projOpen'); });
    var sessions = p ? getSessions(p) : null;
    var s = sessions ? sessions[sIdx] : null;
    if (!s) { clearOwnDrawer(overlay); return; }

    overlay.innerHTML = renderSessionDrawer(p, s, sIdx, sessions.length);
    overlay.setAttribute('data-drawer', 'session');
    overlay.classList.add('open');

    var subInp = overlay.querySelector('.ls-sub-input');
    if (subInp) {
      subInp.focus();
      subInp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commitSubtask(subInp.value); }
        if (e.key === 'Escape') { subAdding = false; render(); }
      });
      subInp.addEventListener('blur', function () { commitSubtask(subInp.value); });
    }
  }

  function renderSessionDrawer(p, s, idx, totalSessions) {
    var startMin = s.startMin != null ? s.startMin : 960;
    var durMin = s.durationMin || 60;
    var subtasks = s.subtasks || [];
    var subDone = subtasks.filter(function (x) { return x.done; }).length;

    var h = '<div class="ls-backdrop" data-action="close-session"></div>';
    h += '<aside class="ls-drawer">';

    h += '<header class="ls-head"><span class="ls-head-label">Edit session</span><button class="ls-close" data-action="close-session"><i class="ti ti-x"></i></button></header>';

    h += '<div class="ls-body">';

    /* Project context */
    h += '<button class="ls-ctx" data-action="open-project-from-drawer">';
    h += '<div class="ls-ctx-top"><span class="ls-ctx-name">' + esc(p.title) + '</span><span class="ls-ctx-open">Open project <i class="ti ti-arrow-up-right"></i></span></div>';
    h += '<div class="ls-ctx-sub">Session ' + (idx + 1) + ' of ' + totalSessions + (p.dueFull ? ' · due ' + esc(p.dueFull) : '') + '</div>';
    h += '</button>';

    /* Complete + title */
    h += '<div class="ls-titlerow">';
    h += '<button class="ls-complete' + (s.done ? ' done' : '') + '" data-action="session-complete"><i class="ti ' + (s.done ? 'ti-circle-check-filled' : 'ti-circle') + '"></i></button>';
    h += '<div class="ls-titlemain"><div class="ls-title serif">' + esc(s.label || ('Session ' + (idx + 1))) + '</div><div class="ls-title-hint">Optional — name what this session is for</div></div>';
    h += '</div>';

    /* When — editable date + start + duration */
    h += '<div class="ls-section-label">When</div>';
    h += '<div class="ls-when-date-row">';
    h += '<button class="ls-dur-btn" data-action="session-date-prev"><i class="ti ti-chevron-left"></i></button>';
    h += '<span class="ls-when-date-val"><i class="ti ti-calendar-event"></i> ' + esc(fmtSessionDate(s.date)) + '</span>';
    h += '<button class="ls-dur-btn" data-action="session-date-next"><i class="ti ti-chevron-right"></i></button>';
    h += '</div>';
    h += '<div class="ls-when">';
    h += '<div class="ls-dur"><button class="ls-dur-btn" data-action="session-start-minus">−</button><span class="ls-dur-val">' + fmtClock(startMin) + '</span><button class="ls-dur-btn" data-action="session-start-plus">+</button></div>';
    h += '<div class="ls-dur"><button class="ls-dur-btn" data-action="session-dur-minus">−</button><span class="ls-dur-val">' + fmtDurShort(durMin) + '</span><button class="ls-dur-btn" data-action="session-dur-plus">+</button></div>';
    h += '</div>';
    h += '<div class="ls-when-hint">Ends ' + fmtClock(startMin + durMin) + ' · ' + (s.date ? 'on your calendar' : 'set a date to schedule it') + '</div>';

    /* Start focus */
    h += '<button class="ls-focus-btn" data-action="session-start-focus"><i class="ti ti-player-play-filled"></i> Start focus · Sprint</button>';

    /* Subtasks */
    h += '<div class="ls-section-label">Subtasks · ' + subDone + '/' + subtasks.length + '</div>';
    h += '<div class="ls-subs">';
    subtasks.forEach(function (st, si) {
      h += '<div class="ls-sub"><button class="ls-sub-check" data-action="subtask-toggle" data-sub="' + si + '"><i class="ti ' + (st.done ? 'ti-square-rounded-check-filled' : 'ti-square-rounded') + '"></i></button><span class="ls-sub-label' + (st.done ? ' done' : '') + '">' + esc(st.label) + '</span></div>';
    });
    h += '</div>';
    if (subAdding) {
      h += '<div class="ls-sub-add-row"><i class="ti ti-square-rounded"></i><input class="ls-sub-input" type="text" placeholder="New subtask"></div>';
    } else {
      h += '<button class="ls-add-sub" data-action="subtask-add"><i class="ti ti-plus"></i> Add subtask</button>';
    }

    /* Session notes */
    h += '<div class="ls-section-label ls-notes-label">Session notes <i class="ti ti-lock"></i></div>';
    h += '<textarea class="ls-notes-input" placeholder="Notes for just this session…">' + esc(s.notes || '') + '</textarea>';
    h += '<div class="ls-notes-hint">Stays with this session — never added to your Notes history.</div>';

    h += '</div>';

    h += '<footer class="ls-foot">';
    h += '<button class="ls-unschedule" data-action="session-unschedule"><i class="ti ti-calendar-off"></i> Unschedule</button>';
    h += '<button class="ls-save" data-action="session-save">Save changes</button>';
    h += '</footer>';

    h += '</aside>';
    return h;
  }

  function currentNotes() {
    var ta = document.querySelector('.ls-notes-input');
    return ta ? ta.value : null;
  }

  function saveSessionNotes() {
    var notes = currentNotes();
    if (notes == null) return;
    var projects = loadProjects();
    var p = projects.find(function (x) { return x.id === LC.get('projOpen'); });
    if (!p) return;
    var sessions = getSessions(p); p.sessions = sessions;
    var s = sessions[LC.get('sessionOpen')];
    if (s) s.notes = notes;
    saveProjects(projects);
  }

  function updateSession(fn) {
    var notes = currentNotes();
    updateProject(LC.get('projOpen'), function (p) {
      var sessions = getSessions(p); p.sessions = sessions;
      var s = sessions[LC.get('sessionOpen')];
      if (!s) return;
      if (notes != null) s.notes = notes;
      fn(s, p, sessions);
    });
  }

  function commitSubtask(val) {
    if (!subAdding) return;
    var text = (val || '').trim();
    subAdding = false;
    if (text) {
      updateSession(function (s) {
        s.subtasks = s.subtasks || [];
        s.subtasks.push({ label: text, done: false });
      });
    } else {
      render();
    }
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    var action = e.target.closest('[data-action]');
    if (!action) return;
    var a = action.dataset.action;

    if (a === 'open-project') {
      LC.set({ projOpen: action.dataset.projectId });
      return;
    }

    if (a === 'new-project') {
      var projects = loadProjects();
      var np = { id: 'p' + Date.now(), title: 'New project', total: 4, done: 0, daysToGo: 7, urgent: false, due: '', plan: defaultPlan({ total: 4 }), sessions: [] };
      projects.push(np);
      saveProjects(projects);
      LC.set({ projOpen: np.id });
      return;
    }

    if (a === 'toggle-session') {
      var sid = parseInt(action.dataset.session, 10);
      updateProject(LC.get('projOpen'), function (p) {
        var sessions = getSessions(p);
        p.sessions = sessions;
        if (sessions[sid]) sessions[sid].done = !sessions[sid].done;
        p.done = sessions.filter(function (s) { return s.done; }).length;
        p.total = sessions.length;
      });
      return;
    }

    if (a === 'proj-sessions-plus' || a === 'proj-add-session') {
      updateProject(LC.get('projOpen'), function (p) {
        var sessions = getSessions(p);
        p.sessions = sessions;
        sessions.push({ label: 'Session ' + (sessions.length + 1), dateLabel: '', timeLabel: '', done: false });
        p.total = sessions.length;
        p.done = sessions.filter(function (s) { return s.done; }).length;
      });
      return;
    }

    if (a === 'proj-sessions-minus') {
      updateProject(LC.get('projOpen'), function (p) {
        var sessions = getSessions(p);
        p.sessions = sessions;
        if (sessions.length > 1) sessions.pop();
        p.total = sessions.length;
        p.done = sessions.filter(function (s) { return s.done; }).length;
      });
      return;
    }

    if (a === 'proj-day') {
      var di = parseInt(action.dataset.day, 10);
      updateProject(LC.get('projOpen'), function (p) {
        p.plan = p.plan || defaultPlan(p);
        p.plan.dayFlags[di] = !p.plan.dayFlags[di];
      });
      return;
    }

    /* ── Detail actions ── */
    if (a === 'proj-assign-anyway') {
      var asi = parseInt(action.dataset.session, 10);
      updateProject(LC.get('projOpen'), function (p) {
        var sessions = getSessions(p); p.sessions = sessions;
        if (sessions[asi]) { delete sessions[asi].conflict; delete sessions[asi].secondSameDay; }
      });
      return;
    }

    if (a === 'proj-pick-time') {
      subAdding = false;
      LC.set({ sessionOpen: parseInt(action.dataset.session, 10) });
      return;
    }

    if (a === 'proj-approve') {
      updateProject(LC.get('projOpen'), function (p) {
        var sessions = getSessions(p); p.sessions = sessions;
        var plan = p.plan || defaultPlan(p);
        var startMin = parsePlanClock(plan.start);
        var durMin = parsePlanLength(plan.length);
        var allowed = planWeekdays(plan);           // getDay() values allowed
        var used = {};
        sessions.forEach(function (s) { if (s.date) used[s.date] = true; });
        var cursor = new Date(); cursor.setHours(0, 0, 0, 0);
        function nextSlot() {
          for (var guard = 0; guard < 400; guard++) {
            cursor.setDate(cursor.getDate() + 1);      // start from tomorrow, step forward
            var ds = isoDate(cursor);
            if ((!allowed.length || allowed.indexOf(cursor.getDay()) >= 0) && !used[ds]) {
              used[ds] = true; return ds;
            }
          }
          return null;
        }
        sessions.forEach(function (s) {
          if (s.done || s.conflict) return;
          if (!s.date) {                                // auto-place undated clean sessions
            var ds = nextSlot();
            if (ds) {
              s.date = ds;
              if (s.startMin == null) s.startMin = startMin;
              if (s.durationMin == null) s.durationMin = durMin;
            }
          }
          s.confirmed = true;
        });
      });
      return;
    }

    /* ── Session drawer ── */
    if (a === 'open-session') {
      subAdding = false;
      LC.set({ sessionOpen: parseInt(action.dataset.session, 10) });
      return;
    }

    if (a === 'session-save' || a === 'close-session' || a === 'open-project-from-drawer') {
      saveSessionNotes();
      subAdding = false;
      LC.set({ sessionOpen: null });
      return;
    }

    if (a === 'session-complete') {
      updateSession(function (s, p, sessions) {
        s.done = !s.done;
        p.done = sessions.filter(function (x) { return x.done; }).length;
        p.total = sessions.length;
      });
      return;
    }

    if (a === 'session-dur-minus' || a === 'session-dur-plus') {
      var dd = a === 'session-dur-plus' ? 15 : -15;
      updateSession(function (s) { s.durationMin = Math.max(15, (s.durationMin || 60) + dd); });
      return;
    }

    if (a === 'session-start-minus' || a === 'session-start-plus') {
      var st = a === 'session-start-plus' ? 15 : -15;
      updateSession(function (s) { s.startMin = Math.max(0, Math.min(1425, (s.startMin != null ? s.startMin : 960) + st)); });
      return;
    }

    if (a === 'session-date-prev' || a === 'session-date-next') {
      var dir = a === 'session-date-next' ? 1 : -1;
      updateSession(function (s) { s.date = shiftISO(s.date, dir); s.dateLabel = fmtSessionDate(s.date); });
      return;
    }

    if (a === 'subtask-toggle') {
      var subi = parseInt(action.dataset.sub, 10);
      updateSession(function (s) {
        s.subtasks = s.subtasks || [];
        if (s.subtasks[subi]) s.subtasks[subi].done = !s.subtasks[subi].done;
      });
      return;
    }

    if (a === 'subtask-add') {
      saveSessionNotes();
      subAdding = true;
      render();
      return;
    }

    if (a === 'session-unschedule') {
      updateSession(function (s) { s.dateLabel = ''; s.startMin = null; s.timeLabel = ''; });
      LC.set({ sessionOpen: null });
      return;
    }

    if (a === 'session-start-focus') {
      saveSessionNotes();
      LC.set({ sessionOpen: null, screen: 'focus' });
      return;
    }

    if (a === 'add-dump') {
      var val = prompt('Add a task or thought:');
      if (val && val.trim()) {
        var items = loadDump();
        items.push({ id: Date.now().toString(), title: val.trim(), type: 'task', created: Date.now(), date: null });
        saveDump(items);
        render();
      }
    }

    if (a === 'schedule-dump') {
      var id = action.dataset.dumpId;
      var items = loadDump();
      var item = items.find(function (i) { return i.id === id; });
      if (item) {
        var taskId = window.LC_Today ? LC_Today.scheduleFromDump(item.title, item.type) : null;
        if (taskId) {                       // real task created + editor opened on Today
          item.date = todayISO();
          item.taskId = taskId;             // link kept so the item shows as scheduled
          saveDump(items);
        }
        // if scheduling was blocked (slot full), LC_Today toasts and returns null — leave item as-is
      }
    }
  });

  LC.on(render);
  window.LC_BrainDump = { render: render };
})();

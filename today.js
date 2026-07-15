/* ══════════════════════════════════════════
   Luclaro — Today / Day View
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  var KEY_TASKS = 'tasks';
  var KEY_NOTES = 'notes';

  function loadTasks() { return LC.loadData(KEY_TASKS) || []; }
  function saveTasks(arr) { LC.saveData(KEY_TASKS, arr); }
  function loadProjects() { return LC.loadData('projects') || []; }
  function saveProjects(arr) { LC.saveData('projects', arr); }

  /* Project sessions scheduled on a given date, as grid blocks. */
  function sessionsForDate(date) {
    var out = [];
    loadProjects().forEach(function (p) {
      (p.sessions || []).forEach(function (s, idx) {
        if (s.date === date && s.startMin != null) {
          out.push({
            _kind: 'session', projectId: p.id, sessionIdx: idx,
            projectTitle: p.title, label: s.label,
            startMin: s.startMin, duration: s.durationMin || 60,
            done: !!s.done
          });
        }
      });
    });
    return out;
  }

  /* Intention IS the daily note's "morning" field — one source of truth shared with Notes. */
  function loadIntention() {
    var notes = LC.loadData(KEY_NOTES) || {};
    var n = notes['daily:' + todayStr()];
    var text = (n && n.morning) ? n.morning : '';
    return { text: text, date: text ? todayStr() : null };
  }
  function saveIntention(obj) {
    var notes = LC.loadData(KEY_NOTES) || {};
    var key = 'daily:' + todayStr();
    notes[key] = notes[key] || {};
    notes[key].morning = (obj && obj.text) ? obj.text : '';
    notes[key]._saved = Date.now();
    LC.saveData(KEY_NOTES, notes);
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function nowMinutes() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function tasksForDate(tasks, date) {
    return tasks.filter(function (t) { return t.date === date; });
  }

  var MAX_OVERLAP = 3;

  /* Assign each timed item a column (_col) and its cluster width (_cols) for side-by-side layout. */
  function layoutColumns(items) {
    var sorted = items.slice().sort(function (a, b) {
      return a.startMin - b.startMin || (a.duration || 30) - (b.duration || 30);
    });
    var cluster = [], clusterEnd = -1;
    function flush() {
      var colEnds = [];
      cluster.forEach(function (it) {
        var s = it.startMin, e = s + (it.duration || 30), col = -1;
        for (var i = 0; i < colEnds.length; i++) { if (s >= colEnds[i]) { col = i; break; } }
        if (col === -1) { col = colEnds.length; colEnds.push(e); } else { colEnds[col] = e; }
        it._col = col;
      });
      cluster.forEach(function (it) { it._cols = colEnds.length; });
      cluster = []; clusterEnd = -1;
    }
    sorted.forEach(function (it) {
      var s = it.startMin, e = s + (it.duration || 30);
      if (cluster.length && s >= clusterEnd) flush();
      cluster.push(it); clusterEnd = Math.max(clusterEnd, e);
    });
    if (cluster.length) flush();
    return items;
  }

  /* Would placing [start, start+dur) (excluding taskId) keep peak concurrency ≤ MAX_OVERLAP? */
  function canPlace(taskId, start, dur) {
    var end = start + dur;
    var others = loadTasks().filter(function (t) {
      return t.id !== taskId && t.date === todayStr() && t.startMin != null;
    }).map(function (t) { return { s: t.startMin, e: t.startMin + (t.duration || 30) }; });
    sessionsForDate(todayStr()).forEach(function (ss) { others.push({ s: ss.startMin, e: ss.startMin + ss.duration }); });
    others.push({ s: start, e: end });
    var points = [start];
    others.forEach(function (it) { if (it.s > start && it.s < end) points.push(it.s); });
    var peak = 0;
    points.forEach(function (p) {
      var c = 0;
      others.forEach(function (it) { if (it.s <= p && p < it.e) c++; });
      if (c > peak) peak = c;
    });
    return peak <= MAX_OVERLAP;
  }

  /* Protected routine active today that [start,start+dur) would overlap, if any. */
  function protectedConflict(start, dur) {
    var end = start + dur;
    var dow = new Date().getDay();
    var routines = (window.LC_Routines ? window.LC_Routines.loadRoutines() : []);
    var hit = routines.filter(function (r) {
      return r.protected && r.days && r.days.indexOf(dow) >= 0 && start < r.endMin && end > r.startMin;
    })[0];
    return hit ? hit.name : null;
  }

  /* Combined placement gate → message string if blocked, else null. */
  function placementBlock(taskId, start, dur) {
    var pc = protectedConflict(start, dur);
    if (pc) return '“' + pc + '” is locked — nothing can be scheduled then';
    if (!canPlace(taskId, start, dur)) return 'Only ' + MAX_OVERLAP + ' items can overlap in one slot';
    return null;
  }

  var toastTimer = null;
  function showToast(msg) {
    var el = document.querySelector('.lc-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'lc-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove('hide');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); el.classList.add('hide'); }, 2200);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

  /* ── Typewriter intention ── */
  var INTN_PH = [
    'Finish the history essay',
    'Call mom back today',
    'Rest without guilt',
    'Send the portfolio draft',
    'Pray before the inbox'
  ];
  var intnSIdx = 0;
  var intnCIdx = 0;
  var intnDel = false;
  var intnHold = false;
  var intnPh = '';
  var intnTimer = null;
  var intnEditing = false;

  function intnTick() {
    var intention = loadIntention();
    if ((intention.text && intention.date === todayStr()) || intnEditing) {
      intnTimer = setTimeout(intnTick, 500);
      return;
    }
    var full = INTN_PH[intnSIdx % INTN_PH.length];
    var delay = 145;

    if (!intnDel) {
      if (intnCIdx < full.length) {
        intnCIdx++;
      } else if (!intnHold) {
        intnHold = true;
        delay = 4200;
      } else {
        intnHold = false;
        intnDel = true;
        delay = 70;
      }
    } else {
      if (intnCIdx > 0) {
        intnCIdx--;
        delay = 70;
      } else {
        intnSIdx++;
        intnCIdx = 0;
        intnDel = false;
        intnHold = false;
        intnPh = '';
        intnTimer = setTimeout(intnTick, 360);
        updateIntentionDisplay();
        return;
      }
    }

    intnPh = full.slice(0, intnCIdx);
    updateIntentionDisplay();
    intnTimer = setTimeout(intnTick, delay);
  }

  function updateIntentionDisplay() {
    var wrap = document.querySelector('.today-intention-value');
    if (!wrap) return;

    var intention = loadIntention();
    if (intention.text && intention.date === todayStr()) return;
    if (intnEditing) return;

    var full = INTN_PH[intnSIdx % INTN_PH.length];
    var done = !intnDel && intnCIdx >= full.length;

    var html = '<span data-action="edit-intention" style="color:var(--haze);cursor:text">' + esc(intnPh);
    if (done) html += '<span style="color:var(--accent)">.</span>';
    html += '<span class="intn-caret"></span>';
    html += '</span>';

    wrap.innerHTML = html;
  }

  function intnEdit() {
    intnEditing = true;
    clearTimeout(intnTimer);

    var wrap = document.querySelector('.today-intention-value');
    if (!wrap) return;

    var intention = loadIntention();
    var current = (intention.text && intention.date === todayStr()) ? intention.text : '';

    wrap.innerHTML = '<input class="intn-input" type="text" value="' + escAttr(current) + '" placeholder="What matters most today?">';

    var input = wrap.querySelector('.intn-input');
    if (input) {
      input.focus();
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); intnCommit(input.value); }
        if (e.key === 'Escape') { intnCancel(); }
      });
      input.addEventListener('blur', function () { intnCommit(input.value); });
    }
  }

  function intnCommit(val) {
    if (!intnEditing) return;
    intnEditing = false;
    var text = (val || '').trim();
    // The intention is a single-line input but shares the `morning` note field, which may be
    // multi-line. If the user didn't actually change it (the input just stripped newlines),
    // leave the original morning untouched so a multi-line note isn't collapsed.
    var current = loadIntention().text;
    // compare whitespace-insensitively: a single-line input can't represent newlines, so if the
    // only difference is whitespace/newlines the user didn't really change it — keep the original.
    var norm = function (s) { return (s || '').replace(/\s+/g, ''); };
    if (norm(text) === norm(current)) { render(); return; }
    saveIntention(text ? { text: text, date: todayStr() } : { text: '', date: null });
    render();
    if (!text) intnTick();
  }

  function intnCancel() {
    intnEditing = false;
    var intention = loadIntention();
    render();
    if (!intention.text || intention.date !== todayStr()) intnTick();
  }

  /* ── Render ── */
  function render() {
    if (LC.get('screen') !== 'today') return;

    var el = document.getElementById('screen-today');
    var tasks = loadTasks();
    var today = todayStr();
    var dayTasks = tasksForDate(tasks, today);
    var intention = loadIntention();
    var now = nowMinutes();
    var d = new Date();
    var dateLabel = (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
    var timeLabel = LC.fmtTime(now);
    var layout = LC.get('dayLayout');
    var hasIntention = intention.text && intention.date === today;

    var html = '<div class="today-wrap">';

    /* ── Intention card ── */
    html += '<div class="today-intention">';
    html += '<div class="today-intention-label"><i class="ti ti-flag-3"></i> Today\'s intention · what matters most today?</div>';
    html += '<div class="today-intention-row">';
    html += '<span class="today-intention-value serif">';

    if (hasIntention) {
      var last = intention.text.slice(-1);
      if (last === '.' || last === '!') {
        html += '<span data-action="edit-intention" style="cursor:text;color:var(--text)">' + esc(intention.text.slice(0, -1)) + '<span style="color:var(--accent)">' + esc(last) + '</span></span>';
      } else {
        html += '<span data-action="edit-intention" style="cursor:text;color:var(--text)">' + esc(intention.text) + '</span>';
      }
    } else {
      html += '<span data-action="edit-intention" style="color:var(--haze);cursor:text">' + esc(intnPh) + '<span class="intn-caret"></span></span>';
    }

    html += '</span>';
    html += '<i class="ti ti-pencil today-intention-edit" data-action="edit-intention"></i>';
    html += '</div>';

    html += '<div class="today-intention-meta"><span class="today-dot"></span> ' + dateLabel + ' · ' + timeLabel + '</div>';

    /* ── Events row ── */
    var events = dayTasks.filter(function (t) { return t.type === 'event'; });
    if (events.length > 0) {
      html += '<div class="today-intention-events">';
      html += '<span class="today-events-label">Events:</span>';
      events.forEach(function (ev, i) {
        if (i > 0) html += '<span class="today-events-sep"></span>';
        html += '<span class="today-event-chip" style="color:var(--blue)"><span class="today-event-dot" style="background:var(--blue)"></span> ' + esc(ev.title) + '</span>';
      });
      html += '</div>';
    }

    html += '</div>';

    /* ── Main area: grid + sidebar ── */
    html += '<div class="today-body">';

    html += '<div class="today-grid-area">';
    if (layout === 'grid') {
      html += renderTimeGrid(dayTasks, now);
    } else {
      html += renderAgenda(dayTasks, now);
    }
    html += '<button class="today-addtask" data-action="add-task"><i class="ti ti-plus"></i> Add task</button>';
    html += '</div>';

    var edId = LC.get('editor');
    var edTask = edId != null ? tasks.find(function (t) { return t.id === edId; }) : null;
    html += '<aside class="today-sidebar">';
    if (edTask) {
      html += '<div class="ep-aside">' + renderEditor(edTask) + '</div>';
    } else {
      html += renderSidebarCards();
    }
    html += '</aside>';

    html += '</div>';
    html += '</div>';

    el.innerHTML = html;
    attachEditorInputs();
  }

  function renderSessionBlock(s, pos) {
    var timeStr = LC.fmtTime(s.startMin) + ' – ' + LC.fmtTime(s.startMin + s.duration);
    var h = '<div class="tg-card tg-session' + (s.done ? ' tg-card-done' : '') + '" style="' + pos + '" data-action="open-session-block" data-project-id="' + esc(s.projectId) + '" data-session-idx="' + s.sessionIdx + '">';
    h += '<span class="tg-card-bar" style="background:var(--accent)"></span>';
    h += '<div class="tg-card-row tg-card-row-top">';
    h += '<button class="tg-check' + (s.done ? ' done' : '') + '" data-action="toggle-session-block" data-project-id="' + esc(s.projectId) + '" data-session-idx="' + s.sessionIdx + '"><i class="ti ' + (s.done ? 'ti-circle-check-filled' : 'ti-circle') + '"></i></button>';
    h += '<div class="tg-card-main"><div class="tg-card-title' + (s.done ? ' strike' : '') + '">' + esc(s.projectTitle) + '</div>';
    h += '<div class="tg-card-sub">' + timeStr + ' · ' + esc(s.label) + '</div></div>';
    h += '<span class="tg-session-tag"><i class="ti ti-target"></i></span>';
    h += '</div></div>';
    return h;
  }

  /* ── Time Grid ── */
  function renderTimeGrid(tasks, now) {
    var startHour = 7;
    var endHour = 19;
    var hourH = 56;
    var totalH = (endHour - startHour) * hourH;
    var html = '<div class="tg" style="height:' + totalH + 'px">';

    for (var h = startHour; h <= endHour; h++) {
      var top = (h - startHour) * hourH;
      html += '<div class="tg-line" style="top:' + top + 'px"></div>';
      html += '<div class="tg-label" style="top:' + (top - 7) + 'px">' + LC.fmtTime(h * 60) + '</div>';
    }

    /* ── Routine bands (behind tasks) ── */
    var routines = (window.LC_Routines ? window.LC_Routines.loadRoutines() : []);
    var todayDow = new Date().getDay();
    html += '<div class="tg-routines">';
    routines.forEach(function (r) {
      if (r.days.indexOf(todayDow) === -1) return;
      var rs = Math.max(r.startMin, startHour * 60);
      var re = Math.min(r.endMin, endHour * 60);
      if (re <= rs) return;
      var rtop = ((rs / 60) - startHour) * hourH;
      var rh = ((re - rs) / 60) * hourH;
      html += '<div class="tg-routine ' + (r.protected ? 'protected' : 'open') + '" style="top:' + rtop + 'px;height:' + rh + 'px">';
      if (r.protected) {
        html += '<span class="tg-routine-tag"><i class="ti ti-lock"></i> ' + esc(r.name) + ' · locked</span>';
      } else {
        html += '<span class="tg-routine-tag"><i class="ti ' + r.icon + '"></i> ' + esc(r.name) + '</span>';
      }
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="tg-cards">';

    var placed = tasks.filter(function (t) { return t.startMin != null; });
    placed.forEach(function (t) { t._kind = 'task'; });
    var allItems = placed.concat(sessionsForDate(todayStr()));
    layoutColumns(allItems);

    allItems.forEach(function (t) {
      var top = ((t.startMin / 60) - startHour) * hourH;
      var dur = t.duration || 30;
      var height = Math.max((dur / 60) * hourH, 38);

      var n = t._cols || 1, c = t._col || 0, gap = 6;
      var colW = '(100% - 24px - ' + ((n - 1) * gap) + 'px) / ' + n;
      var leftExpr = '16px + ' + c + ' * ((' + colW + ') + ' + gap + 'px)';
      var pos = 'top:' + top + 'px;height:' + height + 'px;left:calc(' + leftExpr + ');width:calc(' + colW + ');right:auto;';

      if (t._kind === 'session') { html += renderSessionBlock(t, pos); return; }

      var color = t.type === 'event' ? 'var(--blue)' : 'var(--accent)';
      var doneClass = t.done ? ' tg-card-done' : '';
      var isTask = t.type !== 'event';
      var subs = t.subtasks || [];
      var subDone = subs.filter(function (s) { return s.done; }).length;
      var meta = LC.fmtTime(t.startMin) + ' · ' + (isTask ? 'Task' : 'Event') + ' · ' + LC.fmtDur(dur);

      html += '<div class="tg-card' + doneClass + '" style="' + pos + '" data-action="open-editor" data-task-id="' + t.id + '">';
      html += '<span class="tg-card-bar" style="background:' + color + '"></span>';

      if (isTask && t.done) {
        html += '<div class="tg-card-row"><button class="tg-check done" data-action="toggle-done-card" data-task-id="' + t.id + '"><i class="ti ti-circle-check-filled"></i></button><span class="tg-card-title strike">' + esc(t.title || 'Untitled') + '</span></div>';
      } else if (isTask) {
        html += '<div class="tg-card-row tg-card-row-top">';
        html += '<button class="tg-check" data-action="toggle-done-card" data-task-id="' + t.id + '"><i class="ti ti-circle"></i></button>';
        html += '<div class="tg-card-main"><div class="tg-card-title">' + esc(t.title || 'Untitled') + '</div><div class="tg-card-sub">' + meta + '</div></div>';
        if (subs.length) html += '<span class="tg-card-pill"><i class="ti ti-check"></i> ' + subDone + '/' + subs.length + '</span>';
        html += '</div>';
      } else {
        html += '<div class="tg-card-title">' + esc(t.title || 'Untitled') + '</div>';
        html += '<div class="tg-card-sub">' + meta + '</div>';
      }
      html += '</div>';
    });

    html += '</div>';

    var nowTop = ((now / 60) - startHour) * hourH;
    if (nowTop >= 0 && nowTop <= totalH) {
      html += '<div class="tg-now" style="top:' + nowTop + 'px">';
      html += '<span class="tg-now-dot"></span>';
      html += '<span class="tg-now-line"></span>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ── Simple Agenda ── */
  function renderAgenda(tasks, now) {
    var sorted = tasks.filter(function (t) { return t.startMin != null; }).sort(function (a, b) { return a.startMin - b.startMin; });
    var html = '<div class="agenda">';

    var nowInserted = false;

    sorted.forEach(function (t) {
      if (!nowInserted && t.startMin > now) {
        html += renderNowRow(now);
        nowInserted = true;
      }

      var color = t.type === 'event' ? 'var(--blue)' : 'var(--accent)';
      var timeClass = t.done ? 'agenda-time done' : (t.startMin <= now ? 'agenda-time accent' : 'agenda-time');

      html += '<div class="agenda-row' + (t.done ? ' done' : '') + '" data-action="open-editor" data-task-id="' + t.id + '">';
      html += '<div class="' + timeClass + ' serif">' + LC.fmtTime(t.startMin) + '</div>';

      var isTask = t.type !== 'event';
      var subs = t.subtasks || [];
      var subDone = subs.filter(function (s) { return s.done; }).length;

      if (isTask) {
        html += '<button class="agenda-check-btn' + (t.done ? ' done' : '') + '" data-action="toggle-done-card" data-task-id="' + t.id + '"><i class="ti ' + (t.done ? 'ti-circle-check-filled' : 'ti-circle') + '"></i></button>';
      } else {
        html += '<span class="agenda-bar" style="background:' + color + '"></span>';
      }

      html += '<div class="agenda-content">';
      html += '<div class="agenda-title' + (t.done ? ' strike' : '') + '">' + esc(t.title || 'Untitled') + '</div>';
      if (!t.done) {
        var sub = (isTask ? 'Task' : 'Event') + ' · ' + LC.fmtDur(t.duration || 30);
        if (isTask && subs.length) sub += ' · subtasks ' + subDone + '/' + subs.length;
        html += '<div class="agenda-sub">' + sub + '</div>';
      }
      html += '</div>';
      html += '</div>';
    });

    if (!nowInserted) {
      html += renderNowRow(now);
    }

    if (sorted.length === 0) {
      html += '<div class="agenda-empty">No tasks scheduled for today.</div>';
    }

    html += '</div>';
    return html;
  }

  function renderNowRow(now) {
    return '<div class="agenda-now"><div class="agenda-time accent" style="font-size:11px;letter-spacing:.04em">' + LC.fmtTime(now) + '</div><span class="tg-now-dot"></span><span class="tg-now-line-h"></span><span class="agenda-now-label">now</span></div>';
  }

  /* ── Sidebar cards ── */
  function renderSidebarCards() {
    var html = '<div class="today-cards">';

    html += '<div class="today-card today-card-verse">';
    html += '<div class="today-card-label accent"><i class="ti ti-sunrise"></i> Today\'s verse</div>';
    html += '<p class="today-card-quote serif">"Commit to the Lord whatever you do, and He will establish your plans."</p>';
    html += '<span class="today-card-ref">Proverbs 16:3</span>';
    html += '</div>';

    html += '<div class="today-card today-card-note">';
    html += '<div class="today-card-label"><i class="ti ti-pencil"></i> Today\'s note</div>';
    html += '<div class="today-card-note-body" data-action="open-note">Click to write today\'s note…</div>';
    html += '</div>';

    html += '<button class="today-card today-card-reflect" data-action="open-reflection">';
    html += '<span class="today-reflect-icon"><i class="ti ti-moon"></i></span>';
    html += '<span class="today-reflect-text">';
    html += '<span class="today-reflect-label">Evening Reflection</span>';
    html += '<span class="today-reflect-sub">How did it go? Wins, challenges, gratitude.</span>';
    html += '</span>';
    html += '<i class="ti ti-arrow-up-right today-reflect-arrow"></i>';
    html += '</button>';

    html += '</div>';
    return html;
  }

  /* ══════════════════════════════════════════
     Edit panel (task/event) — inline right aside
     ══════════════════════════════════════════ */
  var edSubAdding = false;
  var focusTitleNext = false;

  /* Called after each today render(): wires the subtask input / focuses the title. */
  function attachEditorInputs() {
    if (LC.get('editor') == null) { focusTitleNext = false; return; }
    // Persist title/location on blur so navigating away (which clears `editor`) doesn't drop typed text.
    var tInp = document.querySelector('.ep-aside .ep-title-input');
    if (tInp) tInp.addEventListener('blur', persistEditorFields);
    var lInp = document.querySelector('.ep-aside .ep-loc-input');
    if (lInp) lInp.addEventListener('blur', persistEditorFields);
    var subInp = document.querySelector('.ep-aside .ls-sub-input');
    if (subInp) {
      subInp.focus();
      subInp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); commitEditSubtask(subInp.value); }
        if (ev.key === 'Escape') { edSubAdding = false; render(); }
      });
      subInp.addEventListener('blur', function () { commitEditSubtask(subInp.value); });
    } else if (focusTitleNext) {
      var titleInp = document.querySelector('.ep-aside .ep-title-input');
      if (titleInp) titleInp.focus();
    }
    focusTitleNext = false;
  }

  function renderEditor(t) {
    var isTask = t.type !== 'event';
    var dur = t.duration || (isTask ? 90 : 60);
    var start = t.startMin != null ? t.startMin : 540;
    var priority = t.priority || 'med';
    var subtasks = t.subtasks || [];
    var subDone = subtasks.filter(function (x) { return x.done; }).length;

    var h = '<header class="ls-head"><span class="ls-head-label">Edit ' + (isTask ? 'task' : 'event') + '</span><button class="ls-close" data-action="editor-close"><i class="ti ti-x"></i></button></header>';

    h += '<div class="ls-body">';

    /* complete + editable title */
    h += '<div class="ls-titlerow">';
    h += '<button class="ls-complete' + (t.done ? ' done' : '') + '" data-action="editor-complete"><i class="ti ' + (t.done ? 'ti-circle-check-filled' : 'ti-circle') + '"></i></button>';
    h += '<input class="ep-title-input serif' + (t.done ? ' done' : '') + '" value="' + escAttr(t.title || '') + '" placeholder="Untitled">';
    h += '</div>';

    /* type toggle */
    h += '<div class="ep-typetoggle">';
    h += '<button class="ep-typetab' + (isTask ? ' active' : '') + '" data-action="editor-type" data-type="task"><i class="ti ti-circle"></i> Task</button>';
    h += '<button class="ep-typetab' + (!isTask ? ' active' : '') + '" data-action="editor-type" data-type="event"><i class="ti ti-calendar"></i> Event</button>';
    h += '</div>';

    /* when: start + duration */
    h += '<div class="ls-section-label">When</div>';
    h += '<div class="ep-whenrow">';
    h += '<div class="ep-stepper"><button class="ep-step" data-action="editor-start-minus">−</button><span class="ep-stepval">' + LC.fmtTime(start) + '</span><button class="ep-step" data-action="editor-start-plus">+</button></div>';
    h += '<div class="ep-stepper"><button class="ep-step" data-action="editor-dur-minus">−</button><span class="ep-stepval">' + LC.fmtDur(dur) + '</span><button class="ep-step" data-action="editor-dur-plus">+</button></div>';
    h += '</div>';
    h += '<div class="ls-when-hint">Ends ' + LC.fmtTime(start + dur) + ' · 15-minute steps</div>';

    /* priority */
    h += '<div class="ls-section-label">Priority</div>';
    h += '<div class="ep-priority">';
    [['low', 'Low'], ['med', 'Med'], ['high', 'High']].forEach(function (p) {
      h += '<button class="ep-prio' + (priority === p[0] ? ' active ' + p[0] : '') + '" data-action="editor-priority" data-priority="' + p[0] + '">' + p[1] + '</button>';
    });
    h += '</div>';

    if (isTask) {
      h += '<div class="ls-section-label">Subtasks · ' + subDone + '/' + subtasks.length + '</div>';
      h += '<div class="ls-subs">';
      subtasks.forEach(function (st, si) {
        h += '<div class="ls-sub"><button class="ls-sub-check" data-action="editor-subtask-toggle" data-sub="' + si + '"><i class="ti ' + (st.done ? 'ti-square-rounded-check-filled' : 'ti-square-rounded') + '"></i></button><span class="ls-sub-label' + (st.done ? ' done' : '') + '">' + esc(st.label) + '</span></div>';
      });
      h += '</div>';
      if (edSubAdding) {
        h += '<div class="ls-sub-add-row"><i class="ti ti-square-rounded"></i><input class="ls-sub-input" type="text" placeholder="New subtask"></div>';
      } else {
        h += '<button class="ls-add-sub" data-action="editor-subtask-add"><i class="ti ti-plus"></i> Add subtask</button>';
      }
    } else {
      h += '<div class="ls-section-label">Location</div>';
      h += '<div class="ep-location"><i class="ti ti-map-pin"></i><input class="ep-loc-input" value="' + escAttr(t.location || '') + '" placeholder="Add location"></div>';
      h += '<div class="ep-allday"><i class="ti ti-sun"></i><span class="ep-allday-label">All-day event</span><button class="ep-switch' + (t.allDay ? ' on' : '') + '" data-action="editor-allday"><span class="ep-switch-knob"></span></button></div>';
    }

    h += '</div>';

    h += '<footer class="ls-foot">';
    h += '<button class="ep-delete" data-action="editor-delete"><i class="ti ti-trash"></i></button>';
    h += '<button class="ls-save" data-action="editor-close">Save changes</button>';
    h += '</footer>';

    return h;
  }

  function editorFields() {
    var ti = document.querySelector('.ep-title-input');
    var lo = document.querySelector('.ep-loc-input');
    return { title: ti ? ti.value : null, location: lo ? lo.value : null };
  }

  function persistEditorFields() {
    var f = editorFields();
    var id = LC.get('editor');
    if (!id) return;
    var tasks = loadTasks();
    var t = tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    if (f.title != null) t.title = f.title;
    if (f.location != null) t.location = f.location;
    saveTasks(tasks);
  }

  function updateEditor(fn) {
    var f = editorFields();
    var id = LC.get('editor');
    var tasks = loadTasks();
    var t = tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    if (f.title != null) t.title = f.title;
    if (f.location != null) t.location = f.location;
    fn(t);
    saveTasks(tasks);
    render();
  }

  function commitEditSubtask(val) {
    if (!edSubAdding) return;
    var text = (val || '').trim();
    edSubAdding = false;
    if (text) {
      updateEditor(function (t) { t.subtasks = t.subtasks || []; t.subtasks.push({ label: text, done: false }); });
    } else {
      render();
    }
  }

  function createTaskAt(min) { return createTask(min, '', 'task'); }

  /* Shared task creation: places at a snapped, clamped time and opens the editor. */
  function createTask(min, title, type) {
    min = Math.round(min / 15) * 15;
    min = Math.max(7 * 60, Math.min(19 * 60 - 60, min));
    var newErr = placementBlock('__new__', min, 60); if (newErr) { showToast(newErr); return null; }
    var task = { id: 't' + Date.now(), title: title || '', startMin: min, duration: 60, type: type === 'event' ? 'event' : 'task', done: false, date: todayStr(), priority: 'med' };
    var tasks = loadTasks();
    tasks.push(task);
    saveTasks(tasks);
    edSubAdding = false;
    focusTitleNext = true;
    LC.set({ screen: 'today', editor: task.id });
    return task.id;
  }

  /* ② Brain dump → schedule: create a real task from a captured item, open its editor. */
  function scheduleFromDump(title, type) { return createTask(nowMinutes(), title, type); }

  /* ── Drag-to-reschedule on the time grid ── */
  var dragState = null;
  var dragJustEnded = false;

  document.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (LC.get('screen') !== 'today' || LC.get('editor') != null) return;
    if (e.target.closest('.tg-check, .tg-card-pill')) return;   // let the check/pill get a clean click
    var card = e.target.closest('.tg-card');
    if (!card) return;
    var t = loadTasks().find(function (x) { return x.id === card.dataset.taskId; });
    if (!t || t.startMin == null) return;
    dragState = { id: card.dataset.taskId, startY: e.clientY, origMin: t.startMin, dur: (t.duration || 30), el: card, moved: false, newMin: t.startMin };
  });

  document.addEventListener('mousemove', function (e) {
    if (!dragState) return;
    var dy = e.clientY - dragState.startY;
    if (!dragState.moved && Math.abs(dy) < 4) return;
    dragState.moved = true;
    document.body.classList.add('tg-dragging');
    var snapped = Math.round((dragState.origMin + (dy / 56) * 60) / 15) * 15;
    snapped = Math.max(7 * 60, Math.min(19 * 60 - dragState.dur, snapped));
    dragState.newMin = snapped;
    dragState.el.style.top = (((snapped / 60) - 7) * 56) + 'px';
    dragState.el.classList.add('tg-card-drag');
    dragState.el.classList.toggle('tg-card-invalid', !!placementBlock(dragState.id, snapped, dragState.dur));
  });

  document.addEventListener('mouseup', function () {
    if (!dragState) return;
    var d = dragState; dragState = null;
    document.body.classList.remove('tg-dragging');
    if (!d.moved) return;
    dragJustEnded = true;
    setTimeout(function () { dragJustEnded = false; }, 60);
    if (d.newMin === d.origMin) { render(); return; }
    var dropErr = placementBlock(d.id, d.newMin, d.dur); if (dropErr) { showToast(dropErr); render(); return; }
    var tasks = loadTasks();
    var t = tasks.find(function (x) { return x.id === d.id; });
    if (t) { t.startMin = d.newMin; saveTasks(tasks); }
    render();
  });

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    if (dragJustEnded) { dragJustEnded = false; return; }
    var action = e.target.closest('[data-action]');
    if (!action) {
      var grid = e.target.closest('.tg');
      if (grid && LC.get('screen') === 'today' && LC.get('editor') == null && !e.target.closest('.tg-card')) {
        var rect = grid.getBoundingClientRect();
        createTaskAt(7 * 60 + ((e.clientY - rect.top) / 56) * 60);
      }
      return;
    }
    var a = action.dataset.action;

    if (a === 'edit-intention') { intnEdit(); return; }

    if (a === 'open-note') { if (window.LC_Notes) LC_Notes.openDaily('todaysNotes'); return; }
    if (a === 'open-reflection') { if (window.LC_Notes) LC_Notes.openDaily('evening'); return; }

    if (a === 'add-task') { createTaskAt(nowMinutes()); return; }

    if (a === 'toggle-done-card') {
      var tid = action.dataset.taskId;
      var tasks = loadTasks();
      var tt = tasks.find(function (x) { return x.id === tid; });
      if (tt) { tt.done = !tt.done; saveTasks(tasks); render(); }
      return;
    }

    if (a === 'toggle-session-block') {
      var spid = action.dataset.projectId, ssi = parseInt(action.dataset.sessionIdx, 10);
      var sprojects = loadProjects();
      var sp = sprojects.find(function (x) { return x.id === spid; });
      if (sp && sp.sessions && sp.sessions[ssi]) {
        sp.sessions[ssi].done = !sp.sessions[ssi].done;
        sp.done = sp.sessions.filter(function (s) { return s.done; }).length;
        saveProjects(sprojects);
        render();
      }
      return;
    }

    if (a === 'open-session-block') {
      LC.set({ projOpen: action.dataset.projectId, sessionOpen: parseInt(action.dataset.sessionIdx, 10) });
      return;
    }

    if (a === 'open-editor') {
      var card = action.closest('[data-task-id]');
      if (card) { edSubAdding = false; LC.set({ editor: card.dataset.taskId }); }
      return;
    }

    if (a === 'editor-close') {
      persistEditorFields();
      edSubAdding = false;
      LC.set({ editor: null });
      return;
    }

    if (a === 'editor-delete') {
      var id = LC.get('editor');
      saveTasks(loadTasks().filter(function (t) { return t.id !== id; }));
      edSubAdding = false;
      LC.set({ editor: null });
      return;
    }

    if (a === 'editor-complete') { updateEditor(function (t) { t.done = !t.done; }); return; }
    if (a === 'editor-type') { updateEditor(function (t) { t.type = action.dataset.type; }); return; }

    if (a === 'editor-start-minus' || a === 'editor-start-plus') {
      var sd = a === 'editor-start-plus' ? 15 : -15;
      var stid = LC.get('editor');
      var st0 = loadTasks().find(function (x) { return x.id === stid; });
      if (!st0) return;
      var stDur = st0.duration || 90;
      var proposedStart = Math.max(7 * 60, Math.min(19 * 60 - stDur, (st0.startMin != null ? st0.startMin : 540) + sd));
      var stErr = placementBlock(stid, proposedStart, stDur); if (stErr) { showToast(stErr); return; }
      updateEditor(function (t) { t.startMin = proposedStart; });
      return;
    }

    if (a === 'editor-dur-minus' || a === 'editor-dur-plus') {
      var dd = a === 'editor-dur-plus' ? 15 : -15;
      var dtid = LC.get('editor');
      var dt0 = loadTasks().find(function (x) { return x.id === dtid; });
      if (!dt0) return;
      var dtStart = dt0.startMin != null ? dt0.startMin : 540;
      var proposedDur = Math.max(15, Math.min(19 * 60 - dtStart, (dt0.duration || 90) + dd));
      var dtErr = placementBlock(dtid, dtStart, proposedDur); if (dtErr) { showToast(dtErr); return; }
      updateEditor(function (t) { t.duration = proposedDur; });
      return;
    }

    if (a === 'editor-priority') { updateEditor(function (t) { t.priority = action.dataset.priority; }); return; }
    if (a === 'editor-allday') { updateEditor(function (t) { t.allDay = !t.allDay; }); return; }

    if (a === 'editor-subtask-toggle') {
      var si = parseInt(action.dataset.sub, 10);
      updateEditor(function (t) { t.subtasks = t.subtasks || []; if (t.subtasks[si]) t.subtasks[si].done = !t.subtasks[si].done; });
      return;
    }

    if (a === 'editor-subtask-add') {
      persistEditorFields();
      edSubAdding = true;
      render();
      return;
    }
  });

  /* ── Subscribe ── */
  LC.on(function () {
    render();
    if (LC.get('screen') === 'today') {
      var intention = loadIntention();
      if (!intention.text || intention.date !== todayStr()) {
        if (!intnTimer) intnTick();
      }
    }
  });

  window.LC_Today = { render: render, scheduleFromDump: scheduleFromDump };
})();

/* ══════════════════════════════════════════
   Luclaro — Today / Day View
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  var KEY_TASKS = 'tasks';
  var KEY_NOTES = 'notes';

  function loadTasks() { var v = LC.loadData(KEY_TASKS); return Array.isArray(v) ? v : []; }
  function saveTasks(arr) { LC.saveData(KEY_TASKS, arr); }
  function loadProjects() { return LC.loadData('projects') || []; }
  function saveProjects(arr) { LC.saveData('projects', arr); }

  /* Project sessions scheduled on a given date, as grid blocks. */
  function sessionsForDate(date) {
    var out = [];
    loadProjects().forEach(function (p) {
      if (p.sample) return;   // sample project sessions never appear on the calendar
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

  /* Intention IS the daily note's "morning" field — one source of truth shared with Notes.
     Parametrized by date so viewing another day shows that day's intention. */
  function loadIntention(date) {
    date = date || viewStr();
    var notes = LC.loadData(KEY_NOTES) || {};
    var n = notes['daily:' + date];
    var text = (n && n.morning) ? n.morning : '';
    return { text: text, date: text ? date : null };
  }
  function saveIntention(obj) {
    var notes = LC.loadData(KEY_NOTES) || {};
    var key = 'daily:' + viewStr();
    notes[key] = notes[key] || {};
    notes[key].morning = (obj && obj.text) ? obj.text : '';
    notes[key]._saved = Date.now();
    LC.saveData(KEY_NOTES, notes);
  }

  /* ── Daily verse ── rotates through a built-in set; the user can override any day's verse. */
  var VERSES = [
    { t: 'Commit to the Lord whatever you do, and He will establish your plans.', r: 'Proverbs 16:3' },
    { t: 'This is the day the Lord has made; let us rejoice and be glad in it.', r: 'Psalm 118:24' },
    { t: 'I can do all things through Christ who strengthens me.', r: 'Philippians 4:13' },
    { t: 'Trust in the Lord with all your heart, and lean not on your own understanding.', r: 'Proverbs 3:5' },
    { t: 'Be still, and know that I am God.', r: 'Psalm 46:10' },
    { t: 'The Lord is my shepherd; I shall not want.', r: 'Psalm 23:1' },
    { t: 'Cast all your anxiety on Him, because He cares for you.', r: '1 Peter 5:7' },
    { t: 'In all your ways acknowledge Him, and He will make your paths straight.', r: 'Proverbs 3:6' },
    { t: 'Your word is a lamp to my feet and a light to my path.', r: 'Psalm 119:105' },
    { t: 'Come to me, all who are weary and burdened, and I will give you rest.', r: 'Matthew 11:28' },
    { t: 'Let all that you do be done in love.', r: '1 Corinthians 16:14' },
    { t: 'The Lord is my light and my salvation — whom shall I fear?', r: 'Psalm 27:1' },
    { t: 'Do not be anxious about anything, but in every situation, by prayer, present your requests to God.', r: 'Philippians 4:6' },
    { t: 'Whatever you do, work at it with all your heart, as working for the Lord.', r: 'Colossians 3:23' },
    { t: 'Wait for the Lord; be strong and take heart and wait for the Lord.', r: 'Psalm 27:14' },
    { t: 'For I know the plans I have for you, plans to prosper you and not to harm you.', r: 'Jeremiah 29:11' },
    { t: 'The steadfast love of the Lord never ceases; His mercies never come to an end.', r: 'Lamentations 3:22' },
    { t: 'Seek first the kingdom of God and His righteousness.', r: 'Matthew 6:33' },
    { t: 'Be strong and courageous. Do not be afraid; the Lord your God goes with you.', r: 'Deuteronomy 31:6' },
    { t: 'Create in me a clean heart, O God, and renew a right spirit within me.', r: 'Psalm 51:10' },
    { t: 'My grace is sufficient for you, for my power is made perfect in weakness.', r: '2 Corinthians 12:9' },
    { t: 'Give thanks to the Lord, for He is good; His love endures forever.', r: 'Psalm 107:1' },
    { t: 'Let the morning bring me word of your unfailing love, for I have put my trust in you.', r: 'Psalm 143:8' },
    { t: 'Those who hope in the Lord will renew their strength; they will soar on wings like eagles.', r: 'Isaiah 40:31' },
    { t: 'Peace I leave with you; my peace I give you. Do not let your hearts be troubled.', r: 'John 14:27' },
    { t: 'Teach us to number our days, that we may gain a heart of wisdom.', r: 'Psalm 90:12' },
    { t: 'And we know that in all things God works for the good of those who love Him.', r: 'Romans 8:28' },
    { t: 'The joy of the Lord is your strength.', r: 'Nehemiah 8:10' },
    { t: 'Draw near to God, and He will draw near to you.', r: 'James 4:8' },
    { t: 'Let your light shine before others, that they may see your good deeds.', r: 'Matthew 5:16' }
  ];
  function verseFor(date) {
    var overrides = LC.loadData('verses') || {};
    if (overrides[date] && overrides[date].t) return { t: overrides[date].t, r: overrides[date].r || '', custom: true };
    var p = date.split('-');
    var dayOfYear = Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - new Date(+p[0], 0, 0)) / 86400000);
    return VERSES[dayOfYear % VERSES.length];
  }
  function saveVerseOverride(date, text, ref) {
    var overrides = LC.loadData('verses') || {};
    if (text && text.trim()) overrides[date] = { t: text.trim(), r: (ref || '').trim() };
    else delete overrides[date];   // cleared → back to the daily rotation
    LC.saveData('verses', overrides);
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* The date the Day view is showing: dayAnchor (set by arrows / month drill-in) or today. */
  function viewStr() { return LC.get('dayAnchor') || todayStr(); }
  function isViewingToday() { return viewStr() === todayStr(); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function shiftDateISO(iso, days) {
    var d = parseISO(iso); d.setDate(d.getDate() + days);
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

  /* Would placing [start, start+dur) on `date` (excluding taskId) keep peak concurrency ≤ MAX_OVERLAP? */
  function canPlace(taskId, start, dur, date) {
    date = date || viewStr();
    var end = start + dur;
    var others = loadTasks().filter(function (t) {
      return t.id !== taskId && t.date === date && t.startMin != null;
    }).map(function (t) { return { s: t.startMin, e: t.startMin + (t.duration || 30) }; });
    sessionsForDate(date).forEach(function (ss) { others.push({ s: ss.startMin, e: ss.startMin + ss.duration }); });
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

  /* Locked routine active on `date` that [start,start+dur) would overlap, if any. */
  function protectedConflict(start, dur, date) {
    var end = start + dur;
    var dow = parseISO(date || viewStr()).getDay();
    var routines = (window.LC_Routines ? window.LC_Routines.loadRoutines() : []);
    var hit = routines.filter(function (r) {
      return r.protected && r.days && r.days.indexOf(dow) >= 0 && start < r.endMin && end > r.startMin;
    })[0];
    return hit ? hit.name : null;
  }

  /* Combined placement gate → message string if blocked, else null. */
  function placementBlock(taskId, start, dur, date) {
    var pc = protectedConflict(start, dur, date);
    if (pc) return '“' + pc + '” is locked — nothing can be scheduled then';
    if (!canPlace(taskId, start, dur, date)) return 'Only ' + MAX_OVERLAP + ' items can overlap in one slot';
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
    // idle while an intention exists, while editing, or when viewing a day other than today
    if ((intention.text && intention.date === viewStr()) || intnEditing || !isViewingToday()) {
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
    if (intention.text && intention.date === viewStr()) return;
    if (intnEditing || !isViewingToday()) return;

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
    var current = (intention.text && intention.date === viewStr()) ? intention.text : '';

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
    saveIntention(text ? { text: text, date: viewStr() } : { text: '', date: null });
    render();
    if (!text && isViewingToday()) intnTick();
  }

  function intnCancel() {
    intnEditing = false;
    var intention = loadIntention();
    render();
    if (isViewingToday() && (!intention.text || intention.date !== viewStr())) intnTick();
  }

  /* ── Render ── */
  function render() {
    // Safety net: if navigation (rail, search, deep link) closed the editor around a
    // pending accidental task, discard it here too.
    if (pendingNewId && LC.get('editor') !== pendingNewId) discardIfUntouched(pendingNewId);

    if (LC.get('screen') !== 'today') return;

    // A re-render rebuilds the editor from storage — capture unblurred title/location text
    // first so heartbeat/sync-triggered renders can never wipe what's being typed.
    if (LC.get('editor') != null && document.querySelector('.ep-aside .ep-title-input')) {
      persistEditorFields();
    }

    var el = document.getElementById('screen-today');
    var tasks = loadTasks();
    var vDate = viewStr();
    var viewingToday = isViewingToday();
    var dayTasks = tasksForDate(tasks, vDate);
    var intention = loadIntention(vDate);
    var now = nowMinutes();
    var vd = parseISO(vDate);
    var dateLabel = (vd.getMonth() + 1) + '/' + vd.getDate() + '/' + vd.getFullYear();
    var timeLabel = viewingToday ? LC.fmtTime(now) : DAYS[vd.getDay()];
    var layout = LC.get('dayLayout');
    var hasIntention = intention.text && intention.date === vDate;

    var html = '<div class="today-wrap">';

    /* ── Intention card ── */
    html += '<div class="today-intention">';
    html += '<div class="today-intention-label"><i class="ti ti-flag-3"></i> ' + (viewingToday ? 'Today\'s intention · what matters most today?' : 'Intention · what mattered most this day?') + '</div>';
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
    var viewDow = parseISO(viewStr()).getDay();
    html += '<div class="tg-routines">';
    routines.forEach(function (r) {
      if (r.days.indexOf(viewDow) === -1) return;
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
    var allItems = placed.concat(sessionsForDate(viewStr()));
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
    if (isViewingToday() && nowTop >= 0 && nowTop <= totalH) {   // the now-line only makes sense on the real today
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

    var nowInserted = !isViewingToday();   // "now" row only belongs on the real today

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
      html += '<div class="agenda-empty">' + (isViewingToday() ? 'No tasks scheduled for today.' : 'Nothing scheduled on this day.') + '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderNowRow(now) {
    return '<div class="agenda-now"><div class="agenda-time accent" style="font-size:11px;letter-spacing:.04em">' + LC.fmtTime(now) + '</div><span class="tg-now-dot"></span><span class="tg-now-line-h"></span><span class="agenda-now-label">now</span></div>';
  }

  /* ── Sidebar cards ── */
  var verseEditing = false;
  var verseEditDate = null;   // day the edit was opened on — nav to another day closes it
  var verseDraft = null;      // typed-but-unsaved text, so re-renders (heartbeat/sync) can't wipe it

  function renderSidebarCards() {
    var vDate = viewStr();
    var verse = verseFor(vDate);

    // editing is per-day: navigating to a different day cancels the edit cleanly
    if (verseEditing && verseEditDate !== vDate) { verseEditing = false; verseDraft = null; }

    var html = '<div class="today-cards">';

    html += '<div class="today-card today-card-verse">';
    html += '<div class="today-card-label accent"><i class="ti ti-sunrise"></i> ' + (isViewingToday() ? 'Today\'s verse' : 'Verse of the day') + '<button class="verse-edit-btn" data-action="verse-edit" aria-label="Edit verse" title="Edit verse"><i class="ti ti-pencil"></i></button></div>';
    if (verseEditing) {
      var draftT = verseDraft ? verseDraft.t : verse.t;
      var draftR = verseDraft ? verseDraft.r : (verse.r || '');
      html += '<textarea class="verse-input" id="verse-input" placeholder="Write the verse…">' + esc(draftT) + '</textarea>';
      html += '<input class="verse-ref-input" id="verse-ref-input" placeholder="Reference (e.g. Psalm 23:1)" value="' + escAttr(draftR) + '">';
      html += '<div class="verse-edit-row">';
      html += '<button class="verse-save-btn" data-action="verse-save">Save</button>';
      if (verse.custom) html += '<button class="verse-reset-btn" data-action="verse-reset">Use daily verse</button>';
      html += '<button class="verse-cancel-btn" data-action="verse-cancel">Cancel</button>';
      html += '</div>';
    } else {
      html += '<p class="today-card-quote serif">"' + esc(verse.t) + '"</p>';
      html += '<span class="today-card-ref">' + esc(verse.r || '') + (verse.custom ? ' · yours' : '') + '</span>';
    }
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
    // verse edit draft: capture typing so any re-render restores it instead of wiping it
    var vi = document.getElementById('verse-input');
    var vr = document.getElementById('verse-ref-input');
    if (vi) {
      var saveDraft = function () { verseDraft = { t: vi.value, r: vr ? vr.value : '' }; };
      vi.addEventListener('input', saveDraft);
      if (vr) vr.addEventListener('input', saveDraft);
    }

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

    /* when: date + start + duration */
    h += '<div class="ls-section-label">When</div>';
    var td = parseISO(t.date || todayStr());
    var SDOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var SMO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var dLbl = (t.date === todayStr()) ? 'Today' : SDOW[td.getDay()] + ', ' + SMO[td.getMonth()] + ' ' + td.getDate();
    h += '<div class="ep-daterow">';
    h += '<button class="ep-step" data-action="editor-date-prev" aria-label="Previous day"><i class="ti ti-chevron-left"></i></button>';
    h += '<span class="ep-date-val">' + dLbl + '</span>';
    h += '<button class="ep-step" data-action="editor-date-next" aria-label="Next day"><i class="ti ti-chevron-right"></i></button>';
    h += '</div>';
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
    if (f.title != null) t.title = f.title.trim();       // whitespace-only → '' → renders "Untitled"
    if (f.location != null) t.location = f.location.trim();
    saveTasks(tasks);
  }

  function updateEditor(fn) {
    var f = editorFields();
    var id = LC.get('editor');
    var tasks = loadTasks();
    var t = tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    if (id === pendingNewId) pendingTouched = true;   // deliberate edit → keep the task on close
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

  var idSeq = 0;   // suffix so two creations in the same millisecond can't share an id

  /* Accidental-click guard: a task created from an empty-slot click starts "pending".
     If the editor closes (X, Esc, click-away, nav) before the user touches anything
     and it's still empty, it is discarded instead of saved. */
  var pendingNewId = null;
  var pendingTouched = false;

  function discardIfUntouched(id) {
    if (!id || id !== pendingNewId) return false;
    pendingNewId = null;
    if (pendingTouched) return false;
    var tasks = loadTasks();
    var t = tasks.find(function (x) { return x.id === id; });
    if (!t) return false;
    var empty = !(t.title && t.title.trim()) && !(t.subtasks && t.subtasks.length) && !t.done && !(t.location && t.location.trim());
    if (!empty) return false;
    saveTasks(tasks.filter(function (x) { return x.id !== id; }));
    return true;
  }

  /* Shared task creation: snapped, clamped, opens the editor. Defaults to the VIEWED day. */
  function createTask(min, title, type, date) {
    date = date || viewStr();
    min = Math.round(min / 15) * 15;
    min = Math.max(7 * 60, Math.min(19 * 60 - 60, min));
    var newErr = placementBlock('__new__', min, 60, date); if (newErr) { showToast(newErr); return null; }
    var task = { id: 't' + Date.now() + '_' + (++idSeq), title: title || '', startMin: min, duration: 60, type: type === 'event' ? 'event' : 'task', done: false, date: date, priority: 'med' };
    var tasks = loadTasks();
    tasks.push(task);
    saveTasks(tasks);
    edSubAdding = false;
    focusTitleNext = true;
    pendingNewId = task.id;      // discard on close unless the user actually edits it
    pendingTouched = false;
    LC.set({ screen: 'today', editor: task.id, dayAnchor: date === todayStr() ? null : date });   // land where the task lands
    return task.id;
  }

  /* ② Brain dump → schedule: always onto the REAL today, whatever day was last viewed. */
  function scheduleFromDump(title, type) { return createTask(nowMinutes(), title, type, todayStr()); }

  /* Smart capture: create a fully-specified task/event on ANY date without opening the editor.
     Returns the new id, or null (with toast) when the slot is hard-blocked. */
  function createTaskOn(dateISO, startMin, durationMin, title, type) {
    var dur = Math.max(15, durationMin || 60);
    var start = Math.max(7 * 60, Math.min(19 * 60 - dur, Math.round(startMin / 15) * 15));
    var err = placementBlock('__new__', start, dur, dateISO);
    if (err) { showToast(err); return null; }
    var task = { id: 't' + Date.now() + '_' + (++idSeq), title: (title || '').trim(), startMin: start, duration: dur, type: type === 'event' ? 'event' : 'task', done: false, date: dateISO, priority: 'med' };
    var tasks = loadTasks();
    tasks.push(task);
    saveTasks(tasks);
    return task.id;
  }

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
    dragState = { id: card.dataset.taskId, date: t.date, startY: e.clientY, origMin: t.startMin, dur: (t.duration || 30), el: card, moved: false, newMin: t.startMin };
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
    dragState.el.classList.toggle('tg-card-invalid', !!placementBlock(dragState.id, snapped, dragState.dur, dragState.date));
  });

  document.addEventListener('mouseup', function () {
    if (!dragState) return;
    var d = dragState; dragState = null;
    document.body.classList.remove('tg-dragging');
    if (!d.moved) return;
    dragJustEnded = true;
    setTimeout(function () { dragJustEnded = false; }, 60);
    if (d.newMin === d.origMin) { render(); return; }
    var dropErr = placementBlock(d.id, d.newMin, d.dur, d.date); if (dropErr) { showToast(dropErr); render(); return; }
    var tasks = loadTasks();
    var t = tasks.find(function (x) { return x.id === d.id; });
    if (t) { t.startMin = d.newMin; saveTasks(tasks); }
    render();
  });

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    if (dragJustEnded) { dragJustEnded = false; return; }

    // Click-away: with the editor open, a click outside the aside closes it (discarding an
    // untouched accidental task). That closing click never creates a new task itself.
    var edOpen = LC.get('editor');
    if (edOpen != null && LC.get('screen') === 'today' && !e.target.closest('.ep-aside')) {
      persistEditorFields();
      var wasDiscarded = discardIfUntouched(edOpen);
      if (!e.target.closest('[data-action], .tg-card')) {
        edSubAdding = false;
        LC.set({ editor: null });
        return;   // swallow — this click only closes the editor
      }
      // clicked something interactive (another card, a button): fall through and let it act.
      // If the pending task was just discarded, clear the editor so e.g. "Add task" starts fresh
      // instead of pointing at a task that no longer exists.
      if (wasDiscarded) { edSubAdding = false; LC.set({ editor: null }); }
    }

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

    /* Verse card */
    if (a === 'verse-edit') { verseEditing = true; verseEditDate = viewStr(); verseDraft = null; render(); return; }
    if (a === 'verse-cancel') { verseEditing = false; verseDraft = null; render(); return; }
    if (a === 'verse-save') {
      saveVerseOverride(viewStr(), (document.getElementById('verse-input') || {}).value || '', (document.getElementById('verse-ref-input') || {}).value || '');
      verseEditing = false; verseDraft = null; render(); return;
    }
    if (a === 'verse-reset') { saveVerseOverride(viewStr(), '', ''); verseEditing = false; verseDraft = null; render(); return; }

    if (a === 'open-note') { if (window.LC_Notes) LC_Notes.openDaily('todaysNotes'); return; }
    if (a === 'open-reflection') { if (window.LC_Notes) LC_Notes.openDaily('evening'); return; }

    if (a === 'add-task') {
      if (LC.get('editor') != null) return;   // double-click guard: don't stack a second Untitled task
      createTaskAt(isViewingToday() ? nowMinutes() : 9 * 60);   // other days: sensible 9 AM default
      return;
    }

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
        var sessBecameDone = sp.sessions[ssi].done;
        render();
        // completing a session on the grid offers the "session done / complete project" fork
        if (sessBecameDone && window.LC_BrainDump && LC_BrainDump.sessionPill) LC_BrainDump.sessionPill(sp.id);
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
      discardIfUntouched(LC.get('editor'));   // accidental empty-slot click → don't save
      edSubAdding = false;
      LC.set({ editor: null });
      return;
    }

    if (a === 'editor-delete') {
      var id = LC.get('editor');
      pendingNewId = null;
      saveTasks(loadTasks().filter(function (t) { return t.id !== id; }));
      edSubAdding = false;
      LC.set({ editor: null });
      return;
    }

    if (a === 'editor-complete') { updateEditor(function (t) { t.done = !t.done; }); return; }
    if (a === 'editor-type') { updateEditor(function (t) { t.type = action.dataset.type; }); return; }

    if (a === 'editor-date-prev' || a === 'editor-date-next') {
      var ddir = a === 'editor-date-next' ? 1 : -1;
      var dtid2 = LC.get('editor');
      var dt2 = loadTasks().find(function (x) { return x.id === dtid2; });
      if (!dt2) return;
      var newDate = shiftDateISO(dt2.date || todayStr(), ddir);
      var mvErr = placementBlock(dtid2, dt2.startMin != null ? dt2.startMin : 540, dt2.duration || 60, newDate);
      if (mvErr) { showToast(mvErr); return; }
      updateEditor(function (t) { t.date = newDate; });
      // follow the task so the user watches it land on its new day
      LC.set({ dayAnchor: newDate === todayStr() ? null : newDate });
      return;
    }

    if (a === 'editor-start-minus' || a === 'editor-start-plus') {
      var sd = a === 'editor-start-plus' ? 15 : -15;
      var stid = LC.get('editor');
      var st0 = loadTasks().find(function (x) { return x.id === stid; });
      if (!st0) return;
      var stDur = st0.duration || 90;
      var proposedStart = Math.max(7 * 60, Math.min(19 * 60 - stDur, (st0.startMin != null ? st0.startMin : 540) + sd));
      var stErr = placementBlock(stid, proposedStart, stDur, st0.date); if (stErr) { showToast(stErr); return; }
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
      var dtErr = placementBlock(dtid, dtStart, proposedDur, dt0.date); if (dtErr) { showToast(dtErr); return; }
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
    if (LC.get('screen') === 'today' && isViewingToday()) {
      var intention = loadIntention();
      if (!intention.text || intention.date !== todayStr()) {
        if (!intnTimer) intnTick();
      }
    }
  });

  /* Esc closes the task editor (saving typed fields first). Skips the subtask input,
     whose own Esc handler cancels the inline add without closing the editor. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (e.target.closest && e.target.closest('.ls-sub-input, .intn-input')) return;
    if (LC.get('screen') === 'today' && LC.get('editor') != null) {
      persistEditorFields();
      discardIfUntouched(LC.get('editor'));
      edSubAdding = false;
      LC.set({ editor: null });
    }
  });

  window.LC_Today = { render: render, scheduleFromDump: scheduleFromDump, createTaskOn: createTaskOn, showToast: showToast };
})();

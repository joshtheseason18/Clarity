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
  /* The visible day window — user-set in Settings → "Your day", read live. */
  function dayStartH() { var v = parseInt(LC.get('dayStart'), 10); return (v >= 4 && v <= 12) ? v : 6; }
  function dayEndH()   { var v = parseInt(LC.get('dayEnd'), 10);   return (v >= 16 && v <= 24) ? v : 22; }

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
    if (pc) return '“' + pc + '” is reserved — nothing can be scheduled then';
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
    if (LC.get('screen') !== 'today' || LC.get('editor') != null) { colArmed = null; }
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

    /* ── Main area: Brain Dump column (left) + grid + verse footer ── */
    html += '<div class="today-body">';

    var edId = LC.get('editor');
    var edTask = edId != null ? tasks.find(function (t) { return t.id === edId; }) : null;
    var bdOpen = LC.get('bdOpen') !== false;
    html += '<aside class="today-sidebar' + (!edTask && !bdOpen ? ' bd-collapsed' : '') + '">';
    if (edTask) {
      html += '<div class="ep-aside">' + renderEditor(edTask) + '</div>';
    } else {
      html += renderBrainDumpColumn(tasks, viewingToday);
    }
    html += '</aside>';

    html += '<div class="today-grid-area">';
    if (layout === 'grid') {
      html += renderTimeGrid(dayTasks, now);
    } else {
      html += renderAgenda(dayTasks, now);
    }
    html += '<button class="today-addtask" data-action="add-task"><i class="ti ti-plus"></i> Add task</button>';
    html += renderVerseFooter();
    html += '</div>';

    html += '</div>';
    html += '</div>';

    el.innerHTML = html;
    attachEditorInputs();

    /* Brain Dump column wiring: capture on Enter (no re-render mid-typing), grid hover hint. */
    var capIn = document.getElementById('bd-col-input');
    if (capIn) {
      capIn.addEventListener('input', function () { bdColDraft = capIn.value; });   // survive the 60s heartbeat re-render
      capIn.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter') return;
        var v = capIn.value.trim();
        if (!v || !window.LC_BrainDump || !LC_BrainDump.capture) return;
        bdColDraft = '';
        LC_BrainDump.capture(v);
        render();
        var again = document.getElementById('bd-col-input');
        if (again) again.focus();
      });
    }
    var tgHover = el.querySelector('.tg');
    if (tgHover) {
      tgHover.addEventListener('mousemove', function (ev) { colHintUpdate(ev, tgHover); });
      tgHover.addEventListener('mouseleave', hideColHint);
    }
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
    var startHour = dayStartH();
    var endHour = dayEndH();
    var hourH = 56;
    var totalH = (endHour - startHour) * hourH;
    var html = '<div class="tg" style="height:' + totalH + 'px">';

    for (var h = startHour; h <= endHour; h++) {
      var top = (h - startHour) * hourH;
      html += '<div class="tg-line" style="top:' + top + 'px"></div>';
      var lt = Math.max(3, Math.min(top - 7, totalH - 16));   // keep 1st/last labels inside the frame
      html += '<div class="tg-label" style="top:' + lt + 'px">' + LC.fmtTime(h * 60) + '</div>';
    }

    /* ── Routine bands (behind tasks) ── */
    var routines = (window.LC_Routines ? window.LC_Routines.loadRoutines() : []);
    var viewDow = parseISO(viewStr()).getDay();
    html += '<div class="tg-routines">';
    var zoneChips = '';
    routines.forEach(function (r) {
      if (r.days.indexOf(viewDow) === -1) return;
      var rs = Math.max(r.startMin, startHour * 60);
      var re = Math.min(r.endMin, endHour * 60);
      if (re <= rs) return;
      var rtop = ((rs / 60) - startHour) * hourH;
      var rh = ((re - rs) / 60) * hourH;
      if (r.protected) {
        /* breathe: inset reserved bands from the frame edges */
        var bt = Math.max(rtop + 2, 4), bb = Math.min(rtop + rh - 2, totalH - 4), bh = Math.max(bb - bt, 18);
        html += '<div class="tg-routine protected" data-rname="' + escAttr(r.name) + '" style="top:' + bt + 'px;height:' + bh + 'px">';
        html += '<span class="tg-routine-tag"><i class="ti ti-lock"></i> ' + esc(r.name) + ' · reserved</span>';
        html += '</div>';
      } else {
        /* open routines are a quiet zone; the label is a pinned chip that floats above cards */
        html += '<div class="tg-routine open" style="top:' + rtop + 'px;height:' + rh + 'px"></div>';
        zoneChips += '<span class="tg-zone-chip" style="top:' + (rtop + 5) + 'px"><i class="ti ' + r.icon + '"></i> ' + esc(r.name) + ' · ' + LC.fmtTime(r.startMin) + '–' + LC.fmtTime(r.endMin) + '</span>';
      }
    });
    html += '</div>';

    html += '<div class="tg-cards">';

    var placed = tasks.filter(function (t) { return t.startMin != null; });
    var allItems = placed;   // project sessions no longer render here (Projects retired in v0)
    layoutColumns(allItems);

    allItems.forEach(function (t) {
      var top = ((t.startMin / 60) - startHour) * hourH;
      var dur = t.duration || 30;
      var height = Math.max((dur / 60) * hourH, 38);
      var compactCard = height < 46;   // short cards go one-line so the time never clips
      var liveNow = isViewingToday() && !t.done && t.startMin != null && t.startMin <= now && now < t.startMin + dur;

      var n = t._cols || 1, c = t._col || 0, gap = 6;
      var colW = '(100% - 24px - ' + ((n - 1) * gap) + 'px) / ' + n;
      var leftExpr = '16px + ' + c + ' * ((' + colW + ') + ' + gap + 'px)';
      var pos = 'top:' + top + 'px;height:' + height + 'px;left:calc(' + leftExpr + ');width:calc(' + colW + ');right:auto;';

      var color = t.type === 'event' ? 'var(--blue)' : 'var(--accent)';
      var doneClass = t.done ? ' tg-card-done' : '';
      var isTask = t.type !== 'event';
      var subs = t.subtasks || [];
      var subDone = subs.filter(function (s) { return s.done; }).length;
      var meta = LC.fmtTime(t.startMin) + ' · ' + (isTask ? 'Task' : 'Event') + ' · ' + LC.fmtDur(dur);

      html += '<div class="tg-card' + doneClass + (compactCard ? ' tg-card-compact' : '') + (liveNow ? ' tg-card-live' : '') + '" style="' + pos + '" data-action="open-editor" data-task-id="' + t.id + '" data-smin="' + t.startMin + '" data-dur="' + dur + '">';
      html += '<span class="tg-card-bar" style="background:' + color + '"></span>';

      if (isTask && t.done) {
        html += '<div class="tg-card-row"><button class="tg-check done" data-action="toggle-done-card" data-task-id="' + t.id + '"><i class="ti ti-circle-check-filled"></i></button><span class="tg-card-title strike">' + esc(t.title || 'Untitled') + '</span></div>';
      } else if (isTask && compactCard) {
        html += '<div class="tg-card-row"><button class="tg-check" data-action="toggle-done-card" data-task-id="' + t.id + '"><i class="ti ti-circle"></i></button><span class="tg-card-title">' + esc(t.title || 'Untitled') + '</span><span class="tg-card-sub-inline">' + meta + '</span>' + (liveNow ? '<button class="tg-focus-btn" data-action="task-focus" data-task-id="' + t.id + '" title="Focus on this"><i class="ti ti-target"></i></button>' : '') + '</div>';
      } else if (isTask) {
        html += (liveNow ? '<button class="tg-focus-btn tg-focus-btn-abs" data-action="task-focus" data-task-id="' + t.id + '" title="Focus on this"><i class="ti ti-target"></i></button>' : '');
        html += '<div class="tg-card-row tg-card-row-top">';
        html += '<button class="tg-check" data-action="toggle-done-card" data-task-id="' + t.id + '"><i class="ti ti-circle"></i></button>';
        html += '<div class="tg-card-main"><div class="tg-card-title">' + esc(t.title || 'Untitled') + '</div><div class="tg-card-sub">' + meta + '</div></div>';
        if (subs.length) html += '<span class="tg-card-pill"><i class="ti ti-check"></i> ' + subDone + '/' + subs.length + '</span>';
        html += '</div>';
      } else if (compactCard) {
        html += '<div class="tg-card-row"><span class="tg-card-title">' + esc(t.title || 'Untitled') + '</span><span class="tg-card-sub-inline">' + meta + '</span></div>';
      } else {
        html += '<div class="tg-card-title">' + esc(t.title || 'Untitled') + '</div>';
        html += '<div class="tg-card-sub">' + meta + '</div>';
      }
      html += '</div>';
    });

    html += '</div>';

    html += zoneChips;
    html += '<div class="tg-hint" id="tg-hint"></div>';

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

  /* ══ Brain Dump column — capture, Unplanned, Carried over, evening nudge ══
     Replaces the retired Brain dump screen; the note-preview and reflection cards
     from the old sidebar are folded into the evening nudge at the column's foot. */
  function renderBrainDumpColumn(tasks, viewingToday) {
    var bdOpen = LC.get('bdOpen') !== false;
    var unplanned = (window.LC_BrainDump && LC_BrainDump.unplanned) ? LC_BrainDump.unplanned() : [];
    var carried = tasks.filter(function (t) { return !t.done && t.date && t.date < todayStr(); })
                       .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var count = unplanned.length + carried.length;

    if (!bdOpen) {
      return '<button class="bdc-strip" data-action="bd-toggle" title="Open brain dump"><i class="ti ti-brain"></i><b>Brain dump · ' + count + '</b></button>';
    }

    var html = '<div class="bdc">';
    html += '<div class="bdc-head"><i class="ti ti-brain"></i> Brain dump <span class="bdc-count">· ' + count + '</span><button class="bdc-collapse" data-action="bd-toggle" title="Collapse"><i class="ti ti-chevron-left"></i></button></div>';
    html += '<div class="bdc-cap"><i class="ti ti-plus"></i><input type="text" id="bd-col-input" placeholder="Add a task or thought…" autocomplete="off" value="' + escAttr(bdColDraft) + '"></div>';
    html += '<div class="bdc-caphint">Try "call mom 4pm" — a time schedules it instantly. No time? It waits below.</div>';

    if (colArmed) html += '<div class="bdc-armbar"><i class="ti ti-hand-click"></i> Tap an open slot to place <button data-action="bd-cancel-arm">cancel</button></div>';

    html += '<div class="bdc-group"><i class="ti ti-stack-2"></i> Unplanned <span class="bdc-count">· ' + unplanned.length + '</span></div>';
    if (unplanned.length) {
      unplanned.forEach(function (it) {
        var armed = colArmed && colArmed.kind === 'dump' && colArmed.id === it.id;
        var dur = it.pDur != null ? Math.max(15, it.pDur) : 30;
        html += '<div class="bdc-row' + (armed ? ' armed' : '') + '" data-action="bd-arm" data-kind="dump" data-id="' + escAttr(it.id) + '" data-dur="' + dur + '">';
        html += '<i class="ti ti-grip-vertical bdc-grip"></i><div class="bdc-rowmain">';
        html += '<div class="bdc-title">' + esc(it.title) + '</div>';
        html += '<div class="bdc-meta">' + relTime(it.created) + '</div>';
        html += '<span class="bdc-chip"><i class="ti ti-hourglass"></i> ' + LC.fmtDur(dur) + '</span>';
        if (it.pBlocked) html += '<span class="bdc-chip warn"><i class="ti ti-alert-triangle"></i> pick another time</span>';
        else html += '<span class="bdc-chip mut">' + (armed ? 'tap a slot…' : 'tap or drag') + '</span>';
        html += '</div></div>';
      });
    } else {
      html += '<div class="bdc-empty">All clear. Anything on your mind?</div>';
    }

    html += '<div class="bdc-group"><i class="ti ti-history"></i> Carried over <span class="bdc-count">· ' + carried.length + '</span></div>';
    if (carried.length) {
      carried.forEach(function (t) {
        var armed = colArmed && colArmed.kind === 'carry' && colArmed.id === t.id;
        var p = t.date.split('-');
        var from = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1] - 1] + ' ' + (+p[2]);
        html += '<div class="bdc-row' + (armed ? ' armed' : '') + '" data-action="bd-arm" data-kind="carry" data-id="' + escAttr(t.id) + '" data-dur="' + (t.duration || 30) + '">';
        html += '<i class="ti ti-grip-vertical bdc-grip"></i><div class="bdc-rowmain">';
        html += '<div class="bdc-title">' + esc(t.title || 'Untitled') + '</div>';
        html += '<div class="bdc-meta">from ' + from + (t.startMin != null ? ' · ' + LC.fmtTime(t.startMin) : '') + '</div>';
        html += '<span class="bdc-chip"><i class="ti ti-hourglass"></i> ' + LC.fmtDur(t.duration || 30) + '</span>';
        html += '<span class="bdc-chip mut">' + (armed ? 'tap a slot…' : 'tap or drag') + '</span>';
        html += '</div></div>';
      });
    } else {
      html += '<div class="bdc-empty">Nothing carried over.</div>';
    }

    if (viewingToday && new Date().getHours() >= 17) {
      html += '<button class="bdc-eve" data-action="open-reflection"><i class="ti ti-moon-stars"></i> Evening — how did it go?</button>';
    }

    html += '</div>';
    return html;
  }

  function relTime(ts) {
    if (!ts) return '';
    var sec = (Date.now() - ts) / 1000;
    if (sec < 90) return 'just now';
    if (sec < 5400) return Math.round(sec / 60) + 'm ago';
    if (sec < 129600) return Math.round(sec / 3600) + 'h ago';
    return Math.round(sec / 86400) + ' days ago';
  }

  /* ══ Verse footer — the same editable verse card, now a quiet line under the grid ══ */
  function renderVerseFooter() {
    var vDate = viewStr();
    var verse = verseFor(vDate);
    if (verseEditing && verseEditDate !== vDate) { verseEditing = false; verseDraft = null; }

    var html = '<div class="today-versefoot"><div class="today-card today-card-verse">';
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
    html += '</div></div>';
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
    min = Math.max(dayStartH() * 60, Math.min(dayEndH() * 60 - 60, min));
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
    var start = Math.max(dayStartH() * 60, Math.min(dayEndH() * 60 - dur, Math.round(startMin / 15) * 15));
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
  var colArmed = null;       // {kind:'dump'|'carry', id, dur} — tap-to-place armed item
  var trayDrag = null;       // drag-from-column state
  var trayDragJustEnded = false;
  var carryUndo = null;      // {id, prev:{date,startMin}} for the carried-over Undo toast
  var bdColDraft = '';       // preserves mid-typed capture text across heartbeat/sync re-renders
  var dragJustEnded = false;

  /* ══ Column placement: tap-to-place + drag, shared guards, deny flashes ══ */
  function gridMinFromY(tgEl, clientY) {
    var rect = tgEl.getBoundingClientRect();
    return Math.round((dayStartH() * 60 + ((clientY - rect.top) / 56) * 60) / 15) * 15;
  }
  function windowBlock(start, dur) {
    if (start < dayStartH() * 60 || start + dur > dayEndH() * 60) {
      return 'Outside your day (' + LC.fmtTime(dayStartH() * 60) + '–' + LC.fmtTime(dayEndH() * 60) + ') — adjust it in Settings';
    }
    return null;
  }
  function flashDeny(start, dur) {
    var name = protectedConflict(start, dur, viewStr());
    if (name) {
      var band = document.querySelector('.tg-routine.protected[data-rname="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]');
      if (band) { band.classList.remove('tg-deny'); void band.offsetWidth; band.classList.add('tg-deny'); }
      return;
    }
    document.querySelectorAll('.tg-card[data-smin]').forEach(function (el) {
      var cs = parseInt(el.dataset.smin, 10), ce = cs + parseInt(el.dataset.dur, 10);
      if (cs < start + dur && ce > start) { el.classList.remove('tg-deny'); void el.offsetWidth; el.classList.add('tg-deny'); }
    });
  }
  function placeArmedAt(min) {
    var a = colArmed; colArmed = null;
    if (!a) return;
    if (a.kind === 'dump') {
      var wb = windowBlock(min, a.dur);   // refuse instead of letting createTaskOn silently clamp
      if (wb) { showToast(wb); render(); return; }
      var ok = window.LC_BrainDump && LC_BrainDump.place && LC_BrainDump.place(a.id, viewStr(), min);
      if (!ok) flashDeny(min, a.dur);   // createTaskOn already toasted
      render();
    } else {
      moveCarriedTo(a.id, min);
    }
  }
  function moveCarriedTo(taskId, min) {
    var tasks = loadTasks();
    var t = tasks.find(function (x) { return x.id === taskId; });
    if (!t) { render(); return; }
    var dur = t.duration || 30;
    var err = windowBlock(min, dur) || placementBlock(taskId, min, dur, viewStr());
    if (err) { showToast(err); flashDeny(min, dur); render(); return; }
    carryUndo = { id: t.id, prev: { date: t.date, startMin: t.startMin } };
    t.date = viewStr(); t.startMin = min;
    saveTasks(tasks);
    render();
    var old = document.getElementById('bd-carry-toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'bd-carry-toast';
    el.className = 'notes-undo-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span>✓ Moved here · ' + LC.fmtTime(min) + '</span><button data-action="carry-undo">Undo</button>';
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 10000);
  }
  function colHintUpdate(e, tgEl) {
    var hint = document.getElementById('tg-hint');
    if (!hint) return;
    var active = colArmed || (trayDrag && trayDrag.moved);
    if (!active) { hint.classList.remove('on'); return; }
    var min = gridMinFromY(tgEl, e.clientY);
    var dur = colArmed ? colArmed.dur : trayDrag.dur;
    var exId = (colArmed && colArmed.kind === 'carry') ? colArmed.id : ((trayDrag && trayDrag.kind === 'carry') ? trayDrag.id : '__new__');
    var bad = windowBlock(min, dur) || placementBlock(exId, min, dur, viewStr());
    hint.style.top = (((min / 60) - dayStartH()) * 56) + 'px';
    hint.setAttribute('data-t', LC.fmtTime(min) + (bad ? ' · blocked' : ''));
    hint.classList.toggle('bad', !!bad);
    hint.classList.add('on');
  }
  function hideColHint() {
    var hint = document.getElementById('tg-hint');
    if (hint) hint.classList.remove('on');
  }

  document.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (LC.get('screen') !== 'today' || LC.get('editor') != null) return;
    var bdRow = e.target.closest('.bdc-row');
    if (bdRow) {
      trayDrag = { kind: bdRow.dataset.kind, id: bdRow.dataset.id, dur: parseInt(bdRow.dataset.dur, 10) || 30,
                   title: bdRow.querySelector('.bdc-title').textContent,
                   startX: e.clientX, startY: e.clientY, moved: false, ghost: null };
      return;
    }
    if (e.target.closest('.tg-check, .tg-card-pill')) return;   // let the check/pill get a clean click
    var card = e.target.closest('.tg-card');
    if (!card) return;
    var t = loadTasks().find(function (x) { return x.id === card.dataset.taskId; });
    if (!t || t.startMin == null) return;
    dragState = { id: card.dataset.taskId, date: t.date, startY: e.clientY, origMin: t.startMin, dur: (t.duration || 30), el: card, moved: false, newMin: t.startMin };
  });

  document.addEventListener('mousemove', function (e) {
    if (trayDrag) {
      if (!trayDrag.moved && Math.abs(e.clientX - trayDrag.startX) + Math.abs(e.clientY - trayDrag.startY) < 5) return;
      if (!trayDrag.moved) {
        trayDrag.moved = true;
        colArmed = null;
        trayDrag.ghost = document.createElement('div');
        trayDrag.ghost.className = 'bdc-ghost';
        trayDrag.ghost.textContent = trayDrag.title;
        document.body.appendChild(trayDrag.ghost);
      }
      trayDrag.ghost.style.left = (e.clientX + 12) + 'px';
      trayDrag.ghost.style.top = (e.clientY + 8) + 'px';
      var tgEl = document.querySelector('#screen-today .tg');
      if (tgEl) {
        var r = tgEl.getBoundingClientRect();
        if (e.clientY >= r.top && e.clientY <= r.bottom && e.clientX >= r.left && e.clientX <= r.right) colHintUpdate(e, tgEl);
        else hideColHint();
      }
      return;
    }
    if (!dragState) return;
    var dy = e.clientY - dragState.startY;
    if (!dragState.moved && Math.abs(dy) < 4) return;
    dragState.moved = true;
    document.body.classList.add('tg-dragging');
    var snapped = Math.round((dragState.origMin + (dy / 56) * 60) / 15) * 15;
    snapped = Math.max(dayStartH() * 60, Math.min(dayEndH() * 60 - dragState.dur, snapped));
    dragState.newMin = snapped;
    dragState.el.style.top = (((snapped / 60) - dayStartH()) * 56) + 'px';
    dragState.el.classList.add('tg-card-drag');
    dragState.el.classList.toggle('tg-card-invalid', !!placementBlock(dragState.id, snapped, dragState.dur, dragState.date));
  });

  document.addEventListener('mouseup', function (e) {
    if (trayDrag) {
      var td = trayDrag; trayDrag = null;
      if (td.ghost) td.ghost.remove();
      hideColHint();
      if (!td.moved) return;   // plain click → the click handler arms it
      trayDragJustEnded = true;
      setTimeout(function () { trayDragJustEnded = false; }, 60);
      var tgEl = document.querySelector('#screen-today .tg');
      if (tgEl) {
        var r = tgEl.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          colArmed = { kind: td.kind, id: td.id, dur: td.dur };
          placeArmedAt(gridMinFromY(tgEl, e.clientY));
          return;
        }
      }
      render();
      return;
    }
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
    if (trayDragJustEnded) { trayDragJustEnded = false; return; }

    /* Armed tap-to-place: with an item armed, any grid tap places it there. */
    if (colArmed && LC.get('screen') === 'today') {
      var tgHit = e.target.closest('#screen-today .tg');
      if (tgHit && !e.target.closest('.bdc-row')) {
        placeArmedAt(gridMinFromY(tgHit, e.clientY));
        return;
      }
    }

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
        createTaskAt(dayStartH() * 60 + ((e.clientY - rect.top) / 56) * 60);
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

    /* ── Brain Dump column ── */
    if (a === 'task-focus') {
      if (window.LC_Focus && LC_Focus.startForTask) LC_Focus.startForTask(action.dataset.taskId);
      return;
    }
    if (a === 'bd-toggle') { LC.set({ bdOpen: LC.get('bdOpen') === false }); return; }
    if (a === 'bd-cancel-arm') { colArmed = null; render(); return; }
    if (a === 'bd-arm') {
      var rowEl = action;
      var kind = rowEl.dataset.kind, rid = rowEl.dataset.id;
      if (colArmed && colArmed.kind === kind && colArmed.id === rid) colArmed = null;
      else colArmed = { kind: kind, id: rid, dur: parseInt(rowEl.dataset.dur, 10) || 30 };
      render();
      return;
    }
    if (a === 'carry-undo') {
      if (carryUndo) {
        var cuTasks = loadTasks();
        var cuT = cuTasks.find(function (x) { return x.id === carryUndo.id; });
        if (cuT) { cuT.date = carryUndo.prev.date; cuT.startMin = carryUndo.prev.startMin; saveTasks(cuTasks); }
        carryUndo = null;
        var cuEl = document.getElementById('bd-carry-toast');
        if (cuEl) cuEl.remove();
        render();
      }
      return;
    }

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
      var proposedStart = Math.max(dayStartH() * 60, Math.min(dayEndH() * 60 - stDur, (st0.startMin != null ? st0.startMin : 540) + sd));
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
      var proposedDur = Math.max(15, Math.min(dayEndH() * 60 - dtStart, (dt0.duration || 90) + dd));
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

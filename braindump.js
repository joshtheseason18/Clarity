/* ══════════════════════════════════════════
   Luclaro — Brain Dump + Projects
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var KEY = 'braindump';
  var KEY_PROJ = 'projects';
  var subAdding = false;
  var dumpType = 'task';   // selected type for the inline add bar
  var dumpDraft = '';      // preserves typed text across re-render (e.g. switching type pill)
  var completedOpen = false; // Completed projects section expanded
  var sessionPrompt = null;  // {projId, all} → the "session done / complete project" fork in Projects detail
  var pjPillTimer = null;    // bottom pill timer for the Today-grid session-complete prompt
  var dumpSort = 'oldest';   // brain-dump sort: 'oldest' | 'newest'
  var histOpen = false;      // History (scheduled captures) expanded
  var dumpIdSeq = 0;         // same-millisecond id collision guard (same pattern as tasks)
  var dumpPick = null;       // {id, kind:'date'|'time'|'dur', month} — open readiness picker
  var dumpConf = null;       // id of an item awaiting delete confirmation
  var dumpPulse = null;      // id of an item whose missing chips should pulse
  var dumpGrace = {};        // id -> timeout id for the 6s "just scheduled" grey window

  function loadDump() { var v = LC.loadData(KEY); return Array.isArray(v) ? v : []; }
  function saveDump(arr) { LC.saveData(KEY, arr); }
  function loadProjects() { var v = LC.loadData(KEY_PROJ); return Array.isArray(v) ? v : []; }
  function saveProjects(arr) { LC.saveData(KEY_PROJ, arr); }

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

  function two(n) { return String(n).padStart(2, '0'); }
  // Respect the 12/24-hour setting everywhere (was a local AM/PM-only formatter).
  function fmtClock(min) { return LC.fmtTime(min); }
  function fmtRange(start, dur) { return LC.fmtTime(start) + ' – ' + LC.fmtTime(start + dur); }
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
    // dump-list picker/confirm state is meaningless anywhere but the dump list — don't let it re-open on return
    if (!(LC.get('screen') === 'braindump' && LC.get('lens') === 'dump')) { dumpPick = null; dumpConf = null; }
    if (LC.get('screen') === 'braindump') {
      var el = document.getElementById('screen-braindump');
      var lens = LC.get('lens');

      if (lens === 'dump') {
        el.innerHTML = renderDumpView();
        attachDumpInput();
      } else if (LC.get('projOpen')) {
        el.innerHTML = renderProjectDetail(LC.get('projOpen'));
        attachProjectDetail();
      } else {
        el.innerHTML = renderProjectsView();
      }
    }
    renderDrawer();
  }

  function attachDumpInput() {
    var inp = document.getElementById('bd-input-field');
    if (inp) {
      inp.addEventListener('input', function () { dumpDraft = inp.value; });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); addDumpFromInput(); }
      });
    }
    // Typed time entry inside an open time picker ("3:30pm", "15:00", …)
    var timeInp = document.querySelector('.bd-time-input');
    if (timeInp) {
      timeInp.focus();
      timeInp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var mn = parseClock(timeInp.value);
        if (mn == null) return;
        var arr = loadDump(); var it = arr.find(function (i) { return i.id === timeInp.dataset.dumpId; });
        if (it) { it.pStart = mn; delete it.pBlocked; saveDump(arr); dumpPick = null; render(); }
      });
    }
  }

  function fmtDue(iso) {
    if (!iso) return '';
    var p = iso.split('-'); var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return DOW[dt.getDay()] + ', ' + MO[dt.getMonth()] + ' ' + dt.getDate();
  }
  function daysUntil(iso) {
    var p = iso.split('-'); var due = new Date(+p[0], +p[1] - 1, +p[2]);
    var today = new Date(); today.setHours(0, 0, 0, 0); due.setHours(0, 0, 0, 0);
    return Math.round((due - today) / (24 * 60 * 60 * 1000));
  }

  function attachProjectDetail() {
    var id = LC.get('projOpen');
    var title = document.getElementById('pd-title-input');
    if (title) {
      // save without re-render so focus/caret are preserved while typing
      title.addEventListener('input', function () {
        var arr = loadProjects(); var p = arr.find(function (x) { return x.id === id; });
        if (p) { p.title = title.value; saveProjects(arr); }
      });
    }
    var desc = document.getElementById('pd-desc-input');
    if (desc) {
      var grow = function () { desc.style.height = 'auto'; desc.style.height = Math.max(desc.scrollHeight, 40) + 'px'; };
      grow();
      desc.addEventListener('input', function () {
        grow();
        var arr = loadProjects(); var p = arr.find(function (x) { return x.id === id; });
        if (p) { p.desc = desc.value; saveProjects(arr); }
      });
    }
    var due = document.getElementById('pd-due-input');
    if (due) {
      due.addEventListener('change', function () {
        updateProject(id, function (p) {
          p.dueISO = due.value;
          p.dueFull = fmtDue(due.value);
          if (due.value) { var dg = daysUntil(due.value); p.daysToGo = dg; p.urgent = dg <= 7; }
          else { p.daysToGo = 999; p.urgent = false; }   // cleared date → no urgency
        });
      });
    }
  }

  /* ══════════════════════════════════════════
     Smart capture — parse date/time/duration/type out of free text.
     "7/15 dr appt 3pm" → {title:'Dr appt', dateISO:'2026-07-15', startMin:900, type:'event'}
     ══════════════════════════════════════════ */
  var MO_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var DOW_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var EVENT_WORDS = /\b(appt|appointment|dr\.?|doctor|dentist|meeting|call|interview|visit|checkup|church|service)\b/i;

  function isoOf(d) { return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); }

  function parseCapture(text) {
    var out = { title: text, dateISO: null, startMin: null, durationMin: null, type: null };
    var s = ' ' + text + ' ';
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var m;

    // 7/15 (optional /2026). Slash ONLY — hyphens would eat ranges like "9-5 planning" as dates.
    m = s.match(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=[\s,.!?])/);
    if (m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31) {
      var yr = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
      var cand = new Date(yr, +m[1] - 1, +m[2]);
      if (!m[3] && cand < now) cand.setFullYear(cand.getFullYear() + 1);   // 1/5 typed in July → next Jan
      out.dateISO = isoOf(cand);
      s = s.replace(m[0], ' ');
    }
    // "jul 15" / "july 15"
    if (!out.dateISO) {
      m = s.match(/\s(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?=[\s,.!?])/i);
      if (m && +m[2] >= 1 && +m[2] <= 31) {
        var mi2 = MO_NAMES.indexOf(m[1].toLowerCase());
        var cand2 = new Date(now.getFullYear(), mi2, +m[2]);
        if (cand2 < now) cand2.setFullYear(cand2.getFullYear() + 1);
        out.dateISO = isoOf(cand2);
        s = s.replace(m[0], ' ');
      }
    }
    // today / tomorrow / weekday name → soonest occurrence
    if (!out.dateISO) {
      m = s.match(/\s(today|tonight|tomorrow|tmrw|tmr)(?=[\s,.!?])/i);
      if (m) {
        var d3 = new Date(now);
        if (!/today|tonight/i.test(m[1])) d3.setDate(d3.getDate() + 1);
        out.dateISO = isoOf(d3);
        s = s.replace(m[0], ' ');
      }
    }
    if (!out.dateISO) {
      m = s.match(/\s(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:[a-z]*day)?(?=[\s,.!?])/i);
      if (m) {
        var want = -1;
        DOW_NAMES.forEach(function (n, i) { if (n.indexOf(m[1].toLowerCase().slice(0, 3)) === 0) want = i; });
        if (want >= 0) {
          var d4 = new Date(now);
          d4.setDate(d4.getDate() + ((want - d4.getDay() + 7) % 7));   // soonest, today counts
          out.dateISO = isoOf(d4);
          s = s.replace(m[0], ' ');
        }
      }
    }
    // duration BEFORE time (so "1h" isn't eaten as an hour) — "for 1h", "30m", "1.5 hours"
    m = s.match(/\s(?:for\s+)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)(?=[\s,.!?])/i);
    if (m) { out.durationMin = Math.max(15, Math.round(parseFloat(m[1]) * 60)); s = s.replace(m[0], ' '); }
    if (!out.durationMin) {
      m = s.match(/\s(?:for\s+)?(\d+)\s*(m|min|mins|minutes)(?=[\s,.!?])/i);
      if (m) { out.durationMin = Math.max(15, +m[1]); s = s.replace(m[0], ' '); }
    }
    // time — "3pm", "3:30 pm", "15:00", "at 3"
    m = s.match(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=[\s,.!?])/i);
    if (m) {
      var hh = +m[1] % 12; if (m[3].toLowerCase() === 'pm') hh += 12;
      out.startMin = hh * 60 + (+m[2] || 0);
      s = s.replace(m[0], ' ');
    } else {
      m = s.match(/\s(?:at\s+)?(\d{1,2}):(\d{2})(?=[\s,.!?])/);
      if (m && +m[1] <= 23 && +m[2] <= 59) { out.startMin = +m[1] * 60 + +m[2]; s = s.replace(m[0], ' '); }
    }
    // type inference (word stays in the title — "Dr. appt" should still read "Dr. appt")
    if (EVENT_WORDS.test(text)) out.type = 'event';

    out.title = s.replace(/\s+/g, ' ').replace(/^[\s,.\-–·]+|[\s,.\-–·]+$/g, '').trim();
    if (!out.title) {
      // tokens consumed everything ("3pm") → don't resurrect the token as the title
      var strippedAny = out.dateISO || out.startMin != null || out.durationMin != null;
      out.title = strippedAny ? 'Untitled' : text.trim();
    }
    return out;
  }

  /* Unschedule a captured item: remove its calendar entry, return it to Unplanned with chips intact. */
  function unscheduleDumpItem(itemId) {
    if (dumpGrace[itemId]) { clearTimeout(dumpGrace[itemId]); delete dumpGrace[itemId]; }   // never leave a grace card pointing at a nulled date
    var items = loadDump();
    var item = items.find(function (i) { return i.id === itemId; });
    if (!item) return;
    if (item.taskId) {
      var tasks = LC.loadData('tasks') || [];
      var live = tasks.find(function (t) { return t.id === item.taskId; });
      if (live) {
        // keep any edits made in the Day editor — the chips resume from where the task really was
        if (live.date) item.pDate = live.date;
        if (live.startMin != null) item.pStart = live.startMin;
        if (live.duration != null) item.pDur = live.duration;
        if (live.title && live.title.trim()) item.title = live.title.trim();
      }
      if (LC.get('editor') === item.taskId) LC.set({ editor: null });   // don't leave the editor on a deleted task
      LC.saveData('tasks', tasks.filter(function (t) { return t.id !== item.taskId; }));
    }
    delete item.taskId; item.date = null; delete item.scheduledAt;
    saveDump(items);
    var toast = document.getElementById('bd-undo-toast');
    if (toast) toast.remove();
    render();
  }

  function addDumpFromInput() {
    var inp = document.getElementById('bd-input-field');
    var val = (inp ? inp.value : dumpDraft).trim();
    if (!val) { if (inp) inp.focus(); return; }
    dumpDraft = '';
    if (dumpType === 'project') {
      var projects = loadProjects().filter(function (p) { return !p.sample; });   // a real project retires the sample
      var np = { id: 'p' + Date.now(), title: val, total: 4, done: 0, daysToGo: 999, urgent: false, due: '', desc: '', plan: defaultPlan({ total: 4 }), sessions: [] };
      projects.push(np);
      saveProjects(projects);
      LC.set({ lens: 'projects', projOpen: np.id });   // jump into the new project to add details
      return;
    }
    // Smart capture: pull date/time/duration/type out of the text
    var parsed = parseCapture(val);
    var items = loadDump();
    var item = {
      id: 'd' + Date.now() + '_' + (++dumpIdSeq), title: parsed.title,
      type: parsed.type || (dumpType === 'event' ? 'event' : 'task'),
      created: Date.now(), date: null,
      pDate: parsed.dateISO, pStart: parsed.startMin, pDur: parsed.durationMin
    };
    items.push(item);
    saveDump(items);   // no auto-schedule — the user commits with the checkmark
    render();
    var again = document.getElementById('bd-input-field');
    if (again) again.focus();
  }

  /* ══════════════════════════════════════════
     Readiness model — explicit checkmark commit (Brain dump)
     Every unplanned item shows date · time · duration chips; missing date/time
     show an amber "missing" chip. The checkmark schedules only when date+time
     are set (duration defaults to 1h). On commit the card greys for 6s and moves
     to History; the recycle icon unschedules from the grace window or History.
     ══════════════════════════════════════════ */
  var MO_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function shortDate(iso) { var p = iso.split('-'); return SMO[+p[1] - 1] + ' ' + (+p[2]); }
  function dumpReady(it) { return !!it.pDate && it.pStart != null; }
  function parseClock(str) {
    str = (str || '').trim().toLowerCase();
    var m = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!m) return null;
    var h = +m[1], mm = m[2] ? +m[2] : 0, ap = m[3];
    if (ap) { if (h === 12) h = 0; if (ap === 'pm') h += 12; }
    if (h > 23 || mm > 59) return null;
    return Math.max(420, Math.min(1140, h * 60 + mm));
  }
  function startGrace(id) {
    if (dumpGrace[id]) clearTimeout(dumpGrace[id]);
    dumpGrace[id] = setTimeout(function () { delete dumpGrace[id]; render(); }, 6000);
  }
  function scheduleDumpItem(item, items) {
    if (!dumpReady(item)) return false;
    if (!window.LC_Today || !LC_Today.createTaskOn) return false;
    var dur = Math.max(15, item.pDur || 60);
    var start = Math.max(420, Math.min(1140 - dur, Math.round(item.pStart / 15) * 15));
    item.pStart = start; item.pDur = dur;
    var id = LC_Today.createTaskOn(item.pDate, start, dur, item.title, item.type);
    if (!id) { item.pBlocked = true; saveDump(items); return false; }   // locked/overlap → chip explains
    delete item.pBlocked;
    item.taskId = id; item.date = item.pDate; item.scheduledAt = Date.now();
    saveDump(items);
    startGrace(item.id);
    return true;
  }
  function recycleDumpItem(id) {
    if (dumpGrace[id]) { clearTimeout(dumpGrace[id]); delete dumpGrace[id]; }
    unscheduleDumpItem(id);   // deletes the task, returns the item to Unplanned, re-renders
  }

  function renderDumpChips(item) {
    var h = '<div class="bd-chips">';
    if (item.pDate) h += '<span class="bd-chip tap" data-action="dump-pick" data-kind="date" data-dump-id="' + item.id + '"><i class="ti ti-calendar"></i> ' + shortDate(item.pDate) + '</span>';
    else h += '<span class="bd-chip ask' + (dumpPulse === item.id ? ' pulse' : '') + '" data-action="dump-pick" data-kind="date" data-dump-id="' + item.id + '"><i class="ti ti-calendar-plus"></i> Date missing</span>';
    if (item.pStart != null) h += '<span class="bd-chip tap" data-action="dump-pick" data-kind="time" data-dump-id="' + item.id + '"><i class="ti ti-clock"></i> ' + LC.fmtTime(item.pStart) + '</span>';
    else h += '<span class="bd-chip ask' + (dumpPulse === item.id ? ' pulse' : '') + '" data-action="dump-pick" data-kind="time" data-dump-id="' + item.id + '"><i class="ti ti-clock-plus"></i> Time missing</span>';
    h += '<span class="bd-chip tap def" data-action="dump-pick" data-kind="dur" data-dump-id="' + item.id + '"><i class="ti ti-hourglass"></i> ' + LC.fmtDur(item.pDur || 60) + '</span>';
    if (item.pBlocked) h += '<span class="bd-chip blocked"><i class="ti ti-alert-triangle"></i> That slot is blocked — pick another time</span>';
    h += '</div>';
    return h;
  }
  function renderDumpPicker(item) {
    if (dumpPick.kind === 'time') return renderTimePop(item);
    if (dumpPick.kind === 'dur') return renderDurPop(item);
    return renderDatePop(item);
  }
  function renderDatePop(item) {
    var anchor = dumpPick.month || item.pDate || todayISO();
    var p = anchor.split('-'); var y = +p[0], mo = +p[1] - 1;
    var lead = new Date(y, mo, 1).getDay();
    var days = new Date(y, mo + 1, 0).getDate();
    var todayI = todayISO(), tmr = shiftISO(todayI, 1);
    var h = '<div class="bd-pop">';
    h += '<div class="bd-pop-quick"><button class="bd-pk' + (item.pDate === todayI ? ' on' : '') + '" data-action="dump-setdate" data-dump-id="' + item.id + '" data-date="' + todayI + '">Today</button><button class="bd-pk' + (item.pDate === tmr ? ' on' : '') + '" data-action="dump-setdate" data-dump-id="' + item.id + '" data-date="' + tmr + '">Tomorrow</button></div>';
    h += '<div class="bd-cal-head"><button class="bd-chip-btn" data-action="dump-month" data-dir="-1" data-dump-id="' + item.id + '"><i class="ti ti-chevron-left"></i></button><span>' + MO_FULL[mo] + ' ' + y + '</span><button class="bd-chip-btn" data-action="dump-month" data-dir="1" data-dump-id="' + item.id + '"><i class="ti ti-chevron-right"></i></button></div>';
    h += '<div class="bd-cal-dow"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>';
    h += '<div class="bd-cal-grid">';
    for (var i = 0; i < lead; i++) h += '<span class="bd-cell blank"></span>';
    for (var d = 1; d <= days; d++) {
      var iso = y + '-' + two(mo + 1) + '-' + two(d);
      var past = iso < todayI;
      var cls = 'bd-cell' + (past ? ' past' : '') + (iso === todayI ? ' today' : '') + (iso === item.pDate ? ' sel' : '');
      h += past ? '<span class="' + cls + '">' + d + '</span>' : '<span class="' + cls + '" data-action="dump-setdate" data-dump-id="' + item.id + '" data-date="' + iso + '">' + d + '</span>';
    }
    h += '</div></div>';
    return h;
  }
  function renderTimePop(item) {
    var presets = [420, 480, 540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080];   // 7 AM–6 PM: valid start times within the 7 AM–7 PM grid
    var h = '<div class="bd-pop"><div class="bd-pk-grid">';
    presets.forEach(function (mn) { h += '<button class="bd-pk' + (item.pStart === mn ? ' on' : '') + '" data-action="dump-settime" data-dump-id="' + item.id + '" data-min="' + mn + '">' + LC.fmtTime(mn) + '</button>'; });
    h += '</div><input class="bd-time-input" data-dump-id="' + item.id + '" placeholder="or type a time, e.g. 3:30pm" autocomplete="off"></div>';
    return h;
  }
  function renderDurPop(item) {
    var opts = [15, 30, 45, 60, 90, 120, 180, 240];
    var cur = item.pDur || 60;
    var h = '<div class="bd-pop"><div class="bd-pk-grid">';
    opts.forEach(function (mn) { h += '<button class="bd-pk' + (cur === mn ? ' on' : '') + '" data-action="dump-setdur" data-dump-id="' + item.id + '" data-min="' + mn + '">' + LC.fmtDur(mn) + '</button>'; });
    h += '</div></div>';
    return h;
  }
  function renderDumpItem(item) {
    var inGrace = !!dumpGrace[item.id] && !!item.date;   // a grace card requires a real date (never renders a nulled one)
    var cls = 'bd-item' + (inGrace ? ' bd-item-grace' : (dumpReady(item) ? ' bd-item-ready' : ''));
    var h = '<div class="' + cls + '" data-dump-id="' + item.id + '">';
    h += '<div class="bd-item-row">';
    if (item.type === 'event') h += '<span class="bd-item-bar-event"></span>';
    h += '<div class="bd-item-body">';
    h += '<div class="bd-item-title">' + esc(item.title) + (item.type === 'event' ? ' <span class="bd-item-badge event">Event</span>' : '') + '</div>';
    if (inGrace) {
      h += '<div class="bd-item-meta bd-item-sched"><i class="ti ti-check"></i> Scheduled · ' + shortDate(item.date) + ' · ' + LC.fmtTime(item.pStart != null ? item.pStart : 540) + ' — added to History</div>';
      h += '<div class="bd-grace-bar"></div>';
    } else {
      h += '<div class="bd-item-meta">' + relTime(item.created) + '</div>';
      h += renderDumpChips(item);
    }
    h += '</div>';
    h += '<div class="bd-item-actions">';
    if (inGrace) {
      h += '<button class="bd-go bd-go-sched" data-action="dump-recycle" data-dump-id="' + item.id + '" aria-label="Unschedule" title="Unschedule"><i class="ti ti-refresh"></i></button>';
    } else {
      h += '<button class="bd-item-del" data-action="dump-del" data-dump-id="' + item.id + '" aria-label="Delete" title="Delete"><i class="ti ti-x"></i></button>';
      h += '<button class="bd-go' + (dumpReady(item) ? ' ready' : '') + '" data-action="dump-check" data-dump-id="' + item.id + '" aria-label="Schedule" title="' + (dumpReady(item) ? 'Schedule' : 'Add a date and time first') + '"><i class="ti ti-check"></i></button>';
    }
    h += '</div>';
    h += '</div>';   // bd-item-row
    if (dumpConf === item.id) {
      h += '<div class="bd-confirm"><span class="bd-confirm-text">Delete this ' + (item.type === 'event' ? 'event' : 'task') + '?</span><button class="bd-confirm-yes" data-action="dump-del-yes" data-dump-id="' + item.id + '">Delete</button><button class="bd-confirm-no" data-action="dump-del-no" data-dump-id="' + item.id + '">Cancel</button></div>';
    }
    if (!inGrace && dumpPick && dumpPick.id === item.id) h += renderDumpPicker(item);
    h += '</div>';   // bd-item
    return h;
  }

  /* ══════════════════════════════════════════
     Brain Dump View
     ══════════════════════════════════════════ */
  function renderDumpView() {
    var items = loadDump();
    // Reconcile orphans: if a scheduled item's linked task was deleted, return it to the unplanned list.
    var taskIds = {};
    (LC.loadData('tasks') || []).forEach(function (t) { taskIds[t.id] = true; });
    var changed = false;
    items.forEach(function (it) {
      if (it.taskId && !taskIds[it.taskId]) {
        delete it.taskId; it.date = null; changed = true;
        if (dumpGrace[it.id]) { clearTimeout(dumpGrace[it.id]); delete dumpGrace[it.id]; }   // its grace card would now read a null date
      }
    });
    if (changed) saveDump(items);
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
    var ph = dumpType === 'project' ? 'Name a project…' : (dumpType === 'event' ? 'Add an event…' : 'Add a task or thought…');
    html += '<div class="bd-input">';
    html += '<i class="ti ti-plus bd-input-icon" data-action="add-dump-go"></i>';
    html += '<input class="bd-input-field" id="bd-input-field" placeholder="' + ph + '" value="' + escAttr(dumpDraft) + '" autocomplete="off">';
    html += '<span class="bd-input-spacer"></span>';
    html += '<div class="bd-input-types">';
    html += '<span class="bd-type-pill' + (dumpType === 'task' ? ' active' : '') + '" data-action="dump-type" data-type="task"><i class="ti ti-circle"></i> Task</span>';
    html += '<span class="bd-type-pill' + (dumpType === 'event' ? ' active' : '') + '" data-action="dump-type" data-type="event"><i class="ti ti-calendar"></i> Event</span>';
    html += '<span class="bd-type-pill' + (dumpType === 'project' ? ' active' : '') + '" data-action="dump-type" data-type="project"><i class="ti ti-target"></i> Project</span>';
    html += '</div>';
    html += '</div>';

    // Sort (oldest ↔ newest — confirmed-decision #1)
    items = items.slice().sort(function (a, b) { return dumpSort === 'newest' ? (b.created || 0) - (a.created || 0) : (a.created || 0) - (b.created || 0); });

    // Section label
    var unplanned = items.filter(function (i) { return !i.date; });
    html += '<div class="bd-section-label"><i class="ti ti-stack-2"></i><span class="bd-section-count">Unplanned · ' + unplanned.length + '</span><span class="bd-section-sort" data-action="toggle-dump-sort"><i class="ti ti-arrows-sort"></i> ' + (dumpSort === 'newest' ? 'newest first' : 'oldest first') + '</span></div>';

    // Items — Unplanned drafts, plus any in their 6-second "just scheduled" grace window
    var listItems = items.filter(function (i) { return !i.date || dumpGrace[i.id]; });
    html += '<div class="bd-items">';
    if (listItems.length === 0) {
      html += '<div class="bd-empty">No thoughts yet. Add something above.</div>';
    }
    listItems.forEach(function (item) { html += renderDumpItem(item); });
    html += '</div>';
    html += '</div>';

    /* ── Right column ── */
    html += '<div class="bd-right">';

    // Carried over — past-day unfinished tasks, one tap to bring onto today
    var todayI = todayISO();
    var carried = (LC.loadData('tasks') || []).filter(function (t) { return t.date && t.date < todayI && !t.done; });
    html += '<div class="bd-carried">';
    html += '<div class="bd-carried-header"><div class="bd-carried-label"><i class="ti ti-history"></i><span>Carried over · ' + carried.length + '</span></div></div>';
    if (carried.length === 0) {
      html += '<div class="bd-carried-empty">Nothing carried over. Nice work!</div>';
    } else {
      carried.slice(0, 8).forEach(function (t) {
        var cp = t.date.split('-');
        var cLbl = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+cp[1] - 1] + ' ' + (+cp[2]);
        html += '<div class="bd-carried-row">';
        html += '<div class="bd-carried-main"><div class="bd-carried-title">' + esc(t.title && t.title.trim() ? t.title : 'Untitled') + '</div><div class="bd-carried-sub">from ' + cLbl + (t.startMin != null ? ' · ' + LC.fmtTime(t.startMin) : '') + '</div></div>';
        html += '<button class="bd-carried-move" data-action="carry-to-today" data-task-id="' + escAttr(t.id) + '">→ Today</button>';
        html += '</div>';
      });
      if (carried.length > 8) html += '<div class="bd-carried-more">+' + (carried.length - 8) + ' more on past days</div>';
    }
    html += '</div>';

    // History — auto/manually scheduled captures, with Edit / Unschedule
    var scheduled = items.filter(function (i) { return i.date; }).sort(function (a, b) { return (b.scheduledAt || 0) - (a.scheduledAt || 0); });
    html += '<div class="bd-history" data-action="toggle-history"><i class="ti ti-chevron-' + (histOpen ? 'down' : 'right') + '"></i><span>History</span><span class="bd-history-count">· ' + scheduled.length + ' scheduled</span></div>';
    if (histOpen && scheduled.length > 0) {
      var allTasks = LC.loadData('tasks') || [];
      html += '<div class="bd-hist-list">';
      scheduled.forEach(function (it) {
        var lt = allTasks.find(function (t) { return t.id === it.taskId; });
        var when = '';
        if (lt && lt.date) {
          var hp = lt.date.split('-');
          when = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+hp[1] - 1] + ' ' + (+hp[2]) + (lt.startMin != null ? ' · ' + LC.fmtTime(lt.startMin) : '');
        }
        html += '<div class="bd-hist-row">';
        html += '<div class="bd-hist-main"><div class="bd-hist-title">' + esc(it.title) + '</div><div class="bd-hist-sub">' + (when || 'scheduled') + '</div></div>';
        if (it.taskId) {
          html += '<button class="bd-hist-btn" data-action="hist-edit" data-task-id="' + escAttr(it.taskId) + '">Edit</button>';
          html += '<button class="bd-hist-btn" data-action="hist-unschedule" data-dump-id="' + escAttr(it.id) + '"><i class="ti ti-refresh"></i> Unschedule</button>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    html += '</div>'; // bd-grid
    html += '</div>'; // bd-wrap

    return html;
  }

  /* ══════════════════════════════════════════
     Projects View
     ══════════════════════════════════════════ */
  // Live countdown: derive from the stored due date at render time so it decays as real
  // days pass (the stored p.daysToGo was a frozen snapshot from when the date was set).
  function daysToGo(p) {
    if (p.dueISO) return daysUntil(p.dueISO);
    return typeof p.daysToGo === 'number' ? p.daysToGo : 999;
  }
  function isUrgent(p) { return !!p.dueISO && daysToGo(p) <= 7; }
  function byDays(a, b) { return daysToGo(a) - daysToGo(b); }

  function renderProjectsView() {
    var projects = loadProjects();
    var view = LC.get('projView') || 'urgency';
    var active = projects.filter(function (p) { return !p.completed; });
    var completedCount = projects.filter(function (p) { return p.completed; }).length;

    var html = '<div class="pj-wrap"><div class="pj-panel">';

    /* Topbar: sort label (only when populated) + New project */
    html += '<div class="pj-topbar">';
    html += '<span class="pj-sort-label">' + (active.length ? 'Sorted by ' + (view === 'spine' ? 'deadline' : 'urgency') : '') + '</span>';
    html += '<button class="pj-new-btn" data-action="new-project"><i class="ti ti-plus"></i> New project</button>';
    html += '</div>';

    if (active.length === 0) {
      html += '<div class="pj-empty-rich">';
      html += '<h1 class="pj-empty-title serif">Projects</h1>';
      html += '<p class="pj-empty-desc">A project breaks a big task into smaller sessions you can schedule — so it feels manageable, not overwhelming.</p>';
      html += '<div class="pj-how"><div class="pj-how-label">How it works</div>';
      html += '<div class="pj-step"><span class="pj-step-num">1</span><span>Name it and set a due date</span></div>';
      html += '<div class="pj-step"><span class="pj-step-num">2</span><span>Plan the sessions — how many, how long, which days</span></div>';
      html += '<div class="pj-step"><span class="pj-step-num">3</span><span>Approve, and we slot them into your open days before the deadline</span></div>';
      html += '</div>';
      html += '<button class="pj-sample" data-action="proj-sample">';
      html += '<div class="pj-sample-top"><span class="pj-sample-name"><i class="ti ti-book"></i> Read “Atomic Habits”</span><span class="pj-sample-badge">Sample</span></div>';
      html += '<div class="pj-sample-sub">4 sessions · ~1h each · due in 3 weeks</div>';
      html += '<div class="pj-sample-foot"><span class="pj-sample-explore">Explore the sample <i class="ti ti-arrow-right"></i></span><span class="pj-sample-note"><i class="ti ti-calendar-off"></i> won’t touch your calendar</span></div>';
      html += '</button>';
      html += '<div class="pj-starters"><span class="pj-starters-label">or start from</span>';
      ['Study for an exam', 'Write a paper', 'Read a book'].forEach(function (t) {
        html += '<button class="pj-starter" data-action="proj-template" data-title="' + escAttr(t) + '">' + esc(t) + '</button>';
      });
      html += '</div>';
      html += '</div>';
    } else if (view === 'spine') {
      html += renderSpineView(active);
    } else {
      html += renderUrgencyView(active);
    }

    /* Completed footer */
    if (active.length > 0 || completedCount > 0) {
      html += '<div class="pj-completed" data-action="open-completed">';
      html += '<i class="ti ti-chevron-' + (completedOpen ? 'down' : 'right') + '"></i>';
      html += '<i class="ti ti-circle-check-filled pj-completed-check"></i>';
      html += '<span class="pj-completed-label">Completed</span>';
      if (completedCount > 0) {
        html += '<span class="pj-completed-count">· ' + completedCount + ' project' + (completedCount !== 1 ? 's' : '') + '</span>';
      }
      html += '</div>';
      if (completedOpen) {
        html += '<div class="pj-completed-list">';
        var done = projects.filter(function (p) { return p.completed; });
        if (done.length === 0) {
          html += '<div class="pj-completed-empty">No completed projects yet.</div>';
        } else {
          done.forEach(function (p) {
            html += '<div class="pj-completed-row">';
            html += '<i class="ti ti-circle-check-filled pj-completed-row-check"></i>';
            html += '<span class="pj-completed-row-title">' + esc(p.title) + '</span>';
            html += '<button class="pj-reopen-btn" data-action="proj-reopen" data-project-id="' + esc(p.id) + '">Reopen</button>';
            html += '</div>';
          });
        }
        html += '</div>';
      }
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

    var urgent = isUrgent(p);
    var html = '<button class="pj-urow' + (urgent ? ' urgent' : '') + '" data-action="open-project" data-project-id="' + esc(p.id) + '">';
    html += '<div class="pj-urow-main">';
    html += '<div class="pj-urow-title">' + esc(p.title) + '</div>';
    if (urgent) {
      html += '<div class="pj-urow-sub urgent"><i class="ti ti-alert-triangle"></i> ' + left + ' session' + (left !== 1 ? 's' : '') + ' left · ' + d + ' day' + (d !== 1 ? 's' : '') + ' to go</div>';
    } else {
      html += '<div class="pj-urow-sub">' + esc(p.sub || (p.dueFull ? 'due ' + p.dueFull : 'no due date')) + '</div>';
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

    var urgent = isUrgent(p);
    var html = '<div class="pj-spine-row">';
    html += '<div class="pj-spine-badge' + (urgent ? ' urgent' : '') + '">';
    html += '<span class="pj-spine-days">' + d + '</span>';
    html += '<span class="pj-spine-dayslabel">days</span>';
    html += '</div>';
    html += '<button class="pj-spine-card' + (urgent ? ' urgent' : '') + '" data-action="open-project" data-project-id="' + esc(p.id) + '">';
    html += '<div class="pj-spine-main">';
    html += '<div class="pj-spine-title">' + esc(p.title) + '</div>';
    if (urgent) {
      html += '<div class="pj-spine-sub urgent">' + left + ' session' + (left !== 1 ? 's' : '') + ' left to finish in time</div>';
    } else {
      html += '<div class="pj-spine-sub">' + esc(p.subSpine || p.sub || (p.dueFull ? 'due ' + p.dueFull : 'no due date')) + '</div>';
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

  /* Date-aware placement gate for SESSIONS (tasks have their own in today.js, today-only).
     Returns a message when [start,start+dur) on dateISO hits a locked routine or would
     exceed 3 overlapping items; null when the slot is fine. `exceptProjId/exceptIdx`
     exclude the session being moved from counting against itself. */
  function sessionBlock(dateISO, start, dur, exceptProjId, exceptIdx) {
    if (!dateISO) return null;
    var end = start + dur;
    var p = dateISO.split('-');
    var dow = new Date(+p[0], +p[1] - 1, +p[2]).getDay();
    var routines = (window.LC_Routines ? LC_Routines.loadRoutines() : []);
    var locked = routines.filter(function (r) {
      return r.protected && r.days && r.days.indexOf(dow) >= 0 && start < r.endMin && end > r.startMin;
    })[0];
    if (locked) return '“' + locked.name + '” is locked — nothing can be scheduled then';

    var spans = [];
    (LC.loadData('tasks') || []).forEach(function (t) {
      if (t.date === dateISO && t.startMin != null) spans.push({ s: t.startMin, e: t.startMin + (t.duration || 30) });
    });
    loadProjects().forEach(function (pr) {
      if (pr.sample) return;   // sample sessions never affect real scheduling
      (pr.sessions || []).forEach(function (s, i) {
        if (pr.id === exceptProjId && i === exceptIdx) return;
        if (s.date === dateISO && s.startMin != null) spans.push({ s: s.startMin, e: s.startMin + (s.durationMin || 60) });
      });
    });
    spans.push({ s: start, e: end });
    var points = [start];
    spans.forEach(function (it) { if (it.s > start && it.s < end) points.push(it.s); });
    var peak = 0;
    points.forEach(function (pt) {
      var c = 0;
      spans.forEach(function (it) { if (it.s <= pt && pt < it.e) c++; });
      if (c > peak) peak = c;
    });
    if (peak > 3) return 'Only 3 items can overlap in one slot';
    return null;
  }
  function sessToast(msg) { if (window.LC_Today && LC_Today.showToast) LC_Today.showToast(msg); }

  /* Everything that shares [start,start+dur) on dateISO — for the drawer's conflict warning.
     Overlaps under the 3-item cap are ALLOWED but surfaced, so the user schedules with eyes open. */
  function sessionOverlaps(dateISO, start, dur, exceptProjId, exceptIdx) {
    if (!dateISO || start == null) return [];
    var end = start + dur;
    var out = [];
    (LC.loadData('tasks') || []).forEach(function (t) {
      if (t.date === dateISO && t.startMin != null && start < t.startMin + (t.duration || 30) && end > t.startMin) {
        out.push((t.type === 'event' ? 'Event · ' : 'Task · ') + (t.title && t.title.trim() ? t.title : 'Untitled') + ' (' + fmtRange(t.startMin, t.duration || 30) + ')');
      }
    });
    loadProjects().forEach(function (pr) {
      if (pr.sample) return;   // sample sessions never surface as real conflicts
      (pr.sessions || []).forEach(function (s, i) {
        if (pr.id === exceptProjId && i === exceptIdx) return;
        if (s.date === dateISO && s.startMin != null && start < s.startMin + (s.durationMin || 60) && end > s.startMin) {
          out.push('Session · ' + pr.title + (s.label ? ' — ' + s.label : '') + ' (' + fmtRange(s.startMin, s.durationMin || 60) + ')');
        }
      });
    });
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
    html += '<input class="pd-title-input serif" id="pd-title-input" value="' + escAttr(p.title) + '" placeholder="Project name">';
    html += '<div class="pd-subtitle">' + esc(kind) + ' · ' + total + ' session' + (total !== 1 ? 's' : '') + ' planned</div>';
    html += '</div>';
    html += '<label class="pd-due"><i class="ti ti-calendar-event"></i> Due <input type="date" class="pd-due-input" id="pd-due-input" value="' + escAttr(p.dueISO || '') + '"></label>';
    html += '</div>';

    /* Description */
    html += '<textarea class="pd-desc-input" id="pd-desc-input" placeholder="Add a description or notes for this project…">' + esc(p.desc || '') + '</textarea>';

    /* Sample banner — this project is illustrative and never lands on the calendar */
    if (p.sample) {
      html += '<div class="pd-sample-banner"><i class="ti ti-flask"></i><div class="pd-sample-banner-text"><div class="pd-sample-banner-title">This is a sample project</div><div class="pd-sample-banner-sub">Explore how sessions and subtasks work — it won’t be added to your calendar. Remove it whenever you’re ready to start your own.</div></div></div>';
    }

    /* Status row */
    html += '<div class="pd-status">';
    if (isUrgent(p)) {
      html += '<div class="pd-alert"><i class="ti ti-alert-triangle"></i><span>' + left + ' session' + (left !== 1 ? 's' : '') + ' left, ' + d + ' day' + (d !== 1 ? 's' : '') + ' to go.</span></div>';
    } else if (p.dueISO) {
      html += '<div class="pd-alert calm"><i class="ti ti-clock"></i><span>' + left + ' session' + (left !== 1 ? 's' : '') + ' left · due in ' + d + ' day' + (d !== 1 ? 's' : '') + '.</span></div>';
    } else {
      html += '<div class="pd-alert calm"><i class="ti ti-clock"></i><span>' + left + ' session' + (left !== 1 ? 's' : '') + ' left · no due date yet.</span></div>';
    }
    html += '<div class="pd-overall">';
    html += '<div class="pd-overall-head"><span>Overall</span><span>' + done + ' of ' + total + ' done</span></div>';
    html += '<div class="pd-overall-bar"><span class="pd-overall-fill" style="width:' + pct + '%"></span></div>';
    html += '</div>';
    html += '</div>';

    if (!p.dueISO) {
      /* No due date yet → planning is gated. Sessions are planned backward from the deadline. */
      html += '<div class="pd-nodue">';
      html += '<i class="ti ti-calendar-question pd-nodue-icon"></i>';
      html += '<div class="pd-nodue-text"><div class="pd-nodue-title">Set a due date to start planning</div>';
      html += '<div class="pd-nodue-sub">Sessions are scheduled working back from your deadline — pick the due date at the top right first.</div></div>';
      html += '</div>';
    } else {

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

    /* Approve footer — skipped for the sample so it never auto-places onto the calendar */
    var cleanPending = sessions.filter(function (s) { return !s.done && !s.conflict && !s.confirmed; }).length;
    if (cleanPending > 0 && !p.sample) {
      html += '<div class="pd-approve">';
      html += '<span class="pd-approve-text">One busy slot won’t block the rest — approve the clean sessions now.</span>';
      html += '<button class="pd-approve-btn" data-action="proj-approve">Approve ' + cleanPending + ' clean session' + (cleanPending !== 1 ? 's' : '') + ' <i class="ti ti-arrow-right"></i></button>';
      html += '</div>';
    }

    }   // end due-date gate

    /* Session-complete fork — shown right after you tick a session */
    if (sessionPrompt && sessionPrompt.projId === id && !p.completed) {
      html += '<div class="pd-fork">';
      if (sessionPrompt.all) {
        html += '<span class="pd-fork-text"><i class="ti ti-confetti"></i> All ' + total + ' sessions done — nice work!</span>';
      } else {
        html += '<span class="pd-fork-text">Nice — ' + done + ' of ' + total + ' done. Keep going, or wrap it up?</span>';
      }
      html += '<button class="pd-fork-btn" data-action="proj-complete">Complete project</button>';
      html += '<button class="pd-fork-dismiss" data-action="session-prompt-dismiss" aria-label="Dismiss"><i class="ti ti-x"></i></button>';
      html += '</div>';
    }

    /* Mark complete (or remove, for the sample) */
    if (p.sample) {
      html += '<button class="pd-complete-btn" data-action="proj-remove-sample"><i class="ti ti-trash"></i> Remove sample</button>';
      html += '<div class="pd-complete-hint">Clears the sample. Create your own project anytime with “New project”.</div>';
    } else {
      html += '<button class="pd-complete-btn" data-action="proj-complete"><i class="ti ti-circle-check"></i> Mark project complete</button>';
      html += '<div class="pd-complete-hint">Marks it done and clears any remaining sessions from your schedule.</div>';
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
      ch += '<div class="pd-conflict-note"><span class="pd-conflict-text">' + esc(s.conflict.note) + '</span><span class="pd-conflict-spacer"></span><span class="pd-conflict-assign" data-action="proj-assign-anyway" data-session="' + i + '">Assign anyway</span><span class="pd-conflict-pick" data-action="proj-pick-time" data-session="' + i + '">Pick a date &amp; time</span></div>';
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
    var subs = s.subtasks || [];
    var subMeta = subs.length ? ' · ' + subs.filter(function (x) { return x.done; }).length + '/' + subs.length + ' subtasks' : '';
    html += '<div class="pd-session-main">';
    html += '<div class="pd-session-title' + (s.done ? ' done' : ' pending') + '">' + esc(s.label || ('Session ' + (i + 1))) + (s.today ? ' <span class="pd-session-today">· today</span>' : '') + '</div>';
    html += '<div class="pd-session-meta">' + meta + subMeta + '</div>';
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

  /* Complete a project early: keep the done sessions, clear the rest off the schedule
     (confirmed-decision #4). Shared by the Mark-complete button, the Projects fork banner,
     and the Today-grid pill. */
  function completeProject(id) {
    updateProject(id, function (p) {
      var sessions = getSessions(p);
      p.sessions = sessions.filter(function (s) { return s.done; });
      p.total = p.sessions.length;
      p.done = p.sessions.length;
      p.completed = true;
      p.completedAt = Date.now();
    });
    sessionPrompt = null;
  }

  /* Bottom pill shown after completing a project session on the Today grid. */
  function sessionPill(projId) {
    var p = loadProjects().find(function (x) { return x.id === projId; });
    if (!p) return;
    var sessions = getSessions(p);
    var tot = sessions.length, dn = sessions.filter(function (s) { return s.done; }).length;
    var old = document.getElementById('pj-pill'); if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'pj-pill';
    el.className = 'notes-undo-toast';   // reuse the bottom-centre pill styling
    el.setAttribute('role', 'status');
    var label = (dn >= tot)
      ? '<span><i class="ti ti-confetti"></i> All ' + tot + ' sessions done · ' + esc(p.title) + '</span>'
      : '<span><i class="ti ti-check"></i> Session done — ' + dn + ' of ' + tot + ' · ' + esc(p.title) + '</span>';
    el.innerHTML = label + '<button data-action="pill-complete-project" data-project-id="' + escAttr(p.id) + '">Complete project</button>';
    document.body.appendChild(el);
    if (pjPillTimer) clearTimeout(pjPillTimer);
    pjPillTimer = setTimeout(function () { var e = document.getElementById('pj-pill'); if (e) e.remove(); pjPillTimer = null; }, 6000);
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

    // Editable session name — save on input without re-render so the caret is preserved.
    var titleInp = overlay.querySelector('.ls-title-input');
    if (titleInp) {
      titleInp.addEventListener('input', function () {
        var projects = loadProjects();
        var pp = projects.find(function (x) { return x.id === LC.get('projOpen'); });
        if (!pp) return;
        var ss = getSessions(pp); pp.sessions = ss;
        var sess = ss[LC.get('sessionOpen')];
        if (sess) { sess.label = titleInp.value; saveProjects(projects); }
      });
    }

    var subInp = overlay.querySelector('.ls-sub-input');
    if (subInp) {
      subInp.focus();
      subInp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commitSubtask(subInp.value); }
        if (e.key === 'Escape') { subAdding = false; render(); }
      });
      subInp.addEventListener('blur', function () { commitSubtask(subInp.value); });
    }

    // Persist session notes on input (no re-render) so an external re-render never drops unsaved text.
    var notesTa = overlay.querySelector('.ls-notes-input');
    if (notesTa) {
      notesTa.addEventListener('input', function () {
        var projects = loadProjects();
        var pp = projects.find(function (x) { return x.id === LC.get('projOpen'); });
        if (!pp) return;
        var ss = getSessions(pp); pp.sessions = ss;
        var sess = ss[LC.get('sessionOpen')];
        if (sess) { sess.notes = notesTa.value; saveProjects(projects); }
      });
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
    h += '<div class="ls-titlemain"><input class="ls-title-input serif" id="ls-title-input" value="' + escAttr(s.label || '') + '" placeholder="' + escAttr('Session ' + (idx + 1)) + '"><div class="ls-title-hint">Optional — name what this session is for (e.g. “Car wash”)</div></div>';
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

    /* Shares-this-slot warning (allowed under the 3-item cap, but shown so nothing lands blind) */
    if (s.date && s.startMin != null) {
      var clashes = sessionOverlaps(s.date, s.startMin, s.durationMin || 60, p.id, idx);
      if (clashes.length) {
        h += '<div class="ls-conflict-warn"><div class="ls-conflict-head"><i class="ti ti-alert-triangle"></i> Shares this time slot with:</div>';
        clashes.forEach(function (c) { h += '<div class="ls-conflict-item">' + esc(c) + '</div>'; });
        h += '</div>';
      }
    }

    /* Start focus */
    h += '<button class="ls-focus-btn" data-action="session-start-focus"><i class="ti ti-player-play"></i> Start focus · ' + fmtDurShort(durMin) + '</button>';

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
      sessionPrompt = null;
      LC.set({ projOpen: action.dataset.projectId });
      return;
    }

    if (a === 'new-project' || a === 'proj-template') {
      var projects = loadProjects().filter(function (p) { return !p.sample; });   // a real project retires the sample
      var np = { id: 'p' + Date.now(), title: a === 'proj-template' ? action.dataset.title : 'New project', total: 4, done: 0, daysToGo: 999, urgent: false, due: '', desc: '', plan: defaultPlan({ total: 4 }), sessions: [] };
      projects.push(np);
      saveProjects(projects);
      sessionPrompt = null;
      LC.set({ projOpen: np.id });
      return;
    }

    if (a === 'proj-sample') {
      var sprojects = loadProjects().filter(function (p) { return !p.sample; });
      var sdue = shiftISO(todayISO(), 21);
      sprojects.push({
        id: 'p_sample', sample: true, title: 'Read “Atomic Habits”', kind: 'Reading',
        total: 4, done: 0, dueISO: sdue, dueFull: fmtDue(sdue),
        desc: 'A gentle example — explore how sessions work, then remove it whenever.',
        plan: { count: 4, dayFlags: [true, false, true, false, true, false, false], start: '4:00 PM', length: '1h' },
        sessions: [
          { label: 'Read part 1', done: false, subtasks: [{ label: 'Chapters 1–2', done: false }, { label: 'Jot down notes', done: false }] },
          { label: 'Read part 2', done: false, subtasks: [{ label: 'Chapters 3–4', done: false }] },
          { label: 'Read part 3', done: false, subtasks: [{ label: 'Chapters 5–6', done: false }] },
          { label: 'Finish + reflect', done: false, subtasks: [{ label: 'Last chapters', done: false }, { label: 'Write 3 takeaways', done: false }] }
        ]
      });
      saveProjects(sprojects);
      sessionPrompt = null;
      LC.set({ projOpen: 'p_sample' });
      return;
    }
    if (a === 'proj-remove-sample') {
      saveProjects(loadProjects().filter(function (p) { return !p.sample; }));
      LC.set({ projOpen: null });
      return;
    }

    if (a === 'open-completed') { completedOpen = !completedOpen; render(); return; }

    if (a === 'proj-complete') {
      completeProject(LC.get('projOpen'));
      LC.set({ projOpen: null });   // back to the list; it moves under Completed
      return;
    }
    if (a === 'session-prompt-dismiss') { sessionPrompt = null; render(); return; }
    if (a === 'pill-complete-project') {
      var pcp = document.getElementById('pj-pill'); if (pcp) pcp.remove();
      completeProject(action.dataset.projectId);
      LC.set({});   // notify every surface (Today grid / calendar) that the sessions changed
      return;
    }

    if (a === 'proj-reopen') {
      var rid = action.dataset.projectId;
      updateProject(rid, function (p) { p.completed = false; delete p.completedAt; });
      return;
    }

    if (a === 'toggle-session') {
      var sid = parseInt(action.dataset.session, 10);
      var tsPid = LC.get('projOpen');
      var became = false, tsRemaining = 0;
      updateProject(tsPid, function (p) {
        var sessions = getSessions(p);
        p.sessions = sessions;
        if (sessions[sid]) { sessions[sid].done = !sessions[sid].done; became = sessions[sid].done; }
        p.done = sessions.filter(function (s) { return s.done; }).length;
        p.total = sessions.length;
        tsRemaining = p.total - p.done;
      });
      // completing a session surfaces the "keep going / complete project" fork; un-checking clears it
      if (became) { sessionPrompt = { projId: tsPid, all: tsRemaining === 0 }; render(); }
      else if (sessionPrompt && sessionPrompt.projId === tsPid) { sessionPrompt = null; render(); }
      return;
    }

    if (a === 'proj-sessions-plus' || a === 'proj-add-session') {
      updateProject(LC.get('projOpen'), function (p) {
        var sessions = getSessions(p);
        p.sessions = sessions;
        if (sessions.length >= 50) { sessToast('50 sessions is the limit for one project'); return; }
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
        if (sessions.length > 1) {
          // don't silently destroy a session that carries real data — remove the last EMPTY one instead
          var hasData = function (s) { return s.done || s.date || (s.notes && s.notes.trim()) || (s.subtasks && s.subtasks.length); };
          var removeIdx = -1;
          for (var i = sessions.length - 1; i >= 0; i--) { if (!hasData(sessions[i])) { removeIdx = i; break; } }
          if (removeIdx >= 0) sessions.splice(removeIdx, 1);   // else: all sessions have content → leave them (open a session to delete it)
        }
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
            if (p.dueISO && ds > p.dueISO) return null;   // never plan a session past the deadline
            if ((!allowed.length || allowed.indexOf(cursor.getDay()) >= 0) && !used[ds]
                && !sessionBlock(ds, startMin, durMin, null, null)) {   // honor locked routines + the 3-overlap rule
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
          if (s.date) s.confirmed = true;               // only confirm sessions that actually got a date
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
      // Save with a date but no time → keep the displayed defaults so it lands on the calendar.
      updateSession(function (s) {
        if (s.date && s.startMin == null) { s.startMin = 960; s.durationMin = s.durationMin || 60; }
      });
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
      updateSession(function (s, p) {
        var start = s.startMin != null ? s.startMin : 960;
        var nd = Math.max(15, Math.min(19 * 60 - start, (s.durationMin || 60) + dd));  // keep end within the grid
        var err = dd > 0 ? sessionBlock(s.date, start, nd, p.id, LC.get('sessionOpen')) : null;  // growing can collide; shrinking can't
        if (err) { sessToast(err); return; }
        s.durationMin = nd;
      });
      return;
    }

    if (a === 'session-start-minus' || a === 'session-start-plus') {
      var st = a === 'session-start-plus' ? 15 : -15;
      updateSession(function (s, p) {
        var d = s.durationMin || 60;
        var ns = Math.max(7 * 60, Math.min(19 * 60 - d, (s.startMin != null ? s.startMin : 960) + st));  // keep within the 7–19 grid so it stays visible
        var err = sessionBlock(s.date, ns, d, p.id, LC.get('sessionOpen'));
        if (err) { sessToast(err); return; }
        s.startMin = ns;
      });
      return;
    }

    if (a === 'session-date-prev' || a === 'session-date-next') {
      var dir = a === 'session-date-next' ? 1 : -1;
      updateSession(function (s, p) {
        var nd2 = shiftISO(s.date, dir);
        // Materialize the drawer's displayed defaults (4:00 PM · 1h) the moment a date is
        // chosen — otherwise the session has a date but no time and never shows anywhere.
        var effStart = s.startMin != null ? s.startMin : 960;
        var effDur = s.durationMin || 60;
        var err = sessionBlock(nd2, effStart, effDur, p.id, LC.get('sessionOpen'));
        if (err) { sessToast(err); return; }
        s.date = nd2; s.dateLabel = fmtSessionDate(nd2);
        if (s.startMin == null) s.startMin = effStart;
        if (s.durationMin == null) s.durationMin = effDur;
      });
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
      updateSession(function (s) { delete s.date; s.dateLabel = ''; s.startMin = null; s.timeLabel = ''; delete s.confirmed; });  // clear date too so Year view stops counting it
      LC.set({ sessionOpen: null });
      return;
    }

    if (a === 'session-start-focus') {
      saveSessionNotes();
      // the session's length IS the timer length; hard-reset so an abandoned paused run
      // with the same duration can't leak through
      if (window.LC_Focus && LC_Focus.reset) LC_Focus.reset();
      var sfP = loadProjects().find(function (x) { return x.id === LC.get('projOpen'); });
      var sfS = sfP ? getSessions(sfP)[LC.get('sessionOpen')] : null;
      LC.set({ sessionOpen: null, screen: 'focus', focusCustomMin: (sfS && sfS.durationMin) || 60, focusTaskId: null, focusDone: false, focusRunning: false });
      return;
    }

    if (a === 'add-dump-go') { addDumpFromInput(); return; }

    if (a === 'dump-type') {
      var inp = document.getElementById('bd-input-field');
      if (inp) dumpDraft = inp.value;            // preserve typed text across the re-render
      dumpType = action.dataset.type;
      render();
      var f = document.getElementById('bd-input-field');
      if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
      return;
    }

    /* ── Readiness chips → explicit checkmark commit ── */
    function dumpItem() {
      var arr = loadDump();
      var it = arr.find(function (i) { return i.id === action.dataset.dumpId; });
      return it ? { items: arr, it: it } : null;
    }

    if (a === 'dump-check') {
      var dc = dumpItem(); if (!dc) return;
      if (dumpReady(dc.it)) {
        if (dc.it.pDate < todayISO()) {           // a stale captured date has since passed → re-pick, don't schedule into the past
          dumpPick = { id: dc.it.id, kind: 'date', month: null };
          sessToast('That date has passed — pick a new one');
          render();
          return;
        }
        if (scheduleDumpItem(dc.it, dc.items)) { dumpPick = null; dumpConf = null; }
        render();
      } else {
        dumpPick = null; dumpPulse = dc.it.id; render();
        setTimeout(function () { dumpPulse = null; render(); }, 700);
      }
      return;
    }
    if (a === 'dump-recycle') { recycleDumpItem(action.dataset.dumpId); return; }

    if (a === 'dump-del') { dumpConf = action.dataset.dumpId; dumpPick = null; render(); return; }
    if (a === 'dump-del-yes') {
      var dy = action.dataset.dumpId;
      if (dumpGrace[dy]) { clearTimeout(dumpGrace[dy]); delete dumpGrace[dy]; }
      saveDump(loadDump().filter(function (i) { return i.id !== dy; }));
      dumpConf = null; render();
      return;
    }
    if (a === 'dump-del-no') { dumpConf = null; render(); return; }

    if (a === 'dump-pick') {
      var pkId = action.dataset.dumpId, pkKind = action.dataset.kind;
      if (dumpPick && dumpPick.id === pkId && dumpPick.kind === pkKind) dumpPick = null;
      else dumpPick = { id: pkId, kind: pkKind, month: null };
      dumpConf = null; render();
      return;
    }
    if (a === 'dump-setdate') {
      var sd = dumpItem(); if (!sd) return;
      sd.it.pDate = action.dataset.date; delete sd.it.pBlocked;
      saveDump(sd.items); dumpPick = null; render();
      return;
    }
    if (a === 'dump-settime') {
      var stt = dumpItem(); if (!stt) return;
      stt.it.pStart = parseInt(action.dataset.min, 10); delete stt.it.pBlocked;
      saveDump(stt.items); dumpPick = null; render();
      return;
    }
    if (a === 'dump-setdur') {
      var su = dumpItem(); if (!su) return;
      su.it.pDur = parseInt(action.dataset.min, 10); delete su.it.pBlocked;
      saveDump(su.items); dumpPick = null; render();
      return;
    }
    if (a === 'dump-month') {
      if (!dumpPick) return;
      var dm = dumpItem();
      var anchor = dumpPick.month || (dm && dm.it.pDate) || todayISO();
      var mp = anchor.split('-'); var mdt = new Date(+mp[0], +mp[1] - 1 + parseInt(action.dataset.dir, 10), 1);
      dumpPick.month = mdt.getFullYear() + '-' + two(mdt.getMonth() + 1) + '-01';
      render();
      return;
    }

    if (a === 'toggle-dump-sort') {
      dumpSort = dumpSort === 'newest' ? 'oldest' : 'newest';
      render();
      return;
    }

    /* ── History / Carried over ── */
    if (a === 'toggle-history') { histOpen = !histOpen; render(); return; }
    if (a === 'hist-unschedule') { unscheduleDumpItem(action.dataset.dumpId); return; }
    if (a === 'hist-edit') {
      var het = (LC.loadData('tasks') || []).find(function (t) { return t.id === action.dataset.taskId; });
      if (!het) return;
      var hToday = todayISO();
      LC.set({ screen: 'today', dayAnchor: (het.date && het.date !== hToday) ? het.date : null, editor: het.id, sessionOpen: null, projOpen: null });
      return;
    }
    if (a === 'carry-to-today') {
      var tasks3 = LC.loadData('tasks') || [];
      var ct3 = tasks3.find(function (t) { return t.id === action.dataset.taskId; });
      if (!ct3) return;
      // keep its old time if the slot is free today; otherwise the toast explains
      var startC = ct3.startMin != null ? ct3.startMin : 540;
      var blockedC = sessionBlock(todayISO(), startC, ct3.duration || 60, null, null);
      if (blockedC) { sessToast(blockedC); return; }
      ct3.date = todayISO();
      LC.saveData('tasks', tasks3);
      render();
      return;
    }
  });

  /* Esc closes the session drawer (same save path as the X button). Skips the subtask
     input, whose own Esc handler just cancels the inline add. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (e.target.closest && e.target.closest('.ls-sub-input')) return;
    if (LC.get('projOpen') && LC.get('sessionOpen') != null) {
      saveSessionNotes();
      subAdding = false;
      LC.set({ sessionOpen: null });
    }
  });

  LC.on(render);
  window.LC_BrainDump = { render: render, sessionPill: sessionPill };
})();

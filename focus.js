/* ══════════════════════════════════════════
   Luclaro — Focus Timer
   One timer. The time comes from the work: attach a task and the timer is the
   task's length; otherwise pick a preset (25 = the classic sprint) or fine-tune.
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var timerInterval = null;
  var remainingSec = 0;
  var totalSec = 0;
  var started = false;    // a run began and hasn't been reset/completed (paused ≠ fresh)
  var lastMin = null;     // detect external duration changes (e.g. session "Start focus")

  /* Ad-hoc focus: a session-only title + checklist that never touches the Day view. */
  var adhocTitle = '';
  var adhocItems = [];
  var adhocAdding = false;
  var adhocNameDraft = '';   // half-typed name/step survive external re-renders (sync/heartbeat)
  var adhocStepDraft = '';

  var PRESETS = [15, 25, 45, 60];

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

  /* ── Task data (shared store with Today) ── */
  function loadTasks() { var v = LC.loadData('tasks'); return Array.isArray(v) ? v : []; }
  function saveTasks(arr) { LC.saveData('tasks', arr); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function todaysTasks() {
    return loadTasks().filter(function (t) { return t.date === todayStr() && t.type !== 'event' && !t.done; })
      .sort(function (a, b) { return (a.startMin || 0) - (b.startMin || 0); });
  }
  function attachedTask() {
    var id = LC.get('focusTaskId');
    if (!id) return null;
    return loadTasks().find(function (t) { return t.id === id; }) || null;
  }
  function minutes() { return LC.get('focusCustomMin') || 25; }

  /* ── Gentle chime on completion (self-contained WebAudio, no asset) ── */
  function chime() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ac = new Ctx();
      [0, 0.18].forEach(function (t, i) {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = i === 0 ? 660 : 880;
        o.connect(g); g.connect(ac.destination);
        var s = ac.currentTime + t;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.15, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.4);
        o.start(s); o.stop(s + 0.42);
      });
    } catch (e) {}
  }

  function render() {
    if (LC.get('screen') !== 'focus') return;
    var el = document.getElementById('screen-focus');
    var running = LC.get('focusRunning');
    var done = LC.get('focusDone');
    var mins = minutes();

    // duration changed from outside (preset click re-render, session Start focus) → fresh timer
    if (!running && lastMin !== mins) { started = false; lastMin = mins; }

    if (done) { adhocAdding = false; adhocStepDraft = ''; }   // completion closes any half-open step input

    totalSec = mins * 60;
    if (!running && timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (!running && !done && !started) remainingSec = totalSec;

    var pct = totalSec > 0 ? ((totalSec - remainingSec) / totalSec) : 0;
    if (done) pct = 1;
    var deg = Math.round(pct * 360);

    var displayMin = Math.floor(remainingSec / 60);
    var displaySec = remainingSec % 60;
    var timeStr = done ? '✓' : displayMin + ':' + String(displaySec).padStart(2, '0');
    var subText = done ? 'complete' : (running ? 'remaining' : (started ? 'paused' : 'focus timer'));

    var ringBg = 'conic-gradient(var(--accent) ' + deg + 'deg, var(--line) ' + deg + 'deg)';

    var html = '<div class="focus-wrap">';

    /* ── Left: the one timer ── */
    html += '<div class="focus-left">';
    html += '<div class="focus-ring" style="background:' + ringBg + '">';
    html += '<div class="focus-ring-inner">';
    html += '<div class="focus-time serif">' + timeStr + '</div>';
    html += '<div class="focus-sub">' + subText + '</div>';
    html += '</div></div>';

    /* duration: presets + fine-tune — only when TRULY idle (a paused run keeps its progress;
       changing the duration then would silently discard it) */
    if (!running && !done && !started) {
      html += '<div class="focus-presets">';
      PRESETS.forEach(function (p) {
        html += '<button class="focus-preset' + (mins === p ? ' active' : '') + '" data-action="focus-preset" data-min="' + p + '">' + LC.fmtDur(p) + '</button>';
      });
      html += '</div>';
      html += '<div class="focus-stepper">';
      html += '<button class="focus-step-btn" data-action="focus-minus">−</button>';
      html += '<span class="focus-step-val">' + mins + ' min</span>';
      html += '<button class="focus-step-btn" data-action="focus-plus">+</button>';
      html += '</div>';
    }

    var icon = running ? 'ti-player-pause' : 'ti-player-play';
    html += '<button class="focus-play" data-action="focus-toggle" aria-label="' + (running ? 'Pause' : 'Start') + '"><i class="ti ' + icon + '"></i></button>';
    html += '</div>';

    /* ── Right: what you're working on ── */
    html += '<div class="focus-right">';
    html += renderRight(done);
    html += '</div>';

    html += '</div>';
    el.innerHTML = html;
    attachInputs();
  }

  function renderRight(done) {
    var task = attachedTask();

    /* Completion */
    if (done) {
      var h = '<span class="focus-nontask-icon"><i class="ti ti-circle-check-filled" style="color:var(--accent)"></i></span>';
      h += '<div class="focus-nontask-title serif">Nice work — that\'s a wrap.</div>';
      if (task) {
        h += '<div class="focus-nontask-desc">You focused on <strong>' + esc(task.title || 'Untitled') + '</strong>. Mark it done?</div>';
        if (!task.done) h += '<button class="focus-pick-btn" data-action="focus-mark-done"><i class="ti ti-check"></i> Mark task done</button>';
        else h += '<div class="focus-task-meta">Marked done ✓</div>';
      } else if (adhocTitle) {
        h += '<div class="focus-nontask-desc">You focused on <strong>' + esc(adhocTitle) + '</strong>.</div>';
      } else {
        h += '<div class="focus-nontask-desc">The timer finished.</div>';
      }
      h += '<button class="focus-pick-btn focus-reset-btn" data-action="focus-reset"><i class="ti ti-rotate"></i> Start another</button>';
      return h;
    }

    /* Attached real task → its details, timer already matches its length */
    if (task) {
      var meta = task.startMin != null ? (LC.fmtTime(task.startMin) + ' – ' + LC.fmtTime(task.startMin + (task.duration || 60))) : 'Today';
      var t = '<div class="focus-task-head"><div class="focus-task-label">Now working</div><button class="focus-change-btn" data-action="focus-clear-task">Change</button></div>';
      t += '<div class="focus-task-title serif">' + esc(task.title || 'Untitled') + '</div>';
      t += '<div class="focus-task-meta">' + meta + ' · timer set to ' + LC.fmtDur(minutes()) + '</div>';
      var subs = task.subtasks || [];
      t += '<div class="focus-subtask-label">Subtasks</div>';
      if (subs.length === 0) {
        t += '<div class="focus-subtask-empty">No subtasks on this task.</div>';
      } else {
        t += '<div class="focus-subtasks">';
        subs.forEach(function (s, i) {
          t += '<div class="focus-sub-row' + (s.done ? ' done' : '') + '" data-action="focus-sub-toggle" data-sub="' + i + '">';
          t += '<i class="ti ' + (s.done ? 'ti-square-rounded-check-filled' : 'ti-square-rounded') + '"></i>';
          t += '<span class="focus-sub-text">' + esc(s.label) + '</span></div>';
        });
        t += '</div>';
      }
      if (!task.done) t += '<button class="focus-pick-btn focus-markdone-inline" data-action="focus-mark-done"><i class="ti ti-check"></i> Mark task done</button>';
      else t += '<div class="focus-task-meta focus-done-note">Done ✓</div>';
      return t;
    }

    /* Ad-hoc focus (named, session-only — never touches the Day view) */
    if (adhocTitle) {
      var a = '<div class="focus-task-head"><div class="focus-task-label">Now working</div><button class="focus-change-btn" data-action="adhoc-clear">Change</button></div>';
      a += '<div class="focus-task-title serif">' + esc(adhocTitle) + '</div>';
      a += '<div class="focus-task-meta">Just this session — not on your day</div>';
      a += '<div class="focus-subtask-label">Checklist</div>';
      if (adhocItems.length === 0 && !adhocAdding) {
        a += '<div class="focus-subtask-empty">Add steps if it helps — or just start.</div>';
      } else {
        a += '<div class="focus-subtasks">';
        adhocItems.forEach(function (s, i) {
          a += '<div class="focus-sub-row' + (s.done ? ' done' : '') + '" data-action="adhoc-toggle" data-sub="' + i + '">';
          a += '<i class="ti ' + (s.done ? 'ti-square-rounded-check-filled' : 'ti-square-rounded') + '"></i>';
          a += '<span class="focus-sub-text">' + esc(s.label) + '</span></div>';
        });
        a += '</div>';
      }
      if (adhocAdding) {
        a += '<div class="ls-sub-add-row"><i class="ti ti-square-rounded"></i><input class="ls-sub-input focus-adhoc-input" type="text" placeholder="New step" value="' + escAttr(adhocStepDraft) + '"></div>';
      } else {
        a += '<button class="ls-add-sub" data-action="adhoc-add"><i class="ti ti-plus"></i> Add a step</button>';
      }
      return a;
    }

    /* Nothing chosen yet → pick a task, or just name the work */
    var p = '<div class="focus-task-label">What are you working on?</div>';
    var list = todaysTasks();
    if (list.length > 0) {
      p += '<div class="focus-picker">';
      list.forEach(function (t2) {
        var sc = (t2.subtasks || []).length;
        var doneC = (t2.subtasks || []).filter(function (s) { return s.done; }).length;
        p += '<button class="focus-pick-row" data-action="focus-attach" data-task-id="' + escAttr(t2.id) + '">';
        p += '<span class="focus-pick-bar"></span>';
        p += '<span class="focus-pick-main"><span class="focus-pick-title">' + esc(t2.title || 'Untitled') + '</span>';
        p += '<span class="focus-pick-meta">' + (t2.startMin != null ? LC.fmtTime(t2.startMin) : 'Today') + ' · ' + LC.fmtDur(t2.duration || 60) + (sc ? ' · ' + doneC + '/' + sc + ' subtasks' : '') + '</span></span>';
        p += '<i class="ti ti-chevron-right focus-pick-chev"></i>';
        p += '</button>';
      });
      p += '</div>';
      p += '<div class="focus-divider"><span>or</span></div>';
    } else {
      p += '<div class="focus-subtask-empty" style="margin-bottom:14px">Nothing on today\'s plan — name what you\'re working on, or just start the clock.</div>';
    }
    p += '<div class="focus-adhoc-row"><i class="ti ti-pencil"></i><input class="focus-adhoc-name" id="focus-adhoc-name" type="text" placeholder="Just name it — stays off your day view" autocomplete="off" value="' + escAttr(adhocNameDraft) + '"></div>';
    return p;
  }

  function attachInputs() {
    var name = document.getElementById('focus-adhoc-name');
    if (name) {
      name.addEventListener('input', function () { adhocNameDraft = name.value; });   // survive external re-renders
      name.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var v = name.value.trim();
          if (v) { adhocTitle = v; adhocItems = []; adhocAdding = false; adhocNameDraft = ''; LC.set({ focusTaskId: null, focusDone: false }); }
        }
      });
    }
    var step = document.querySelector('.focus-adhoc-input');
    if (step) {
      step.focus();
      if (adhocStepDraft) step.setSelectionRange(step.value.length, step.value.length);
      step.addEventListener('input', function () { adhocStepDraft = step.value; });   // survive external re-renders
      var commit = function () {
        if (!adhocAdding) return;   // Enter triggers render → detached input blurs → don't add twice
        adhocAdding = false;
        adhocStepDraft = '';
        var v = step.value.trim();
        if (v) adhocItems.push({ label: v, done: false });
        render();
      };
      step.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { adhocAdding = false; adhocStepDraft = ''; render(); }
      });
      step.addEventListener('blur', commit);
    }
  }

  /* Per-second clock update WITHOUT rebuilding the screen — a full re-render every tick
     would wipe anything being typed (e.g. a half-entered checklist step). */
  function updateClock() {
    var ring = document.querySelector('#screen-focus .focus-ring');
    var time = document.querySelector('#screen-focus .focus-time');
    if (!ring || !time) { render(); return; }
    var pct = totalSec > 0 ? ((totalSec - remainingSec) / totalSec) : 0;
    var deg = Math.round(pct * 360);
    ring.style.background = 'conic-gradient(var(--accent) ' + deg + 'deg, var(--line) ' + deg + 'deg)';
    time.textContent = Math.floor(remainingSec / 60) + ':' + String(remainingSec % 60).padStart(2, '0');
  }

  function startTimer() {
    timerInterval = setInterval(function () {
      // Navigated away → pause cleanly (no leaked interval, no background chime).
      if (LC.get('screen') !== 'focus') {
        clearInterval(timerInterval); timerInterval = null;
        LC.set({ focusRunning: false });
        return;
      }
      if (remainingSec <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        started = false;
        chime();
        LC.set({ focusRunning: false, focusDone: true });
        return;
      }
      remainingSec--;
      updateClock();
    }, 1000);
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    var action = e.target.closest('[data-action]');
    if (!action) return;
    var a = action.dataset.action;

    if (a === 'focus-toggle') {
      if (LC.get('focusRunning')) {
        clearInterval(timerInterval);
        timerInterval = null;
        LC.set({ focusRunning: false });   // pause: `started` stays true, remainingSec preserved
      } else {
        var full = minutes() * 60;
        totalSec = full;
        if (!(started && remainingSec > 0 && remainingSec < full)) remainingSec = full;   // resume vs fresh
        started = true;
        LC.set({ focusRunning: true, focusDone: false });
        startTimer();
      }
      return;
    }

    if (a === 'focus-preset') {
      if (LC.get('focusRunning')) return;
      started = false;
      LC.set({ focusCustomMin: parseInt(action.dataset.min, 10), focusDone: false });
      return;
    }

    if (a === 'focus-minus' || a === 'focus-plus') {
      if (LC.get('focusRunning')) return;
      var m = minutes();
      started = false;
      LC.set({ focusCustomMin: a === 'focus-plus' ? Math.min(240, m + 5) : Math.max(5, m - 5), focusDone: false });
      return;
    }

    if (a === 'focus-attach') {
      // attaching new work ends any current run — otherwise totalSec and remainingSec diverge
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      var t = loadTasks().find(function (x) { return x.id === action.dataset.taskId; });
      adhocTitle = ''; adhocItems = []; adhocAdding = false; adhocNameDraft = ''; adhocStepDraft = '';
      started = false;
      LC.set({ focusTaskId: action.dataset.taskId, focusCustomMin: (t && t.duration) || 60, focusDone: false, focusRunning: false });
      return;
    }

    if (a === 'focus-clear-task') {
      LC.set({ focusTaskId: null });
      return;
    }

    if (a === 'adhoc-clear') { adhocTitle = ''; adhocItems = []; adhocAdding = false; adhocNameDraft = ''; adhocStepDraft = ''; render(); return; }
    if (a === 'adhoc-add') { adhocAdding = true; render(); return; }
    if (a === 'adhoc-toggle') {
      var ai = parseInt(action.dataset.sub, 10);
      if (adhocItems[ai]) { adhocItems[ai].done = !adhocItems[ai].done; render(); }
      return;
    }

    if (a === 'focus-sub-toggle') {
      var idx = parseInt(action.dataset.sub, 10);
      var id = LC.get('focusTaskId');
      var tasks = loadTasks();
      var tk = tasks.find(function (x) { return x.id === id; });
      if (tk && tk.subtasks && tk.subtasks[idx]) {
        tk.subtasks[idx].done = !tk.subtasks[idx].done;
        saveTasks(tasks);
        render();
      }
      return;
    }

    if (a === 'focus-mark-done') {
      var fid = LC.get('focusTaskId');
      var ts = loadTasks();
      var ft = ts.find(function (x) { return x.id === fid; });
      if (ft) { ft.done = true; saveTasks(ts); render(); }
      return;
    }

    if (a === 'focus-reset') {
      remainingSec = 0; started = false;
      adhocItems.forEach(function (s) { s.done = false; });
      LC.set({ focusDone: false, focusRunning: false });
      return;
    }
  });

  /* Hard reset for external entry points (e.g. a session's "Start focus"): guarantees a
     fresh timer even when the new duration equals a paused run's (lastMin can't see that). */
  function reset() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    started = false;
    remainingSec = 0;
  }

  LC.on(render);
  window.LC_Focus = { render: render, reset: reset };
})();

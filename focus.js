/* ══════════════════════════════════════════
   Luclaro — Focus Timer
   Wall-clock engine: survives navigation and refresh (clarity_focus_active),
   floating mini timer everywhere, Task mode counts down the task's time.
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var SKEY = 'focus_active';

  /* The active session — single source of truth. Null when idle.
     { mode:'sprint'|'task'|'custom', taskId, totalSec,
       running, endsAt (ms, when running), remainSec (when paused), done } */
  var session = null;
  var ticker = null;

  var MODES = {
    sprint: { label: 'Sprint' },
    task:   { label: 'Task' },
    custom: { label: 'Custom' },
  };

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* ── Task data (shared store with Today) ── */
  function loadTasks() { return LC.loadData('tasks') || []; }
  function saveTasks(arr) { LC.saveData('tasks', arr); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function nowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function todaysTasks() {
    return loadTasks().filter(function (t) { return t.date === todayStr() && t.type !== 'event'; })
      .sort(function (a, b) { return (a.startMin || 0) - (b.startMin || 0); });
  }
  function attachedTask() {
    var id = LC.get('focusTaskId');
    if (!id) return null;
    return loadTasks().find(function (t) { return t.id === id; }) || null;
  }

  /* Smart duration for Task mode: if the task is in progress right now,
     focus on what's LEFT of it; otherwise its full duration. Min 5 minutes. */
  function taskFocusSec(t) {
    var durMin = t.duration || 30;
    if (t.date === todayStr() && t.startMin != null) {
      var n = nowMin();
      if (n >= t.startMin && n < t.startMin + durMin) durMin = Math.max(5, t.startMin + durMin - n);
    }
    return Math.max(5, durMin) * 60;
  }

  /* ── Persistence: written on state CHANGES only (endsAt makes ticks free) ── */
  function persist() { LC.saveData(SKEY_safe(), session); }
  function SKEY_safe() { return SKEY; }
  function remaining() {
    if (!session) return 0;
    if (session.done) return 0;
    if (session.running) return Math.max(0, Math.round((session.endsAt - Date.now()) / 1000));
    return session.remainSec || 0;
  }
  function mirror() {
    /* Keep the LC ui-state flags truthful for anything else that reads them. */
    LC.set({
      focusRunning: !!(session && session.running),
      focusDone: !!(session && session.done),
      focusMode: session ? session.mode : LC.get('focusMode'),
      focusTaskId: session && session.taskId != null ? session.taskId : LC.get('focusTaskId'),
    });
  }

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

  /* ── Engine ── */
  function ensureTicker() {
    if (ticker) return;
    ticker = setInterval(function () {
      if (!session || !session.running) { clearInterval(ticker); ticker = null; updateMini(); return; }
      if (remaining() <= 0) {
        session.running = false;
        session.done = true;
        session.remainSec = 0;
        persist();
        chime();
        mirror();          // triggers a full re-render everywhere
        updateMini();
        return;
      }
      if (LC.get('screen') === 'focus') render();
      updateMini();
    }, 1000);
  }

  function startSession(mode, taskId, totalSec) {
    session = { mode: mode, taskId: taskId || null, totalSec: totalSec, running: true, endsAt: Date.now() + totalSec * 1000, remainSec: totalSec, done: false };
    persist();
    ensureTicker();
    mirror();
    updateMini();
  }

  function pauseSession() {
    if (!session || !session.running) return;
    session.remainSec = remaining();
    session.running = false;
    persist(); mirror(); updateMini();
  }

  function resumeSession() {
    if (!session || session.running || session.done) return;
    if (session.remainSec <= 0) session.remainSec = session.totalSec;
    session.endsAt = Date.now() + session.remainSec * 1000;
    session.running = true;
    persist(); ensureTicker(); mirror(); updateMini();
  }

  function endSession() {
    session = null;
    persist();
    LC.set({ focusRunning: false, focusDone: false });
    updateMini();
  }

  /* Public: one-tap focus from a Today card. Stays on the current screen;
     the mini timer carries the session. */
  function startForTask(taskId) {
    var t = loadTasks().find(function (x) { return x.id === taskId; });
    if (!t) return;
    LC.set({ focusMode: 'task', focusTaskId: taskId });
    startSession('task', taskId, taskFocusSec(t));
    var until = new Date(Date.now() + session.totalSec * 1000);
    var untilMin = until.getHours() * 60 + until.getMinutes();
    if (window.LC_Today && LC_Today.showToast) LC_Today.showToast('Focusing on "' + (t.title || 'Untitled') + '" until ' + LC.fmtTime(untilMin));
  }

  /* ── Mini timer pill (floats everywhere except the Focus screen) ── */
  var miniEl = null;
  function updateMini() {
    if (!miniEl) {
      miniEl = document.createElement('div');
      miniEl.id = 'focus-mini';
      miniEl.setAttribute('role', 'status');
      document.body.appendChild(miniEl);
    }
    var show = session && !session.done && LC.get('screen') !== 'focus';
    if (!show) { miniEl.className = ''; miniEl.innerHTML = ''; return; }
    var r = remaining();
    var timeStr = Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0');
    var task = session.taskId ? loadTasks().find(function (x) { return x.id === session.taskId; }) : null;
    var label = task ? esc(task.title || 'Untitled') : MODES[session.mode].label;
    miniEl.className = 'on';
    miniEl.innerHTML = '<button class="focus-mini-body" data-action="focus-mini-open"><b>' + timeStr + '</b><span>' + label + '</span></button>'
      + '<button class="focus-mini-btn" data-action="focus-mini-toggle" aria-label="Pause or resume"><i class="ti ' + (session.running ? 'ti-player-pause-filled' : 'ti-player-play-filled') + '"></i></button>';
  }

  /* ── Focus screen ── */
  function render() {
    updateMini();
    if (LC.get('screen') !== 'focus') return;
    var el = document.getElementById('screen-focus');
    var mode = session ? session.mode : LC.get('focusMode');
    var customMin = LC.get('focusCustomMin') || 25;
    var done = !!(session && session.done);
    var running = !!(session && session.running);
    var paused = !!(session && !session.running && !session.done);

    var totalSec, remainSec;
    if (session) {
      totalSec = session.totalSec;
      remainSec = remaining();
    } else {
      /* idle preview of what would start */
      if (mode === 'sprint') totalSec = 25 * 60;
      else if (mode === 'custom') totalSec = customMin * 60;
      else { var pt = attachedTask(); totalSec = pt ? taskFocusSec(pt) : 0; }
      remainSec = totalSec;
    }

    var pct = totalSec > 0 ? ((totalSec - remainSec) / totalSec) : 0;
    if (done) pct = 1;
    var deg = Math.round(pct * 360);

    var timeStr;
    if (done) timeStr = '✓';
    else if (totalSec === 0) timeStr = '–:–';
    else timeStr = Math.floor(remainSec / 60) + ':' + String(remainSec % 60).padStart(2, '0');
    var subText = done ? 'complete' : (running ? 'remaining' : (paused ? 'paused' : MODES[mode].label + ' timer'));

    var ringBg = 'conic-gradient(var(--accent) ' + deg + 'deg, var(--line) ' + deg + 'deg)';

    var html = '<div class="focus-wrap">';

    /* ── Left: timer ── */
    html += '<div class="focus-left">';
    html += '<div class="focus-ring" style="background:' + ringBg + '">';
    html += '<div class="focus-ring-inner">';
    html += '<div class="focus-time serif">' + timeStr + '</div>';
    html += '<div class="focus-sub">' + subText + '</div>';
    html += '</div></div>';

    // Custom stepper (only before a session exists)
    if (mode === 'custom' && !session) {
      html += '<div class="focus-stepper">';
      html += '<button class="focus-step-btn" data-action="focus-minus">−</button>';
      html += '<span class="focus-step-val">' + customMin + ' min</span>';
      html += '<button class="focus-step-btn" data-action="focus-plus">+</button>';
      html += '</div>';
    }

    // Mode tabs (locked while a session exists — reset first)
    html += '<div class="focus-modes">';
    ['sprint', 'task', 'custom'].forEach(function (m) {
      html += '<button class="focus-mode-tab' + (mode === m ? ' active' : '') + (session ? ' locked' : '') + '" data-action="focus-mode" data-mode="' + m + '">' + MODES[m].label + '</button>';
    });
    html += '</div>';

    // Controls: play/pause + reset (reset only once a session exists)
    html += '<div class="focus-ctlrow">';
    if (session && !done) html += '<button class="focus-reset-sm" data-action="focus-reset" title="Reset"><i class="ti ti-rotate"></i></button>';
    var icon = running ? 'ti-player-pause' : 'ti-player-play';
    html += '<button class="focus-play" data-action="focus-toggle"><i class="ti ' + icon + '"></i></button>';
    if (session && !done) html += '<span class="focus-ctl-spacer"></span>';
    html += '</div>';
    html += '<div class="focus-persist-hint">Keeps running if you leave or refresh — the mini timer follows you.</div>';
    html += '</div>';

    /* ── Right: task / picker / completion ── */
    html += '<div class="focus-right">';
    html += renderRight(mode, done);
    html += '</div>';

    html += '</div>';
    el.innerHTML = html;
  }

  function renderRight(mode, done) {
    var task = attachedTask();

    // Completion state
    if (done) {
      var h = '<span class="focus-nontask-icon"><i class="ti ti-circle-check-filled" style="color:var(--accent)"></i></span>';
      h += '<div class="focus-nontask-title serif">Nice work — that\'s a wrap.</div>';
      if (task) {
        h += '<div class="focus-nontask-desc">You focused on <strong>' + esc(task.title || 'Untitled') + '</strong>. Mark it done?</div>';
        if (!task.done) h += '<button class="focus-pick-btn" data-action="focus-mark-done"><i class="ti ti-check"></i> Mark task done</button>';
        else h += '<div class="focus-task-meta">Marked done ✓</div>';
      } else {
        h += '<div class="focus-nontask-desc">The timer finished.</div>';
      }
      h += '<button class="focus-pick-btn focus-reset-btn" data-action="focus-reset"><i class="ti ti-rotate"></i> Start another</button>';
      return h;
    }

    // Non-task modes
    if (mode !== 'task') {
      var n = '<span class="focus-nontask-icon"><i class="ti ti-hourglass"></i></span>';
      n += '<div class="focus-nontask-title serif">Just focusing</div>';
      n += '<div class="focus-nontask-desc">No task attached — the timer runs on its own. Want it tied to something? Pick a task and its subtasks show up here.</div>';
      if (!session) n += '<button class="focus-pick-btn" data-action="focus-mode" data-mode="task"><i class="ti ti-plus"></i> Pick a task</button>';
      return n;
    }

    // Task mode, task attached → show it + subtasks
    if (task) {
      var meta = task.startMin != null ? (LC.fmtTime(task.startMin) + ' – ' + LC.fmtTime(task.startMin + (task.duration || 60))) : 'Today';
      var t = '<div class="focus-task-head"><div class="focus-task-label">Now working</div>' + (session ? '' : '<button class="focus-change-btn" data-action="focus-clear-task">Change</button>') + '</div>';
      t += '<div class="focus-task-title serif">' + esc(task.title || 'Untitled') + '</div>';
      t += '<div class="focus-task-meta">' + meta + '</div>';
      t += '<div class="focus-subtask-label">Subtasks</div>';
      var subs = task.subtasks || [];
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

    // Task mode, nothing attached → picker of today's tasks
    var p = '<div class="focus-task-label">Now working</div>';
    p += '<div class="focus-task-title serif">Pick a task to focus on</div>';
    var list = todaysTasks();
    if (list.length === 0) {
      p += '<div class="focus-subtask-empty">No tasks on today yet. Add one on your Day view first.</div>';
    } else {
      p += '<div class="focus-picker">';
      list.forEach(function (t) {
        var sc = (t.subtasks || []).length;
        var doneC = (t.subtasks || []).filter(function (s) { return s.done; }).length;
        p += '<button class="focus-pick-row' + (t.done ? ' done' : '') + '" data-action="focus-attach" data-task-id="' + esc(t.id) + '">';
        p += '<span class="focus-pick-bar"></span>';
        p += '<span class="focus-pick-main"><span class="focus-pick-title">' + esc(t.title || 'Untitled') + '</span>';
        p += '<span class="focus-pick-meta">' + (t.startMin != null ? LC.fmtTime(t.startMin) : 'Today') + (sc ? ' · ' + doneC + '/' + sc + ' subtasks' : '') + '</span></span>';
        p += '<i class="ti ti-chevron-right focus-pick-chev"></i>';
        p += '</button>';
      });
      p += '</div>';
    }
    return p;
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    var action = e.target.closest('[data-action]');
    if (!action) return;
    var a = action.dataset.action;

    if (a === 'focus-mini-open') { LC.set({ screen: 'focus' }); return; }
    if (a === 'focus-mini-toggle') {
      e.stopPropagation();
      if (!session) return;
      if (session.running) pauseSession(); else resumeSession();
      return;
    }

    if (a === 'focus-toggle') {
      if (session && session.done) return;
      if (session) {
        if (session.running) pauseSession(); else resumeSession();
        render();
        return;
      }
      var mode = LC.get('focusMode');
      if (mode === 'sprint') startSession('sprint', null, 25 * 60);
      else if (mode === 'custom') startSession('custom', null, (LC.get('focusCustomMin') || 25) * 60);
      else {
        var t = attachedTask();
        if (!t) return;   // the right panel is already asking them to pick
        startSession('task', t.id, taskFocusSec(t));
      }
      render();
      return;
    }

    if (a === 'focus-mode') {
      if (session) return;                       // reset first — a live/paused session isn't lost by a stray tap
      LC.set({ focusMode: action.dataset.mode, focusDone: false });
      return;
    }

    if (a === 'focus-minus') {
      if (session) return;
      LC.set({ focusCustomMin: Math.max(5, (LC.get('focusCustomMin') || 25) - 5) });
      return;
    }

    if (a === 'focus-plus') {
      if (session) return;
      LC.set({ focusCustomMin: Math.min(120, (LC.get('focusCustomMin') || 25) + 5) });
      return;
    }

    if (a === 'focus-attach') {
      LC.set({ focusTaskId: action.dataset.taskId, focusDone: false });
      return;
    }

    if (a === 'focus-clear-task') {
      if (session) return;
      LC.set({ focusTaskId: null });
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
      endSession();
      return;
    }
  });

  /* ── Restore on load: a running session picks up mid-count; an expired one lands complete (no jarring chime on load). ── */
  (function restore() {
    var saved = LC.loadData(SKEY);
    if (!saved || typeof saved !== 'object') return;
    session = saved;
    if (session.running && Date.now() >= session.endsAt) {
      session.running = false;
      session.done = true;
      session.remainSec = 0;
      persist();
    }
    if (session.running) ensureTicker();
    /* keep the ui flags truthful without forcing an early render cascade */
    LC.set({ focusRunning: !!session.running, focusDone: !!session.done, focusMode: session.mode, focusTaskId: session.taskId || LC.get('focusTaskId') });
  })();

  LC.on(render);
  window.LC_Focus = { render: render, startForTask: startForTask };
})();

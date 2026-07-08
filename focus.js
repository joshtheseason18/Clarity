/* ══════════════════════════════════════════
   Luclaro — Focus Timer
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var timerInterval = null;
  var remainingSec = 0;
  var totalSec = 0;

  var MODES = {
    sprint: { label: 'Sprint', duration: 25 },
    task:   { label: 'Task',   duration: 0 },
    custom: { label: 'Custom', duration: 25 },
  };

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* ── Task data (shared store with Today) ── */
  function loadTasks() { return LC.loadData('tasks') || []; }
  function saveTasks(arr) { LC.saveData('tasks', arr); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function todaysTasks() {
    return loadTasks().filter(function (t) { return t.date === todayStr() && t.type !== 'event'; })
      .sort(function (a, b) { return (a.startMin || 0) - (b.startMin || 0); });
  }
  function attachedTask() {
    var id = LC.get('focusTaskId');
    if (!id) return null;
    return loadTasks().find(function (t) { return t.id === id; }) || null;
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

  function render() {
    if (LC.get('screen') !== 'focus') return;
    var el = document.getElementById('screen-focus');
    var mode = LC.get('focusMode');
    var running = LC.get('focusRunning');
    var done = LC.get('focusDone');
    var customMin = LC.get('focusCustomMin') || 25;

    if (mode === 'sprint') totalSec = 25 * 60;
    else if (mode === 'custom') totalSec = customMin * 60;
    else totalSec = 0;

    if (!running && timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    var pct = totalSec > 0 ? ((totalSec - remainingSec) / totalSec) : 0;
    if (!running && !done) { remainingSec = totalSec; pct = 0; }
    if (done) pct = 1;
    var deg = Math.round(pct * 360);

    var displayMin = Math.floor(remainingSec / 60);
    var displaySec = remainingSec % 60;
    var timeStr = displayMin + ':' + String(displaySec).padStart(2, '0');
    if (mode === 'task' && !running) timeStr = '∞';
    if (done) timeStr = '✓';
    var subText = done ? 'complete' : (running ? 'remaining' : MODES[mode].label + ' timer');

    var ringBg = 'conic-gradient(var(--accent) ' + deg + 'deg, var(--line) ' + deg + 'deg)';

    var html = '<div class="focus-wrap">';

    /* ── Left: timer ── */
    html += '<div class="focus-left">';
    html += '<div class="focus-ring" style="background:' + ringBg + '">';
    html += '<div class="focus-ring-inner">';
    html += '<div class="focus-time serif">' + timeStr + '</div>';
    html += '<div class="focus-sub">' + subText + '</div>';
    html += '</div></div>';

    // Custom stepper
    if (mode === 'custom' && !running && !done) {
      html += '<div class="focus-stepper">';
      html += '<button class="focus-step-btn" data-action="focus-minus">−</button>';
      html += '<span class="focus-step-val">' + customMin + ' min</span>';
      html += '<button class="focus-step-btn" data-action="focus-plus">+</button>';
      html += '</div>';
    }

    // Mode tabs
    html += '<div class="focus-modes">';
    html += '<button class="focus-mode-tab' + (mode === 'sprint' ? ' active' : '') + '" data-action="focus-mode" data-mode="sprint">Sprint</button>';
    html += '<button class="focus-mode-tab' + (mode === 'task' ? ' active' : '') + '" data-action="focus-mode" data-mode="task">Task</button>';
    html += '<button class="focus-mode-tab' + (mode === 'custom' ? ' active' : '') + '" data-action="focus-mode" data-mode="custom">Custom</button>';
    html += '</div>';

    // Play/pause
    var icon = running ? 'ti-player-pause-filled' : 'ti-player-play-filled';
    html += '<button class="focus-play" data-action="focus-toggle"><i class="ti ' + icon + '"></i></button>';
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

    // Completion state (sprint/custom timer ended)
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
      n += '<button class="focus-pick-btn" data-action="focus-mode" data-mode="task"><i class="ti ti-plus"></i> Pick a task</button>';
      return n;
    }

    // Task mode, task attached → show it + subtasks
    if (task) {
      var meta = task.startMin != null ? (LC.fmtTime(task.startMin) + ' – ' + LC.fmtTime(task.startMin + (task.duration || 60))) : 'Today';
      var t = '<div class="focus-task-head"><div class="focus-task-label">Now working</div><button class="focus-change-btn" data-action="focus-clear-task">Change</button></div>';
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

  function startTimer() {
    var mode = LC.get('focusMode');
    if (mode === 'task') { remainingSec = 999999; totalSec = 999999; }
    timerInterval = setInterval(function () {
      if (remainingSec <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        var m = LC.get('focusMode');
        if (m === 'sprint' || m === 'custom') { chime(); LC.set({ focusRunning: false, focusDone: true }); }
        else { LC.set({ focusRunning: false }); }
        return;
      }
      remainingSec--;
      render();
    }, 1000);
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    var action = e.target.closest('[data-action]');
    if (!action) return;
    var a = action.dataset.action;

    if (a === 'focus-toggle') {
      var running = LC.get('focusRunning');
      if (running) {
        clearInterval(timerInterval);
        timerInterval = null;
        LC.set({ focusRunning: false });
      } else {
        var mode = LC.get('focusMode');
        var customMin = LC.get('focusCustomMin') || 25;
        if (mode === 'sprint') { totalSec = 25 * 60; remainingSec = totalSec; }
        else if (mode === 'custom') { totalSec = customMin * 60; remainingSec = totalSec; }
        else { totalSec = 999999; remainingSec = totalSec; }
        LC.set({ focusRunning: true, focusDone: false });
        startTimer();
      }
      return;
    }

    if (a === 'focus-mode') {
      if (LC.get('focusRunning')) return;
      LC.set({ focusMode: action.dataset.mode, focusDone: false });
      return;
    }

    if (a === 'focus-minus') {
      var m1 = LC.get('focusCustomMin') || 25;
      LC.set({ focusCustomMin: Math.max(5, m1 - 5) });
      return;
    }

    if (a === 'focus-plus') {
      var m2 = LC.get('focusCustomMin') || 25;
      LC.set({ focusCustomMin: Math.min(120, m2 + 5) });
      return;
    }

    if (a === 'focus-attach') {
      LC.set({ focusTaskId: action.dataset.taskId, focusDone: false });
      return;
    }

    if (a === 'focus-clear-task') {
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
      remainingSec = 0;
      LC.set({ focusDone: false, focusRunning: false });
      return;
    }
  });

  LC.on(render);
  window.LC_Focus = { render: render };
})();

/* ══════════════════════════════════════════
   Luclaro — Routines (Hub list + editor)
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var KEY = 'routines';
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

  function loadRoutines() {
    var r = LC.loadData(KEY) || [];
    // defensive: never let a malformed/imported routine (missing days/icon) crash a render
    r.forEach(function (x) { if (!Array.isArray(x.days)) x.days = []; if (!x.icon) x.icon = 'ti-circle'; });
    return r;
  }
  function saveRoutines(arr) { LC.saveData(KEY, arr); }

  var PRESETS = [
    ['ti-briefcase', 'Work'], ['ti-bowl', 'Meal'], ['ti-moon', 'Sleep'], ['ti-barbell', 'Gym'], ['ti-book', 'Read'],
    ['ti-coffee', 'Break'], ['ti-car', 'Commute'], ['ti-walk', 'Walk'], ['ti-heart', 'Self'], ['ti-flag-3', 'Focus']
  ];
  var DAYORDER = [1, 2, 3, 4, 5, 6, 0];
  var DAYLET = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  var DAYNAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var rtEditId = null; // null | 'new' | id
  var rtSel = null;     // selected row id (shows edit/delete)
  var rtDraft = null;

  function daysLabel(days) {
    if (days.length === 7) return 'every day';
    if (days.length === 5 && [1, 2, 3, 4, 5].every(function (d) { return days.indexOf(d) !== -1; })) return 'Mon–Fri';
    if (days.length === 2 && days.indexOf(0) !== -1 && days.indexOf(6) !== -1) return 'weekends';
    return DAYORDER.filter(function (d) { return days.indexOf(d) !== -1; }).map(function (d) { return DAYNAME[d]; }).join(', ');
  }

  /* ── Render ── */
  function render() {
    if (LC.get('screen') !== 'routineshub') return;
    var el = document.getElementById('screen-routineshub');
    el.innerHTML = renderList() + (rtEditId ? renderPanel() : '');
    attachPanel();
  }

  function renderList() {
    var routines = loadRoutines().slice().sort(function (a, b) { return a.startMin - b.startMin; });

    var html = '<div class="rt-wrap"><div class="rt-panel-inner">';

    html += '<div class="rt-head">';
    html += '<div><div class="rt-title serif">Your routines</div><div class="rt-subtitle">' + routines.length + ' blocks shaping a typical week · sorted by time of day</div></div>';
    html += '<button class="rt-add-btn" data-action="routine-add"><i class="ti ti-plus"></i> Add routine</button>';
    html += '</div>';

    html += '<div class="rt-legend"><span><i class="ti ti-lock"></i> locked — no tasks scheduled</span><span><i class="ti ti-arrow-down-to-arc"></i> open — tasks can fill it</span></div>';

    if (routines.length === 0) {
      html += '<div class="rt-empty">No routines yet. Add one to give your days a repeatable shape.</div>';
    }

    html += '<div class="rt-rows">';
    routines.forEach(function (r) {
      var selected = rtSel === r.id;
      html += '<div class="rt-row" data-action="routine-select" data-id="' + r.id + '">';
      html += '<span class="rt-icon-tile"><i class="ti ' + r.icon + '"></i></span>';
      html += '<div class="rt-row-main"><div class="rt-row-name">' + esc(r.name || 'Untitled') + '</div><div class="rt-row-time">' + LC.fmtTime(r.startMin) + ' – ' + LC.fmtTime(r.endMin) + '</div></div>';
      html += '<div class="rt-chips">';
      DAYORDER.forEach(function (di, i) {
        html += '<span class="rt-chip' + (r.days.indexOf(di) !== -1 ? ' on' : '') + '">' + DAYLET[i] + '</span>';
      });
      html += '</div>';
      html += '<span class="rt-spacer"></span>';
      if (r.protected) {
        html += '<span class="rt-mark protected"><i class="ti ti-lock"></i> locked</span>';
      } else {
        html += '<span class="rt-mark open"><i class="ti ti-arrow-down-to-arc"></i> open</span>';
      }
      if (selected) {
        html += '<div class="rt-row-actions"><button class="rt-edit-btn" data-action="routine-edit" data-id="' + r.id + '"><i class="ti ti-pencil"></i> Edit</button><button class="rt-del-btn" data-action="routine-delete" data-id="' + r.id + '"><i class="ti ti-trash"></i></button></div>';
      } else {
        html += '<i class="ti ti-chevron-right rt-row-chev"></i>';
      }
      html += '</div>';
    });
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  function renderPanel() {
    var d = rtDraft;
    var isNew = rtEditId === 'new';

    var html = '<div class="rt-backdrop" data-action="routine-close"></div>';
    html += '<aside class="rt-editor">';
    html += '<div class="rt-editor-head"><div class="rt-editor-title serif">' + (isNew ? 'New routine' : 'Edit routine') + '</div><button class="rt-editor-close" data-action="routine-close"><i class="ti ti-x"></i></button></div>';

    html += '<input class="rt-name-input" type="text" value="' + escAttr(d.name) + '" placeholder="Name this routine…">';

    html += '<div class="rt-presets">';
    PRESETS.forEach(function (p) {
      html += '<button class="rt-preset' + (d.icon === p[0] ? ' active' : '') + '" data-action="routine-icon" data-icon="' + p[0] + '"><i class="ti ' + p[0] + '"></i><span>' + p[1] + '</span></button>';
    });
    html += '</div>';

    html += '<div class="rt-times">';
    html += '<div class="rt-time-field"><div class="rt-field-label">Starts</div><div class="rt-stepper"><button class="rt-step" data-action="routine-start-minus">−</button><span class="rt-step-val">' + LC.fmtTime(d.startMin) + '</span><button class="rt-step" data-action="routine-start-plus">+</button></div></div>';
    html += '<div class="rt-time-field"><div class="rt-field-label">Ends</div><div class="rt-stepper"><button class="rt-step" data-action="routine-end-minus">−</button><span class="rt-step-val">' + LC.fmtTime(d.endMin) + '</span><button class="rt-step" data-action="routine-end-plus">+</button></div></div>';
    html += '</div>';

    html += '<div class="rt-field-label">Repeats on</div>';
    html += '<div class="rt-days">';
    DAYORDER.forEach(function (di, i) {
      html += '<button class="rt-day' + (d.days.indexOf(di) !== -1 ? ' on' : '') + '" data-action="routine-day" data-day="' + di + '">' + DAYLET[i] + '</button>';
    });
    html += '</div>';
    html += '<div class="rt-days-label">' + daysLabel(d.days) + '</div>';

    html += '<div class="rt-protect-row"><i class="ti ti-checkbox rt-protect-icon"></i><div class="rt-protect-text"><div>Can tasks be scheduled during this?</div><div class="rt-protect-sub">' + (d.protected ? 'Off — this block stays locked' : 'On — your to-dos can land inside it') + '</div></div><button class="rt-switch' + (!d.protected ? ' on' : '') + '" data-action="routine-protect"><span class="rt-switch-knob"></span></button></div>';

    html += '<div class="rt-editor-foot">';
    if (!isNew) html += '<button class="rt-editor-delete" data-action="routine-delete-editing"><i class="ti ti-trash"></i> Delete</button>';
    html += '<button class="rt-editor-save" data-action="routine-save">Save</button>';
    html += '</div>';

    html += '</aside>';
    return html;
  }

  function attachPanel() {
    var ni = document.querySelector('.rt-name-input');
    if (ni) {
      ni.focus();
      ni.addEventListener('input', function () { rtDraft.name = ni.value; });
    }
  }

  function captureName() {
    var ni = document.querySelector('.rt-name-input');
    if (ni && rtDraft) rtDraft.name = ni.value;
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    var action = e.target.closest('[data-action]');
    if (!action) return;
    var a = action.dataset.action;

    if (a === 'routine-add') {
      rtDraft = { id: null, name: '', icon: 'ti-briefcase', startMin: 540, endMin: 600, days: [1, 2, 3, 4, 5], protected: false };
      rtEditId = 'new';
      render();
      return;
    }

    if (a === 'routine-select') {
      var id = action.dataset.id;
      rtSel = (rtSel === id) ? null : id;
      render();
      return;
    }

    if (a === 'routine-edit') {
      var eid = action.dataset.id;
      var r = loadRoutines().find(function (x) { return x.id === eid; });
      if (r) { rtDraft = JSON.parse(JSON.stringify(r)); rtEditId = eid; render(); }
      return;
    }

    if (a === 'routine-delete') {
      var did = action.dataset.id;
      saveRoutines(loadRoutines().filter(function (x) { return x.id !== did; }));
      rtSel = null;
      render();
      return;
    }

    /* Editor controls */
    if (a === 'routine-close') { rtEditId = null; render(); return; }
    if (a === 'routine-icon') { captureName(); rtDraft.icon = action.dataset.icon; render(); return; }
    if (a === 'routine-day') {
      captureName();
      var dv = parseInt(action.dataset.day, 10);
      var idx = rtDraft.days.indexOf(dv);
      if (idx === -1) rtDraft.days.push(dv); else rtDraft.days.splice(idx, 1);
      render();
      return;
    }
    if (a === 'routine-protect') { captureName(); rtDraft.protected = !rtDraft.protected; render(); return; }
    if (a === 'routine-start-minus' || a === 'routine-start-plus') {
      captureName();
      var sd = a === 'routine-start-plus' ? 15 : -15;
      rtDraft.startMin = Math.max(0, Math.min(1440, rtDraft.startMin + sd));
      if (rtDraft.endMin <= rtDraft.startMin) rtDraft.endMin = rtDraft.startMin + 15;
      render();
      return;
    }
    if (a === 'routine-end-minus' || a === 'routine-end-plus') {
      captureName();
      var ed = a === 'routine-end-plus' ? 15 : -15;
      rtDraft.endMin = Math.max(rtDraft.startMin + 15, Math.min(1860, rtDraft.endMin + ed));
      render();
      return;
    }

    if (a === 'routine-delete-editing') {
      if (rtDraft.id) saveRoutines(loadRoutines().filter(function (x) { return x.id !== rtDraft.id; }));
      rtEditId = null; rtSel = null;
      render();
      return;
    }

    if (a === 'routine-save') {
      captureName();
      var arr = loadRoutines();
      if (rtEditId === 'new') {
        rtDraft.id = 'r' + Date.now();
        arr.push(rtDraft);
      } else {
        var i = arr.findIndex(function (x) { return x.id === rtDraft.id; });
        if (i !== -1) arr[i] = rtDraft;
      }
      saveRoutines(arr);
      rtEditId = null;
      render();
      return;
    }
  });

  /* Esc closes the routine editor by SAVING the draft (backdrop click discards; Esc
     shouldn't silently throw away a fully-typed routine). */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !rtEditId) return;
    var saveBtn = document.querySelector('[data-action="routine-save"]');
    if (saveBtn) saveBtn.click();
  });

  LC.on(render);
  window.LC_Routines = { render: render, loadRoutines: loadRoutines };
})();

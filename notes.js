/* ══════════════════════════════════════════
   Luclaro — Notes (editable, per-period)
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var KEY = 'notes';
  function loadNotes() { return LC.loadData(KEY) || {}; }
  function saveNotes(o) { LC.saveData(KEY, o); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

  /* ── Trash (soft-delete + 10s undo + 30-day auto-purge) ── */
  var TKEY = 'notestrash';
  var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  var UNDO_MS = 10000;
  var showTrash = false;
  var undoTimer = null;
  var trashSeq = 0;
  function loadTrash() { return LC.loadData(TKEY) || []; }
  function saveTrash(a) { LC.saveData(TKEY, a); }
  function purgeTrash() {
    var now = Date.now();
    var a = loadTrash();
    var kept = a.filter(function (t) { return now - (t.deletedAt || 0) < THIRTY_DAYS; });
    if (kept.length !== a.length) saveTrash(kept);
    return kept;
  }
  function trashId() { trashSeq += 1; return 'tr' + Date.now() + '_' + trashSeq; }
  function daysLeft(t) { return Math.max(0, Math.ceil((THIRTY_DAYS - (Date.now() - (t.deletedAt || 0))) / (24 * 60 * 60 * 1000))); }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var selKey = null; // selected "scope:period", null = current period
  var focusField = null; // block field to focus after next render (deep-link from Today)

  /* ── Block config per scope ── */
  var BLOCKS = {
    daily: [
      { field: 'morning', variant: 'accent', icon: 'ti-sunrise', label: 'Morning', ph: 'What matters today? Write your intention here.' },
      { field: 'free', variant: 'plain', ph: 'Free write — how the day is going…' },
      { field: 'evening', variant: 'blue', icon: 'ti-moon', label: 'Evening', ph: 'How did it go? Wins, challenges, gratitude.' },
      { field: 'todaysNotes', variant: 'muted', icon: 'ti-pencil', label: "Today's notes", ph: "Free space — anything that didn't fit the prompts." }
    ],
    monthly: [
      { field: 'theme', variant: 'accent', icon: 'ti-compass', label: 'Theme of the month', optional: true, input: 'text', serif: true, ph: 'Set a theme for this month…' },
      { field: 'lookingForward', variant: 'blue', icon: 'ti-eye', label: 'Looking forward to', ph: 'What are you looking forward to?' },
      { field: 'wentWell', variant: 'blue', icon: 'ti-sparkles', label: 'What went well', ph: 'What went well this month?' },
      { field: 'toImprove', variant: 'muted', icon: 'ti-bulb', label: 'To improve', ph: 'What could be better next month?' }
    ],
    yearly: [
      { field: 'theme', variant: 'accent', icon: 'ti-compass', label: 'Theme', input: 'text', serif: true, ph: 'Your theme for the year…' },
      { field: 'intentions', variant: 'accent', icon: 'ti-flag-3', label: 'Intentions for the year', ph: 'What do you intend this year?' },
      { field: 'milestones', variant: 'blue', icon: 'ti-award', label: 'Milestones', ph: 'Mark the milestones as they happen…' },
      { field: 'reflections', variant: 'muted', icon: 'ti-feather', label: 'Reflections', ph: 'Reflect on the arc of the year…' }
    ]
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function periodKey(scope) {
    var d = new Date();
    if (scope === 'daily') return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    if (scope === 'monthly') return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    return String(d.getFullYear());
  }
  function activeKey(scope) { return selKey || (scope + ':' + periodKey(scope)); }

  function periodLabel(scope, period) {
    if (scope === 'daily') {
      var p = period.split('-');
      var dt = new Date(+p[0], +p[1] - 1, +p[2]);
      return DAYS[dt.getDay()] + ', ' + MONTHS[dt.getMonth()] + ' ' + dt.getDate();
    }
    if (scope === 'monthly') {
      var q = period.split('-');
      return MONTHS[+q[1] - 1] + ' ' + q[0];
    }
    return period;
  }

  function snippet(note) {
    if (!note) return '';
    var order = ['morning', 'free', 'theme', 'intentions', 'wentWell', 'evening', 'lessons', 'milestones', 'reflections', 'todaysNotes'];
    for (var i = 0; i < order.length; i++) { if (note[order[i]]) return note[order[i]]; }
    return '';
  }

  function keysForScope(scope) {
    var notes = loadNotes();
    var keys = Object.keys(notes).filter(function (k) { return k.indexOf(scope + ':') === 0; });
    var cur = scope + ':' + periodKey(scope);
    if (keys.indexOf(cur) === -1) keys.push(cur);
    keys.sort(function (a, b) { return a < b ? 1 : -1; });
    return keys;
  }

  /* ── Render ── */
  function render() {
    if (LC.get('screen') !== 'notes') return;
    var el = document.getElementById('screen-notes');
    var scope = LC.get('notesScope');
    var notes = loadNotes();
    var actKey = activeKey(scope);
    var trash = purgeTrash();

    var html = '';

    /* Topbar */
    html += '<div class="notes-topbar">';
    html += '<div class="notes-scope-tabs">';
    ['daily', 'monthly', 'yearly'].forEach(function (s) {
      var label = s.charAt(0).toUpperCase() + s.slice(1);
      html += '<span class="notes-scope-tab' + (scope === s ? ' active' : '') + '" data-notes-scope="' + s + '">' + label + '</span>';
    });
    html += '</div>';
    html += '<div class="notes-topbar-right">';
    html += '<div class="notes-search"><i class="ti ti-search"></i><span>Search notes, tasks, events…</span><span class="notes-search-key">⌘K</span></div>';
    html += '<button class="notes-new-btn" data-action="notes-new"><i class="ti ti-plus"></i> New note</button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="notes-wrap">';

    /* Sidebar list */
    html += '<div class="notes-list">';
    var keys = keysForScope(scope);
    keys.forEach(function (k, i) {
      var period = k.slice(scope.length + 1);
      var note = notes[k];
      var active = k === actKey && !showTrash;
      html += '<div class="notes-item' + (active ? ' active' : '') + '" data-note-key="' + escAttr(k) + '">';
      html += '<div class="notes-item-main">';
      html += '<div class="notes-item-date" style="color:' + (active ? 'var(--accent)' : 'var(--mist)') + '">' + esc(periodLabel(scope, period)) + '</div>';
      var snip = snippet(note).substring(0, 80);
      html += '<div class="notes-item-snippet">' + (snip ? esc(snip) : '<span style="color:var(--haze)">Empty note</span>') + '</div>';
      html += '</div>';
      html += '<button class="notes-item-del" data-action="notes-delete" data-note-key="' + escAttr(k) + '" aria-label="Move note to trash" title="Move to trash"><i class="ti ti-trash"></i></button>';
      html += '</div>';
    });
    if (keys.length === 0) html += '<div class="notes-list-empty">No ' + scope + ' notes yet.</div>';
    html += '<button class="notes-trash-toggle' + (showTrash ? ' active' : '') + '" data-action="notes-toggle-trash"><i class="ti ti-trash"></i> Trash' + (trash.length ? ' · ' + trash.length : '') + '</button>';
    html += '</div>';

    /* Trash view replaces the editor when open */
    if (showTrash) {
      html += renderTrashView(trash);
      html += '</div>';
      el.innerHTML = html;
      return;
    }

    /* Editor */
    html += '<div class="notes-editor">';
    html += '<div class="notes-toolbar">';
    html += '<button class="notes-tb-btn"><i class="ti ti-bold"></i></button>';
    html += '<button class="notes-tb-btn"><i class="ti ti-italic"></i></button>';
    html += '<button class="notes-tb-btn"><i class="ti ti-list"></i></button>';
    html += '<button class="notes-tb-focus"><i class="ti ti-arrows-maximize"></i> Focus</button>';
    html += '</div>';

    var actPeriod = actKey.slice(scope.length + 1);
    var note = notes[actKey] || {};
    html += '<div class="notes-ed-title serif">' + esc(periodLabel(scope, actPeriod)) + '</div>';
    var savedTxt = note._saved ? ('saved ' + LC.fmtTime((function () { var d = new Date(note._saved); return d.getHours() * 60 + d.getMinutes(); })())) : 'new';
    html += '<div class="notes-ed-meta">' + (scope.charAt(0).toUpperCase() + scope.slice(1)) + ' note · ' + savedTxt + '</div>';

    BLOCKS[scope].forEach(function (b) { html += renderBlock(b, note); });

    html += '</div>';
    html += '</div>';

    el.innerHTML = html;
    attachEditor();
  }

  function renderTrashView(trash) {
    var h = '<div class="notes-editor notes-trash-view">';
    h += '<div class="notes-ed-title serif">Trash</div>';
    h += '<div class="notes-ed-meta">Deleted notes are kept for 30 days, then removed for good.';
    if (trash.length) h += ' <button class="notes-empty-trash" data-action="notes-empty-trash">Empty trash</button>';
    h += '</div>';
    if (trash.length === 0) {
      h += '<div class="notes-trash-empty"><i class="ti ti-trash-off"></i><span>Trash is empty.</span></div>';
    } else {
      h += '<div class="notes-trash-list">';
      trash.slice().sort(function (a, b) { return (b.deletedAt || 0) - (a.deletedAt || 0); }).forEach(function (t) {
        var sc = t.scope || 'daily';
        var period = t.key.slice(sc.length + 1);
        var snip = snippet(t.data).substring(0, 90);
        h += '<div class="notes-trash-item">';
        h += '<div class="notes-trash-main"><div class="notes-trash-title">' + esc(periodLabel(sc, period)) + '</div>';
        h += '<div class="notes-trash-snip">' + (snip ? esc(snip) : 'Empty note') + '</div>';
        h += '<div class="notes-trash-meta">' + daysLeft(t) + ' days left</div></div>';
        h += '<div class="notes-trash-actions">';
        h += '<button class="notes-trash-restore" data-action="notes-restore" data-trash-id="' + escAttr(t.id) + '"><i class="ti ti-arrow-back-up"></i> Restore</button>';
        h += '<button class="notes-trash-purge" data-action="notes-purge-one" data-trash-id="' + escAttr(t.id) + '" aria-label="Delete forever" title="Delete forever"><i class="ti ti-trash-x"></i></button>';
        h += '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderBlock(b, note) {
    var val = note[b.field] || '';
    if (b.variant === 'plain') {
      return '<textarea class="notes-block-input notes-freetext-input" data-field="' + b.field + '" placeholder="' + escAttr(b.ph) + '">' + esc(val) + '</textarea>';
    }
    var html = '<div class="notes-block ' + b.variant + '">';
    html += '<div class="notes-block-label ' + b.variant + '"><i class="ti ' + b.icon + '"></i> ' + b.label;
    if (b.optional) html += ' <span class="notes-optional">· optional</span>';
    html += '</div>';
    if (b.input === 'text') {
      html += '<input class="notes-block-input notes-block-title-input' + (b.serif ? ' serif' : '') + '" type="text" data-field="' + b.field + '" value="' + escAttr(val) + '" placeholder="' + escAttr(b.ph) + '">';
    } else {
      html += '<textarea class="notes-block-input" data-field="' + b.field + '" placeholder="' + escAttr(b.ph) + '">' + esc(val) + '</textarea>';
    }
    html += '</div>';
    return html;
  }

  function autosize(el) {
    if (el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 28) + 'px';
  }

  function attachEditor() {
    var scope = LC.get('notesScope');
    var actKey = activeKey(scope);
    [].forEach.call(document.querySelectorAll('.notes-block-input'), function (elm) {
      autosize(elm);
      elm.addEventListener('input', function () {
        autosize(elm);
        var notes = loadNotes();
        notes[actKey] = notes[actKey] || {};
        notes[actKey][elm.dataset.field] = elm.value;
        notes[actKey]._saved = Date.now();
        saveNotes(notes);
        var meta = document.querySelector('.notes-ed-meta');
        if (meta) meta.textContent = (scope.charAt(0).toUpperCase() + scope.slice(1)) + ' note · saving…';
      });
    });
    if (focusField) {
      var f = focusField;
      focusField = null;
      // defer: the screen isn't marked .active (visible) until main.render runs after this listener
      setTimeout(function () {
        var tgt = document.querySelector('.notes-block-input[data-field="' + f + '"]');
        if (tgt) { tgt.focus(); if (tgt.setSelectionRange) tgt.setSelectionRange(tgt.value.length, tgt.value.length); tgt.scrollIntoView({ block: 'center' }); }
      }, 0);
    }
  }

  /* ── Trash actions ── */
  function deleteNote(key) {
    var notes = loadNotes();
    if (!notes[key]) { // nothing saved yet — nothing to trash
      return;
    }
    var scope = key.split(':')[0];
    var entry = { id: trashId(), key: key, scope: scope, deletedAt: Date.now(), data: notes[key] };
    var trash = loadTrash(); trash.push(entry); saveTrash(trash);
    delete notes[key]; saveNotes(notes);
    if (selKey === key) selKey = null;
    showUndoToast(entry.id);
    render();
  }
  function restoreNote(id) {
    var trash = loadTrash();
    var entry = trash.find(function (t) { return t.id === id; });
    if (!entry) return;
    var notes = loadNotes();
    notes[entry.key] = entry.data;               // restore snapshot (overwrites if recreated)
    saveNotes(notes);
    saveTrash(trash.filter(function (t) { return t.id !== id; }));
    render();
  }
  function purgeOne(id) {
    saveTrash(loadTrash().filter(function (t) { return t.id !== id; }));
    render();
  }
  function emptyTrash() { saveTrash([]); render(); }

  function showUndoToast(id) {
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
    var old = document.getElementById('notes-undo-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'notes-undo-toast';
    t.className = 'notes-undo-toast';
    t.setAttribute('role', 'status');
    t.innerHTML = '<span>Note moved to trash</span><button data-action="notes-undo" data-trash-id="' + escAttr(id) + '">Undo</button>';
    document.body.appendChild(t);
    undoTimer = setTimeout(function () { if (t.parentNode) t.remove(); undoTimer = null; }, UNDO_MS);
  }
  function dismissToast() {
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
    var el = document.getElementById('notes-undo-toast');
    if (el) el.remove();
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    var action = e.target.closest('[data-action]');
    if (action) {
      var a = action.dataset.action;
      if (a === 'notes-delete') { deleteNote(action.dataset.noteKey); return; }
      if (a === 'notes-toggle-trash') { showTrash = !showTrash; render(); return; }
      if (a === 'notes-restore') { restoreNote(action.dataset.trashId); return; }
      if (a === 'notes-purge-one') { purgeOne(action.dataset.trashId); return; }
      if (a === 'notes-empty-trash') { emptyTrash(); return; }
      if (a === 'notes-undo') { restoreNote(action.dataset.trashId); dismissToast(); return; }
      if (a === 'notes-new') {
        selKey = null; showTrash = false;
        render();
        var first = document.querySelector('.notes-editor .notes-block-input');
        if (first) first.focus();
        return;
      }
    }
    var scopeTab = e.target.closest('[data-notes-scope]');
    if (scopeTab) {
      selKey = null; showTrash = false;
      LC.set({ notesScope: scopeTab.dataset.notesScope });
      return;
    }
    var item = e.target.closest('[data-note-key]');
    if (item) {
      selKey = item.dataset.noteKey; showTrash = false;
      render();
      return;
    }
  });

  /* Deep-link entry from Today's cards (⑤): open today's daily note, focus a block. */
  function openDaily(field) {
    selKey = null;
    focusField = field || null;
    LC.set({ screen: 'notes', notesScope: 'daily', editor: null, sessionOpen: null, projOpen: null });
  }

  LC.on(render);
  window.LC_Notes = { render: render, openDaily: openDaily };
})();

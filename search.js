/* ══════════════════════════════════════════
   Luclaro — Search (tasks · events · notes)
   ══════════════════════════════════════════
   Command-palette style overlay. Open via the Notes search bar or ⌘K / Ctrl+K.
*/

(function () {
  'use strict';

  var open = false;
  var query = '';

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
  // DOMParser = inert document; markup in stored notes can never execute during search.
  function stripHtml(s) {
    if (!s) return '';
    var doc = new DOMParser().parseFromString(s, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }

  var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function noteLabel(key) {
    var parts = key.split(':'), scope = parts[0], period = parts[1] || '';
    if (scope === 'daily') { var p = period.split('-'); var dt = new Date(+p[0], +p[1] - 1, +p[2]); return DOW[dt.getDay()] + ', ' + MO[dt.getMonth()] + ' ' + dt.getDate(); }
    if (scope === 'monthly') { var q = period.split('-'); return MO[+q[1] - 1] + ' ' + q[0]; }
    return period;
  }
  function dateLabel(iso) { if (!iso) return ''; var p = iso.split('-'); return MO[+p[1] - 1] + ' ' + (+p[2]); }

  /* ── Gather matches ── */
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var out = [];

    (LC.loadData('tasks') || []).forEach(function (t) {
      var hay = (t.title || '') + ' ' + (t.subtasks || []).map(function (s) { return s.label; }).join(' ');
      if (hay.toLowerCase().indexOf(q) >= 0) {
        out.push({ type: t.type === 'event' ? 'event' : 'task', title: t.title || 'Untitled', sub: (t.date ? dateLabel(t.date) : '') + (t.startMin != null ? ' · ' + LC.fmtTime(t.startMin) : ''), go: 'task', id: t.id });
      }
    });


    var notes = LC.loadData('notes') || {};
    Object.keys(notes).forEach(function (key) {
      var n = notes[key];
      var body = stripHtml(Object.keys(n).filter(function (k) { return k.charAt(0) !== '_'; }).map(function (k) { return n[k]; }).join(' '));
      if (body.toLowerCase().indexOf(q) >= 0 || noteLabel(key).toLowerCase().indexOf(q) >= 0) {
        var snip = body.replace(/\s+/g, ' ').trim().slice(0, 70);
        out.push({ type: 'note', title: noteLabel(key), sub: snip, go: 'note', key: key });
      }
    });

    return out;
  }

  var TYPE_META = {
    task: { icon: 'ti-circle', label: 'Task' },
    event: { icon: 'ti-calendar', label: 'Event' },
    note: { icon: 'ti-notebook', label: 'Note' }
  };

  /* ── Render ── */
  function render() {
    var host = document.getElementById('searchoverlay');
    if (!host) return;
    if (!open) { host.className = ''; host.innerHTML = ''; return; }

    var results = search(query);
    var h = '<div class="search-backdrop" data-action="search-close"></div>';
    h += '<div class="search-modal" role="dialog" aria-modal="true" aria-label="Search">';
    h += '<div class="search-bar"><i class="ti ti-search"></i>';
    h += '<input class="search-input" id="search-input" placeholder="Search tasks, events, notes…" value="' + escAttr(query) + '" autocomplete="off">';
    h += '<span class="search-esc">esc</span></div>';

    h += '<div class="search-results">';
    if (!query.trim()) {
      h += '<div class="search-hint">Type to search across everything in Luclaro.</div>';
    } else if (results.length === 0) {
      h += '<div class="search-hint">No matches for “' + esc(query) + '”.</div>';
    } else {
      results.forEach(function (r) {
        var m = TYPE_META[r.type];
        var attrs = r.go === 'note' ? ' data-key="' + escAttr(r.key) + '"' : ' data-id="' + escAttr(r.id) + '"';
        h += '<button class="search-row" data-action="search-go" data-go="' + r.go + '"' + attrs + '>';
        h += '<span class="search-row-icon"><i class="ti ' + m.icon + '"></i></span>';
        h += '<span class="search-row-main"><span class="search-row-title">' + esc(r.title) + '</span>';
        if (r.sub) h += '<span class="search-row-sub">' + esc(r.sub) + '</span>';
        h += '</span><span class="search-row-type">' + m.label + '</span></button>';
      });
    }
    h += '</div></div>';

    host.className = 'open';
    host.innerHTML = h;
    var inp = document.getElementById('search-input');
    if (inp) {
      setTimeout(function () { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);
      inp.addEventListener('input', function () { query = inp.value; renderResultsOnly(); });
    }
  }

  // Re-render just the results list so the input keeps focus/caret while typing.
  function renderResultsOnly() {
    var list = document.querySelector('.search-results');
    if (!list) { render(); return; }
    var results = search(query);
    var h = '';
    if (!query.trim()) h += '<div class="search-hint">Type to search across everything in Luclaro.</div>';
    else if (results.length === 0) h += '<div class="search-hint">No matches for “' + esc(query) + '”.</div>';
    else {
      results.forEach(function (r) {
        var m = TYPE_META[r.type];
        var attrs = r.go === 'note' ? ' data-key="' + escAttr(r.key) + '"' : ' data-id="' + escAttr(r.id) + '"';
        h += '<button class="search-row" data-action="search-go" data-go="' + r.go + '"' + attrs + '>';
        h += '<span class="search-row-icon"><i class="ti ' + m.icon + '"></i></span>';
        h += '<span class="search-row-main"><span class="search-row-title">' + esc(r.title) + '</span>';
        if (r.sub) h += '<span class="search-row-sub">' + esc(r.sub) + '</span>';
        h += '</span><span class="search-row-type">' + m.label + '</span></button>';
      });
    }
    list.innerHTML = h;
  }

  function openSearch() { open = true; query = ''; render(); }
  function closeSearch() { open = false; render(); }

  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function go(el) {
    var g = el.dataset.go;
    closeSearch();
    if (g === 'task' || g === 'event') {
      // anchor the Day view to the task's own date so it's visible next to its editor
      var t = (LC.loadData('tasks') || []).find(function (x) { return x.id === el.dataset.id; });
      var dAnchor = (t && t.date && t.date !== todayISO()) ? t.date : null;
      LC.set({ screen: 'today', dayAnchor: dAnchor, editor: el.dataset.id, sessionOpen: null, projOpen: null });
    }
    else if (g === 'note' && window.LC_Notes) LC_Notes.openKey(el.dataset.key);
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-action]');
    if (!a) return;
    var act = a.dataset.action;
    if (act === 'open-search') { openSearch(); return; }
    if (act === 'search-close') { closeSearch(); return; }
    if (act === 'search-go') { go(a); return; }
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); open ? closeSearch() : openSearch(); return; }
    if (open && e.key === 'Escape') { closeSearch(); }
  });

  window.LC_Search = { open: openSearch, close: closeSearch };
})();

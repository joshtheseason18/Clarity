/* ══════════════════════════════════════════
   Luclaro — Settings
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  var ACCENT_NAMES = ['green','rose','blue','amber','purple'];
  var ACCENT_LABELS = ['Green','Rose','Blue','Amber','Purple'];

  var DAY_BGS = [
    { key: 'cream', label: 'Cream',  color: '#EFE8DB' },
    { key: 'white', label: 'White',  color: '#FFFFFF' },
    { key: 'gray',  label: 'Gray',   color: '#E7E6E3' },
  ];
  var NIGHT_BGS = [
    { key: 'ink',      label: 'Ink',      color: '#0E0E11' },
    { key: 'charcoal', label: 'Charcoal', color: '#14110D' },
    { key: 'slate',    label: 'Slate',    color: '#0C1016' },
  ];

  function render() {
    if (LC.get('screen') !== 'settings') return;
    var el = document.getElementById('screen-settings');
    var st = LC.get();
    var t = LC.resolvedTheme();

    var html = '<div class="set-wrap"><div class="set-inner">';
    html += '<div class="set-title serif">Settings</div>';

    /* ── Appearance ── */
    html += section('Appearance');
    html += '<div class="set-card">';

    // Theme
    html += row('Theme', 'Night, day, or follow the time.',
      segmented([
        { label: '<i class="ti ti-moon"></i> Night', val: 'night', key: 'theme' },
        { label: '<i class="ti ti-sun"></i> Day', val: 'day', key: 'theme' },
        { label: '<i class="ti ti-circle-half-2"></i> System', val: 'system', key: 'theme' },
      ], st.theme)
    );

    // Accent
    html += '<div class="set-row">';
    html += '<div class="set-row-text"><div class="set-row-title">Accent color</div><div class="set-row-sub">Recolors active states, the dot, and selections.</div></div>';
    html += '<div class="set-accents">';
    ACCENT_NAMES.forEach(function (name, i) {
      var pal = LC.ACCENTS[name];
      var color = t === 'night' ? pal.n : pal.d;
      var cls = st.accent === name ? ' active' : '';
      html += '<button class="set-accent-dot' + cls + '" style="background:' + color + (st.accent === name ? ';box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px ' + color : '') + '" data-action="set-accent" data-val="' + name + '" title="' + ACCENT_LABELS[i] + '"></button>';
    });
    html += '</div></div>';

    // Clock
    html += '<div class="set-row set-row-border">';
    html += '<div class="set-row-text"><div class="set-row-title">Clock</div><div class="set-row-sub">12-hour (2:00 PM) or 24-hour (14:00).</div></div>';
    html += segmented([
      { label: '12-hour', val: '12', key: 'clockFmt' },
      { label: '24-hour', val: '24', key: 'clockFmt' },
    ], st.clockFmt);
    html += '</div>';
    html += '</div>';

    /* ── Background ── */
    html += section('Background');
    html += '<div class="set-card">';
    html += bgRow('Day background', 'Canvas color in day mode.', DAY_BGS, st.dayBg, 'dayBg');
    html += bgRow('Night background', 'Canvas color in night mode.', NIGHT_BGS, st.nightBg, 'nightBg');
    html += '</div>';

    /* ── Day view ── */
    html += section('Day view');
    html += '<div class="set-card">';
    html += '<div class="set-row-title" style="margin-bottom:3px">How your day appears</div>';
    html += '<div class="set-row-sub" style="margin-bottom:14px">Choose how your day is laid out.</div>';
    html += '<div class="set-layout-cards">';
    html += layoutCard('dayLayout', 'grid', 'Time grid', st.dayLayout === 'grid', gridThumb());
    html += layoutCard('dayLayout', 'agenda', 'Simple agenda', st.dayLayout === 'agenda', agendaThumb());
    html += '</div>';
    html += '</div>';

    /* ── Projects view ── */
    html += section('Projects view');
    html += '<div class="set-card">';
    html += '<div class="set-row-title" style="margin-bottom:3px">How your projects list looks</div>';
    html += '<div class="set-row-sub" style="margin-bottom:14px">Both stay available — this sets the default for the Projects lens.</div>';
    html += '<div class="set-layout-cards">';
    html += layoutCard('projView', 'urgency', 'Urgency list', st.projView === 'urgency', urgencyThumb());
    html += layoutCard('projView', 'spine', 'Deadline spine', st.projView === 'spine', spineThumb());
    html += '</div>';
    html += '</div>';

    /* ── Week starts on ── */
    html += section('Week starts on');
    html += '<div class="set-card set-card-inline">';
    html += '<div class="set-row-title" style="color:var(--mist)">First day of the week</div>';
    html += segmented([
      { label: 'Sunday', val: '0', key: 'weekStart' },
      { label: 'Monday', val: '1', key: 'weekStart' },
    ], '' + st.weekStart);
    html += '</div>';

    /* ── Routines ── */
    html += '<div class="set-section-header">';
    html += '<span class="set-section-label">Routines</span>';
    html += '<button class="set-manage-btn" data-action="open-routines">Manage all <i class="ti ti-arrow-right"></i></button>';
    html += '</div>';
    html += '<div class="set-card">';
    html += '<div class="set-row-sub" style="margin-bottom:14px">Recurring blocks your days are built around.</div>';
    var routines = (window.LC_Routines ? LC_Routines.loadRoutines() : []);
    if (routines.length === 0) {
      html += '<div class="set-routines-empty">No routines yet. Add one below.</div>';
    } else {
      var lockedN = routines.filter(function (r) { return r.protected; }).length;
      html += '<div class="set-routines-summary">' + routines.length + ' routine' + (routines.length !== 1 ? 's' : '') + (lockedN ? ' · ' + lockedN + ' locked' : '') + '</div>';
    }
    html += '</div>';
    html += '<button class="set-add-routine" data-action="open-routines"><i class="ti ti-plus"></i> ' + (routines.length ? 'Manage routines' : 'Add routine') + '</button>';

    /* ── Calendar ── */
    html += section('Calendar');
    var fed = !!LC.get('federalHolidays');
    html += '<div class="set-card set-card-inline">';
    html += '<div class="set-row-text"><div class="set-row-title">US federal holidays</div><div class="set-row-sub">Show federal holidays on your calendar.</div></div>';
    html += '<button class="rt-switch' + (fed ? ' on' : '') + '" data-action="toggle-federal" role="switch" aria-checked="' + fed + '"><span class="rt-switch-knob"></span></button>';
    html += '</div>';

    /* ── Your data ── */
    html += section('Your data');
    html += '<div class="set-card set-card-inline">';
    html += '<div class="set-row-text"><div class="set-row-title">Export a backup</div><div class="set-row-sub">Everything in a single .json file.</div></div>';
    html += '<button class="set-export-btn" data-action="export-data"><i class="ti ti-download"></i> Export</button>';
    html += '</div>';

    /* ── Account ── */
    html += section('Account');
    html += '<div class="set-card">';
    var user = LC.get('user');
    if (user) {
      var initial = (user.name || user.email || 'Y').charAt(0).toUpperCase();
      html += '<div class="set-account">';
      html += '<span class="set-avatar serif">' + escTxt(initial) + '</span>';
      html += '<div class="set-account-info"><div class="set-row-title">' + escTxt(user.name || 'You') + '</div><div class="set-row-sub">' + escTxt(user.email || '') + '</div></div>';
      html += '<button class="set-signout-btn" data-action="sign-out">Sign out</button>';
      html += '</div>';
      html += '<div class="set-sync-hint">' + syncLine(LC.get('syncStatus')) + '</div>';
    } else {
      html += '<div class="set-account">';
      html += '<span class="set-avatar serif">G</span>';
      html += '<div class="set-account-info"><div class="set-row-title">Guest</div><div class="set-row-sub">Everything saves on this device.</div></div>';
      html += '<button class="set-signout-btn" data-action="sign-in">Sign in</button>';
      html += '</div>';
      html += '<div class="set-sync-hint"><i class="ti ti-cloud"></i> Sign in to sync across all your devices.</div>';
    }
    html += '</div>';

    html += '</div></div>';
    el.innerHTML = html;
  }

  /* ── Helpers ── */
  function section(title) {
    return '<div class="set-section-label">' + title + '</div>';
  }

  function escTxt(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  function syncLine(status) {
    if (status === 'syncing') return '<i class="ti ti-cloud-up"></i> Syncing your changes…';
    if (status === 'offline') return '<i class="ti ti-cloud-off"></i> Offline — changes will sync when you reconnect.';
    if (status === 'synced') return '<i class="ti ti-cloud-check"></i> All changes synced across your devices.';
    return '<i class="ti ti-cloud-check"></i> Synced across your devices.';
  }

  function row(title, sub, control) {
    return '<div class="set-row"><div class="set-row-text"><div class="set-row-title">' + title + '</div><div class="set-row-sub">' + sub + '</div></div>' + control + '</div>';
  }

  function segmented(items, current) {
    var html = '<div class="set-seg">';
    items.forEach(function (it) {
      var active = it.val === current ? ' active' : '';
      html += '<button class="set-seg-btn' + active + '" data-action="set-pref" data-key="' + it.key + '" data-val="' + it.val + '">' + it.label + '</button>';
    });
    html += '</div>';
    return html;
  }

  function bgRow(title, sub, opts, current, key) {
    var html = '<div class="set-row">';
    html += '<div class="set-row-text"><div class="set-row-title">' + title + '</div><div class="set-row-sub">' + sub + '</div></div>';
    html += '<div class="set-bg-dots">';
    opts.forEach(function (o) {
      var active = current === o.key ? ' active' : '';
      var ring = current === o.key ? ';box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px var(--accent)' : '';
      html += '<button class="set-bg-dot' + active + '" style="background:' + o.color + ring + '" data-action="set-pref" data-key="' + key + '" data-val="' + o.key + '" title="' + o.label + '"></button>';
    });
    html += '</div></div>';
    return html;
  }

  function layoutCard(key, val, label, active, thumb) {
    var cls = active ? ' active' : '';
    return '<button class="set-layout-card' + cls + '" data-action="set-pref" data-key="' + key + '" data-val="' + val + '">' + thumb + '<span class="set-layout-label">' + label + '</span></button>';
  }

  function urgencyThumb() {
    function row(barOp, accOp) {
      return '<div class="set-thumb-row"><span class="set-thumb-bar" style="opacity:' + barOp + '"></span><span style="width:18px;height:5px;border-radius:3px;background:var(--accent);opacity:' + accOp + '"></span></div>';
    }
    return '<div class="set-thumb" style="gap:6px">' + row('.5', '.85') + row('.35', '.5') + row('.35', '.5') + '</div>';
  }

  function spineThumb() {
    function dot(op, acc) { return '<span style="width:9px;height:9px;border-radius:50%;background:' + (acc ? 'var(--accent)' : 'var(--mist)') + ';opacity:' + op + '"></span>'; }
    function bar(w, op) { return '<span style="height:6px;width:' + w + ';border-radius:3px;background:var(--mist);opacity:' + op + '"></span>'; }
    return '<div class="set-thumb" style="flex-direction:row;align-items:center;gap:9px;padding:8px 10px">' +
      '<div style="display:flex;flex-direction:column;gap:7px;align-items:center">' + dot('.85', true) + dot('.4', false) + dot('.4', false) + '</div>' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:7px">' + bar('80%', '.5') + bar('60%', '.35') + bar('70%', '.35') + '</div>' +
      '</div>';
  }

  function gridThumb() {
    return '<div class="set-thumb"><div class="set-thumb-row"><span class="set-thumb-dot"></span><span class="set-thumb-bar accent"></span></div><div class="set-thumb-row"><span class="set-thumb-dot"></span><span class="set-thumb-bar"></span></div><div class="set-thumb-row"><span class="set-thumb-dot"></span><span class="set-thumb-bar"></span></div></div>';
  }

  function agendaThumb() {
    return '<div class="set-thumb agenda"><span class="set-thumb-line accent"></span><span class="set-thumb-line"></span><span class="set-thumb-line"></span></div>';
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    var action = e.target.closest('[data-action]');
    if (!action) return;
    var a = action.dataset.action;

    if (a === 'set-pref') {
      var key = action.dataset.key;
      var val = action.dataset.val;
      var updates = {};
      updates[key] = key === 'weekStart' ? parseInt(val) : val;
      LC.set(updates);
    }

    if (a === 'set-accent') {
      LC.set({ accent: action.dataset.val });
    }

    if (a === 'export-data') {
      // export only Luclaro's own data (not the whole localStorage, which could include the auth token once signed in)
      var blob = new Blob([JSON.stringify(LC.allData(), null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a2 = document.createElement('a');
      a2.href = url;
      a2.download = 'luclaro-backup.json';
      a2.click();
      URL.revokeObjectURL(url);
    }

    if (a === 'open-routines') {
      LC.set({ screen: 'routineshub' });
    }

    if (a === 'toggle-federal') {
      LC.set({ federalHolidays: !LC.get('federalHolidays') });
    }
  });

  LC.on(render);
  window.LC_Settings = { render: render };
})();

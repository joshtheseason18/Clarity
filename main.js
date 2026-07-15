/* ══════════════════════════════════════════
   Luclaro — Main (boot + routing + nav rail)
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Nav items (matches reference rail order exactly) ── */
  const NAV = [
    { id: 'braindump', icon: 'ti-inbox',            label: 'Brain dump' },
    { id: 'today',     icon: 'ti-sun',              label: 'Today' },
    { id: 'calendar',  icon: 'ti-calendar',         label: 'Calendar' },
    { id: 'notes',     icon: 'ti-notebook',         label: 'Notes' },
    { id: 'focus',     icon: 'ti-clock',            label: 'Focus' },
  ];

  const BOTTOM_NAV = [
    { id: 'settings',  icon: 'ti-settings',         label: 'Settings' },
  ];

  /* ── Header configs per screen (matches reference exactly) ── */
  const HEADERS = {
    today: { type: 'cal' },
    calendar: { type: 'cal' },
    braindump: { type: 'lens', tabs: ['Brain dump', 'Projects'], stateKey: 'lens', map: { 'Brain dump': 'dump', 'Projects': 'projects' } },
    notes: { type: 'plain', title: 'Notes' },
    focus: { type: 'plain', title: 'Focus' },
    settings: { type: 'plain', title: 'Settings' },
    routineshub: { type: 'routineshub' },
  };

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  /* ── Render nav rail ── */
  function renderRail() {
    const rail = document.getElementById('rail');
    const screen = LC.get('screen');

    let html = '<button class="rail-brand" data-action="toggle-theme" aria-label="Toggle day or night" title="Toggle theme"><span class="rail-brand-dot"></span></button>';

    NAV.forEach(n => {
      html += '<button class="rail-btn' + (screen === n.id ? ' active' : '') + '" data-screen="' + n.id + '" title="' + n.label + '"><i class="ti ' + n.icon + '"></i></button>';
    });

    html += '<div class="rail-spacer"></div>';

    BOTTOM_NAV.forEach(n => {
      html += '<button class="rail-btn' + (screen === n.id ? ' active' : '') + '" data-screen="' + n.id + '" title="' + n.label + '"><i class="ti ' + n.icon + '"></i></button>';
    });

    rail.innerHTML = html;
  }

  const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function anchorDate() {
    var a = LC.get('calAnchor');
    return a ? new Date(a + 'T00:00:00') : new Date();
  }
  function isoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ── Period label for calendar header ── */
  function periodLabel() {
    const screen = LC.get('screen');
    const cal = LC.get('cal');

    if (screen === 'today' || cal === 'day') {
      const anchor = LC.get('dayAnchor');
      const t = anchor ? new Date(anchor + 'T00:00:00') : new Date();
      return DAYS[t.getDay()] + ', ' + MONTHS[t.getMonth()] + ' ' + t.getDate();
    }
    const d = anchorDate();
    if (cal === 'week') {
      const ws = LC.get('weekStart');
      const off = (d.getDay() - ws + 7) % 7;
      const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - off);
      const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
      if (s.getMonth() === e.getMonth()) return MON_SHORT[s.getMonth()] + ' ' + s.getDate() + ' – ' + e.getDate();
      return MON_SHORT[s.getMonth()] + ' ' + s.getDate() + ' – ' + MON_SHORT[e.getMonth()] + ' ' + e.getDate();
    }
    if (cal === 'month') {
      return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    }
    if (cal === 'year') {
      return String(d.getFullYear());
    }
    return '';
  }

  /* ── Render header ── */
  function renderHeader() {
    var hdr = document.getElementById('header');
    var screen = LC.get('screen');
    var cfg = HEADERS[screen];
    if (!cfg) { hdr.innerHTML = ''; return; }

    var html = '';

    if (cfg.type === 'cal') {
      var cal = LC.get('cal');
      var isToday = screen === 'today';
      var isDayTab = isToday || cal === 'day';
      var isWeek = !isToday && cal === 'week';
      var isMonth = !isToday && cal === 'month';
      var isYear = !isToday && cal === 'year';

      html += '<div class="header-period">';
      html += '<button class="header-period-btn" data-period="prev"><i class="ti ti-chevron-left"></i></button>';
      html += '<span class="header-period-label serif">' + periodLabel() + '</span>';
      html += '<button class="header-period-btn" data-period="next"><i class="ti ti-chevron-right"></i></button>';
      if (isToday && LC.get('dayAnchor')) html += '<button class="header-today-btn" data-action="back-to-today">Today</button>';
      html += '</div>';

      html += '<div class="header-tabs">';
      html += '<button class="header-tab' + (isDayTab ? ' active' : '') + '" data-cal-tab="day">Day</button>';
      html += '<button class="header-tab' + (isWeek ? ' active' : '') + '" data-cal-tab="week">Week</button>';
      html += '<button class="header-tab' + (isMonth ? ' active' : '') + '" data-cal-tab="month">Month</button>';
      html += '<button class="header-tab' + (isYear ? ' active' : '') + '" data-cal-tab="year">Year</button>';
      html += '</div>';
    }

    if (cfg.type === 'lens') {
      if (LC.get('projOpen')) {
        html += '<button class="header-back" data-action="close-project"><i class="ti ti-chevron-left"></i> Projects</button>';
      } else {
        var cur = LC.get(cfg.stateKey);
        html += '<div class="header-tabs">';
        cfg.tabs.forEach(function (t) {
          var val = cfg.map[t];
          html += '<button class="header-tab' + (cur === val ? ' active' : '') + '" data-tab="' + val + '" data-key="' + cfg.stateKey + '">' + t + '</button>';
        });
        html += '</div>';
      }
    }

    if (cfg.type === 'routineshub') {
      html += '<div class="header-group">';
      html += '<button class="header-back" data-screen="settings"><i class="ti ti-chevron-left"></i> Settings</button>';
      html += '<span class="header-title serif">Routines</span>';
      html += '</div>';
    }

    if (cfg.type === 'plain') {
      html += '<span class="header-title serif">' + cfg.title + '</span>';
    }

    hdr.innerHTML = html;
  }

  /* ── Screen switching ── */
  function showScreen() {
    const screen = LC.get('screen');
    document.querySelectorAll('.screen').forEach(el => {
      el.classList.toggle('active', el.id === 'screen-' + screen);
    });
  }

  /* ── Full render ── */
  function render() {
    renderRail();
    renderHeader();
    showScreen();
  }

  /* ── Event delegation ── */
  document.addEventListener('click', function (e) {
    var brandBtn = e.target.closest('[data-action="toggle-theme"]');
    if (brandBtn) {
      var cur = LC.get('theme');
      LC.set({ theme: cur === 'night' ? 'day' : 'night' });
      return;
    }

    var backToday = e.target.closest('[data-action="back-to-today"]');
    if (backToday) {
      LC.set({ dayAnchor: null, editor: null });
      return;
    }

    var periodBtn = e.target.closest('[data-period]');
    if (periodBtn) {
      if (LC.get('screen') === 'today') {
        // Day-to-day navigation: shift the viewed date ±1 (editor closes to avoid cross-day ghosts)
        var ddir2 = periodBtn.dataset.period === 'next' ? 1 : -1;
        var cur2 = LC.get('dayAnchor') || isoDate(new Date());
        var nd2 = new Date(cur2 + 'T00:00:00'); nd2.setDate(nd2.getDate() + ddir2);
        var next2 = isoDate(nd2);
        LC.set({ dayAnchor: next2 === isoDate(new Date()) ? null : next2, editor: null });
        return;
      }
      if (LC.get('screen') === 'calendar') {
        var pdir = periodBtn.dataset.period === 'next' ? 1 : -1;
        var pcal = LC.get('cal');
        var ad = anchorDate();
        var nd;
        if (pcal === 'week') nd = new Date(ad.getFullYear(), ad.getMonth(), ad.getDate() + pdir * 7);
        else if (pcal === 'month') nd = new Date(ad.getFullYear(), ad.getMonth() + pdir, 1);
        else if (pcal === 'year') nd = new Date(ad.getFullYear() + pdir, 0, 1);
        if (nd) LC.set({ calAnchor: isoDate(nd), weekSel: null, yearSelMonth: null, monthSelDay: null });
      }
      return;
    }

    var railBtn = e.target.closest('.rail-btn[data-screen]');
    if (railBtn) {
      var id = railBtn.dataset.screen;
      if (id === 'calendar') {
        var cur = LC.get('cal');
        LC.set({ screen: 'calendar', cal: cur === 'day' ? 'week' : cur, editor: null, sessionOpen: null, projOpen: null, calAnchor: null, weekSel: null, yearSelMonth: null, monthSelDay: null });
      } else if (id === 'braindump') {
        LC.set({ screen: 'braindump', projOpen: null, sessionOpen: null, editor: null });
      } else if (id === 'today') {
        LC.set({ screen: 'today', editor: null, sessionOpen: null, projOpen: null, dayAnchor: null });   // rail Today always returns to the real today
      } else {
        LC.set({ screen: id, editor: null, sessionOpen: null, projOpen: null });
      }
      return;
    }

    var closeProj = e.target.closest('[data-action="close-project"]');
    if (closeProj) {
      LC.set({ projOpen: null });
      return;
    }

    var calTab = e.target.closest('[data-cal-tab]');
    if (calTab) {
      var tab = calTab.dataset.calTab;
      if (tab === 'day') {
        LC.set({ screen: 'today', calAnchor: null, editor: null, dayAnchor: null });
      } else {
        LC.set({ screen: 'calendar', cal: tab, calAnchor: null, weekSel: null, yearSelMonth: null, monthSelDay: null, editor: null });
      }
      return;
    }

    var tabBtn = e.target.closest('.header-tab[data-tab]');
    if (tabBtn) {
      var updates = {};
      updates[tabBtn.dataset.key] = tabBtn.dataset.tab;
      LC.set(updates);
      return;
    }

    var backBtn = e.target.closest('.header-back[data-screen]');
    if (backBtn) {
      LC.set({ screen: backBtn.dataset.screen });
      return;
    }
  });

  /* ── Boot ── */
  LC.init();
  LC.on(render);
  render();

  /* ── Heartbeat: keep an always-open tab honest ──
     At midnight the date/tasks/intention change; at 7:00/19:00 the "system" theme flips;
     and the Day view's now-line should crawl. One 60s tick covers all three.
     LC.reloadPrefs() reapplies theme/accent and re-renders every module. */
  var hbDay = new Date().toDateString();
  var hbTheme = LC.resolvedTheme();
  setInterval(function () {
    var day = new Date().toDateString();
    var theme = LC.resolvedTheme();
    if (day !== hbDay || theme !== hbTheme) {
      hbDay = day; hbTheme = theme;
      // if the view was anchored to what has just become today, unpin it so the
      // Day view keeps following the real date (and the "Today" pill disappears)
      if (LC.get('dayAnchor') === isoDate(new Date())) LC.set({ dayAnchor: null });
      LC.reloadPrefs();
      return;
    }
    // refresh the now-line/clock only when it can't disturb typing (no editor/drawer open)
    if (LC.get('screen') === 'today' && LC.get('editor') == null && LC.get('sessionOpen') == null && window.LC_Today) {
      LC_Today.render();
    }
  }, 60000);

})();

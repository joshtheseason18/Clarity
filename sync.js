/* ══════════════════════════════════════════
   Luclaro — Sync (Supabase, single JSON blob)
   ══════════════════════════════════════════
   Debounced last-write-wins sync to a single `user_state` row per user.
   Runs only while signed in; guest data stays local.

   Requires this table in Supabase (run once in the SQL editor):

     create table if not exists public.user_state (
       user_id    uuid primary key references auth.users(id) on delete cascade,
       data       jsonb not null default '{}',
       updated_at timestamptz not null default now()
     );
     alter table public.user_state enable row level security;
     create policy "own state" on public.user_state
       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
*/

(function () {
  'use strict';

  var TABLE = 'user_state';
  var TS_KEY = 'luclaro_syncTs';      // device-local data version (not part of the synced blob)
  var DEBOUNCE = 1500;
  var pushTimer = null;
  var active = false;                 // true while signed in

  function db() { return window.LC_Auth ? LC_Auth.client() : null; }
  function userId() { var u = LC.get('user'); return u ? u.id : null; }
  function localTs() { var v = parseInt(localStorage.getItem(TS_KEY) || '0', 10); return isNaN(v) ? 0 : v; }
  function bumpLocalTs() { localStorage.setItem(TS_KEY, String(Date.now())); }

  /* ── Pull on sign-in: newer side wins ── */
  function onSignIn() {
    var c = db(), uid = userId();
    if (!c || !uid) return;
    active = true;
    LC.set({ syncStatus: 'syncing' });
    c.from(TABLE).select('data, updated_at').eq('user_id', uid).maybeSingle().then(function (res) {
      if (res.error) { LC.set({ syncStatus: 'offline' }); return; }
      var row = res.data;
      if (row && row.data && Object.keys(row.data).length) {
        var cloudTs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
        if (cloudTs >= localTs()) {
          // cloud is newer (or first sign-in on this device) → adopt it
          LC.replaceAllData(row.data);
          bumpLocalTs();
          reRenderAll();
          LC.set({ syncStatus: 'synced' });
          return;
        }
      }
      // no cloud data, or local is newer → push local up
      push(true);
    });
  }

  function onSignOut() {
    active = false;
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    LC.set({ syncStatus: 'idle' });
  }

  /* ── Debounced push on any data change ── */
  function onChange() {
    if (!active) return;
    bumpLocalTs();
    LC.set({ syncStatus: 'syncing' });
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { push(false); }, DEBOUNCE);
  }

  function push(immediate) {
    var c = db(), uid = userId();
    if (!c || !uid) return;
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    var payload = { user_id: uid, data: LC.allData(), updated_at: new Date().toISOString() };
    c.from(TABLE).upsert(payload, { onConflict: 'user_id' }).then(function (res) {
      LC.set({ syncStatus: res && res.error ? 'offline' : 'synced' });
    });
  }

  function reRenderAll() {
    ['LC_Today', 'LC_BrainDump', 'LC_Notes', 'LC_Focus', 'LC_Settings', 'LC_Routines'].forEach(function (m) {
      if (window[m] && typeof window[m].render === 'function') { try { window[m].render(); } catch (e) {} }
    });
    if (window.LC_Calendar && LC_Calendar.render) { try { LC_Calendar.render(); } catch (e) {} }
  }

  LC.onData(onChange);
  window.LC_Sync = { onSignIn: onSignIn, onSignOut: onSignOut, push: function () { push(true); } };
})();

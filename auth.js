/* ══════════════════════════════════════════
   Luclaro — Auth (Supabase: Google + email/password + guest)
   ══════════════════════════════════════════
   Guest is the default — the app never gates behind login.
   To enable cloud sign-in, paste your Supabase anon (publishable)
   key below. Guest mode works with or without it.
*/

(function () {
  'use strict';

  var SUPABASE_URL = 'https://owvevphwezdqzsiywrwm.supabase.co';
  var SUPABASE_ANON_KEY = ''; // ← paste your Supabase anon key here to turn on Google / email sign-in

  var client = null;
  var enabled = false;
  var mode = 'signin'; // 'signin' | 'signup'
  var busy = false;
  var errMsg = '';

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  /* ── Init ── */
  function init() {
    if (SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient) {
      try {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        enabled = true;
      } catch (e) { enabled = false; }
    }
    if (!enabled) { render(); return; }

    // Restore any existing session, then react to future changes.
    client.auth.getSession().then(function (res) {
      var s = res && res.data ? res.data.session : null;
      applySession(s);
    });
    client.auth.onAuthStateChange(function (_event, session) {
      applySession(session);
    });
    render();
  }

  function applySession(session) {
    if (session && session.user) {
      var u = session.user;
      var name = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email ? u.email.split('@')[0] : 'You');
      LC.set({ user: { id: u.id, email: u.email || '', name: name }, authOpen: false });
      if (window.LC_Sync) LC_Sync.onSignIn();
    } else {
      if (LC.get('user')) { // was signed in → signed out
        LC.set({ user: null });
        if (window.LC_Sync) LC_Sync.onSignOut();
      }
    }
  }

  /* ── Actions ── */
  function open() { errMsg = ''; mode = 'signin'; LC.set({ authOpen: true }); }
  function close() { LC.set({ authOpen: false }); }

  function signInGoogle() {
    if (!enabled) return;
    busy = true; render();
    client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } })
      .then(function (res) { if (res.error) { errMsg = res.error.message; busy = false; render(); } });
    // On success the browser redirects away; onAuthStateChange handles the return.
  }

  function submitEmail() {
    if (!enabled || busy) return;
    var email = (document.getElementById('auth-email') || {}).value || '';
    var pass = (document.getElementById('auth-pass') || {}).value || '';
    if (!email || !pass) { errMsg = 'Enter your email and password.'; render(); return; }
    busy = true; errMsg = ''; render();
    var p = mode === 'signup'
      ? client.auth.signUp({ email: email, password: pass })
      : client.auth.signInWithPassword({ email: email, password: pass });
    p.then(function (res) {
      busy = false;
      if (res.error) { errMsg = res.error.message; render(); return; }
      if (mode === 'signup' && res.data && res.data.user && !res.data.session) {
        errMsg = ''; mode = 'signin';
        LC.set({ authOpen: true });
        setTimeout(function () {
          var note = document.querySelector('.auth-note');
          if (note) note.textContent = 'Check your email to confirm your account, then sign in.';
        }, 0);
        return;
      }
      // signInWithPassword success → onAuthStateChange closes the overlay.
    });
  }

  function continueAsGuest() { close(); }

  function signOut() {
    if (client) client.auth.signOut();
    else { LC.set({ user: null }); if (window.LC_Sync) LC_Sync.onSignOut(); }
  }

  /* ── Overlay UI ── */
  function render() {
    var host = document.getElementById('authoverlay');
    if (!host) return;
    if (!LC.get('authOpen')) { host.className = ''; host.innerHTML = ''; return; }

    var h = '<div class="auth-backdrop" data-action="auth-close"></div>';
    h += '<div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">';
    h += '<button class="auth-close" data-action="auth-close" aria-label="Close sign in"><i class="ti ti-x"></i></button>';
    h += '<div class="auth-brand"><span class="auth-dot"></span></div>';
    h += '<h2 class="auth-title serif" id="auth-title">' + (mode === 'signup' ? 'Create your account' : 'Welcome back') + '</h2>';
    h += '<p class="auth-sub">' + (mode === 'signup' ? 'Sync your planner across every device.' : 'Sign in to sync across your devices.') + '</p>';

    if (!enabled) {
      h += '<div class="auth-disabled"><i class="ti ti-cloud-off"></i> Cloud sign-in isn\'t configured yet. You can keep using Luclaro as a guest — everything saves on this device.</div>';
      h += '<button class="auth-guest-btn" data-action="auth-guest">Continue as guest</button>';
      h += '</div>';
      host.className = 'open';
      host.innerHTML = h;
      return;
    }

    h += '<button class="auth-google" data-action="auth-google"' + (busy ? ' disabled' : '') + '><i class="ti ti-brand-google"></i> Continue with Google</button>';
    h += '<div class="auth-divider"><span>or</span></div>';

    h += '<label class="auth-label" for="auth-email">Email</label>';
    h += '<input class="auth-input" id="auth-email" type="email" autocomplete="email" placeholder="you@example.com">';
    h += '<label class="auth-label" for="auth-pass">Password</label>';
    h += '<input class="auth-input" id="auth-pass" type="password" autocomplete="' + (mode === 'signup' ? 'new-password' : 'current-password') + '" placeholder="••••••••">';

    if (errMsg) h += '<div class="auth-error" role="alert">' + esc(errMsg) + '</div>';
    h += '<div class="auth-note" aria-live="polite"></div>';

    h += '<button class="auth-submit" data-action="auth-submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'One moment…' : (mode === 'signup' ? 'Create account' : 'Sign in')) + '</button>';

    h += '<div class="auth-toggle">' + (mode === 'signup'
      ? 'Already have an account? <button data-action="auth-mode" data-mode="signin">Sign in</button>'
      : 'New here? <button data-action="auth-mode" data-mode="signup">Create an account</button>') + '</div>';

    h += '<button class="auth-guest-link" data-action="auth-guest">Continue as guest</button>';
    h += '</div>';

    host.className = 'open';
    host.innerHTML = h;
    var first = document.getElementById('auth-email');
    if (first) setTimeout(function () { first.focus(); }, 0);
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    var action = e.target.closest('[data-action]');
    if (!action) return;
    var a = action.dataset.action;
    if (a === 'auth-close' || a === 'auth-guest') { continueAsGuest(); return; }
    if (a === 'auth-google') { signInGoogle(); return; }
    if (a === 'auth-submit') { submitEmail(); return; }
    if (a === 'auth-mode') { mode = action.dataset.mode; errMsg = ''; render(); return; }
    if (a === 'sign-in') { open(); return; }        // from Settings
    if (a === 'sign-out') { signOut(); return; }     // from Settings
  });

  document.addEventListener('keydown', function (e) {
    if (!LC.get('authOpen')) return;
    if (e.key === 'Escape') { continueAsGuest(); }
    if (e.key === 'Enter' && enabled && (e.target.id === 'auth-email' || e.target.id === 'auth-pass')) { e.preventDefault(); submitEmail(); }
  });

  LC.on(render);
  window.LC_Auth = { init: init, open: open, signOut: signOut, isEnabled: function () { return enabled; }, client: function () { return client; } };

  init();
})();

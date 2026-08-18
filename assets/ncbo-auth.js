/* ============================================================================
   NCBO — ncbo-auth.js
   The browser half of the member gate: Supabase client, magic-link sign-in,
   and the one function that decides which panel is on screen.

   Load order at the end of <body>, and it matters:

     1. @supabase/supabase-js from the CDN   → window.supabase
     2. assets/supabase-config.js            → window.NCBO_SUPABASE
     3. assets/ncbo-auth-core.js             → window.NCBOAuthCore
     4. assets/ncbo-auth.js                  → this file

   Panels are the `<section data-auth-view="...">` blocks in members.html.
   Exactly one is shown at a time and every other one is `hidden` — including
   the approved panel, which holds the hub. The hub is only rendered once the
   profile row comes back approved, so a browser that never signs in is never
   handed member content.

   What actually protects anything is row-level security in Postgres: this
   file decides what to *draw*, and the database decides what may be *read*.
   Hiding a panel is presentation, not access control.
   ========================================================================== */
(function () {
  'use strict';

  var Core = window.NCBOAuthCore;
  var CONFIG = window.NCBO_SUPABASE || {};

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ── state ────────────────────────────────────────────────────────
     One object, one render function. Nothing anywhere else flips `hidden`. */
  var state = {
    configured: !!Core && Core.isConfigured(CONFIG),
    ready: false,
    session: null,
    profile: null,
    linkSent: false,
    sentTo: '',
    error: ''
  };

  var client = null;
  var hubRendered = false;

  function setState(patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) state[k] = patch[k];
    render();
  }

  /* ── the panels ───────────────────────────────────────────────────── */
  function render() {
    if (!Core) return;
    var want = Core.viewFor(state);

    $$('[data-auth-view]').forEach(function (el) {
      el.hidden = el.getAttribute('data-auth-view') !== want;
    });
    document.body.setAttribute('data-auth-state', want);
    document.body.classList.toggle('member-in', want === 'approved');

    fill('[data-auth-field="email"]', state.sentTo ||
      (state.session && state.session.user && state.session.user.email) || '');
    fill('[data-auth-field="name"]',
      Core.firstNameOf(state.profile, state.session && state.session.user && state.session.user.email));
    fill('[data-auth-field="error"]', state.error || '');

    /* The admin link is drawn from the profile role, but review.html checks
       the role again for itself — this only saves an admin from typing a URL. */
    var admin = Core.canReviewMembers(state.profile);
    $$('[data-auth-role="admin"]').forEach(function (el) { el.hidden = !admin; });

    if (want === 'approved') renderHub();
  }

  function fill(sel, text) {
    $$(sel).forEach(function (el) { el.textContent = text; });
  }

  /* ── the render hook into app.js ──────────────────────────────────
     app.js owns every pixel of the hub and exposes exactly one entry point,
     `window.NCBOHub.buildHub(member)`. It is called once, after the profile
     comes back approved. If app.js has not parsed yet we wait for its ready
     event rather than racing it. */
  function renderHub() {
    if (hubRendered || !state.profile) return;
    var member = {
      id: state.profile.id,
      email: (state.session && state.session.user && state.session.user.email) || '',
      name: Core.displayNameFor(state.profile,
        state.session && state.session.user && state.session.user.email),
      role: Core.normalizeRole(state.profile.role),
      status: Core.normalizeStatus(state.profile.status),
      isAdmin: Core.isAdmin(state.profile),
      client: client
    };

    if (window.NCBOHub && typeof window.NCBOHub.buildHub === 'function') {
      hubRendered = true;
      window.NCBOHub.buildHub(member);
      return;
    }
    document.addEventListener('ncbo:hub-ready', function once() {
      document.removeEventListener('ncbo:hub-ready', once);
      renderHub();
    });
  }

  /* ── profile ──────────────────────────────────────────────────────
     `profiles` holds no email column on purpose; the address stays in
     auth.users and reaches us only through the session. RLS lets a member
     read their own row whatever their status, so a pending account can be
     told it is pending. */
  function loadProfile(session) {
    if (!session || !session.user) {
      setState({ ready: true, session: null, profile: null });
      return;
    }
    client.from('profiles')
      .select('id, display_name, role, status, school_id, club_id, created_at')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(function (res) {
        if (res.error) {
          setState({ ready: true, session: session, profile: null,
                     error: Core.authErrorMessage(res.error) });
          return;
        }
        /* No row yet means the signup trigger is still running. Treat it as
           pending — never as approved. */
        setState({
          ready: true,
          session: session,
          profile: res.data || { id: session.user.id, status: 'pending', role: 'member' },
          error: ''
        });
      });
  }

  /* ── sign in ──────────────────────────────────────────────────────── */
  function wireSignIn() {
    var form = $('[data-auth-form="sign-in"]');
    if (!form) return;

    var input = $('[data-auth-input="email"]', form);
    var button = form.querySelector('button[type="submit"]');
    var msg = $('[data-auth-message]', form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!client) return;

      var email = Core.normalizeEmail(input && input.value);
      if (msg) msg.textContent = '';

      if (!Core.isEmail(email)) {
        if (msg) msg.textContent = 'That does not look like an email address.';
        if (input) input.focus();
        return;
      }

      var label = button ? button.textContent : '';
      if (button) { button.disabled = true; button.textContent = 'Sending…'; }
      var done = function () {
        if (button) { button.disabled = false; button.textContent = label; }
      };

      var options = { shouldCreateUser: true };
      var back = String(CONFIG.redirectTo || '').trim() ||
                 location.origin + location.pathname;
      options.emailRedirectTo = back;

      client.auth.signInWithOtp({ email: email, options: options })
        .then(function (res) {
          done();
          if (res.error) {
            if (msg) msg.textContent = Core.authErrorMessage(res.error);
            return;
          }
          setState({ linkSent: true, sentTo: email, error: '' });
        })
        .catch(function (err) {
          done();
          if (msg) msg.textContent = Core.authErrorMessage(err);
        });
    });
  }

  /* ── sign out ─────────────────────────────────────────────────────
     Clear the keys the old browser-side password gate left behind as well,
     so a device that was "signed in" under that scheme doesn't keep a stale
     record of who used it. */
  var LEGACY_KEYS = ['ncbo-session-v1', 'ncbo-member-access'];

  function dropLegacy() {
    for (var i = 0; i < LEGACY_KEYS.length; i++) {
      try { localStorage.removeItem(LEGACY_KEYS[i]); } catch (e) { /* private mode */ }
      try { sessionStorage.removeItem(LEGACY_KEYS[i]); } catch (e) { /* private mode */ }
    }
  }

  function wireSignOut() {
    $$('[data-auth-action="sign-out"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        dropLegacy();
        if (!client) { location.reload(); return; }
        client.auth.signOut().then(function () {
          location.replace(location.pathname);
        });
      });
    });
  }

  function wireRetry() {
    $$('[data-auth-action="retry"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        setState({ error: '', linkSent: false, sentTo: '' });
      });
    });
  }

  /* ── boot ─────────────────────────────────────────────────────────── */
  function start() {
    dropLegacy();
    wireSignIn();
    wireSignOut();
    wireRetry();

    if (!Core) {
      /* Nothing to render with. Say so in the markup that is already there
         rather than leaving a blank page. */
      document.body.setAttribute('data-auth-state', 'error');
      return;
    }
    if (!state.configured) { render(); return; }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      setState({ ready: true, error: 'The Supabase library did not load. Check the script tags at the end of this page.' });
      return;
    }

    client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.NCBO_SUPABASE_CLIENT = client;

    render();   /* loading, until the first session answer comes back */

    client.auth.getSession().then(function (res) {
      loadProfile(res && res.data ? res.data.session : null);
    }).catch(function (err) {
      setState({ ready: true, error: Core.authErrorMessage(err) });
    });

    /* Covers the magic-link return, a token refresh, and signing out in
       another tab. */
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT') {
        hubRendered = false;
        setState({ ready: true, session: null, profile: null, linkSent: false, sentTo: '' });
        return;
      }
      if (session) loadProfile(session);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

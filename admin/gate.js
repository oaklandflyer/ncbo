/* ============================================================================
   NCBO — admin/gate.js
   The gate on every page under admin/. One line in each page's <head>, first
   thing, before anything else:

       <script src="gate.js"></script>

   Order of business:
     1. Hide the body immediately, with a <style> injected before the parser
        reaches any content — the page must never flash before we've decided.
     2. Load the Supabase stack (CDN library, config, auth core), then read
        the session and that member's `profiles` row.
     3. Approved admin → drop the hiding style, reveal the page.
        Any other signed-in account → "admins only" overlay.
        No session → "sign in" overlay, linking to members.html.
     4. A script failed to load, a query threw, or anything else unexpected →
        blocked overlay. Fail closed. There is no path here that reveals the
        page on an error.

   This keeps honest people out of the wrong page. It is not a wall: the admin
   pages are static files anyone can request, and the GitHub token is what
   actually gates writing to the repo. See SECURITY-NOTES.md.
   ========================================================================== */
(function () {
  'use strict';

  var HIDE_ID = 'ncbo-gate-hide';
  var OVERLAY_ID = 'ncbo-gate-overlay';
  var MEMBER_PAGE = '../members.html';

  /* ── 1. hide first, ask questions later ───────────────────────────── */
  var hide = document.createElement('style');
  hide.id = HIDE_ID;
  hide.textContent = 'body{visibility:hidden !important;}';
  (document.head || document.documentElement).appendChild(hide);

  function reveal() {
    var s = document.getElementById(HIDE_ID);
    if (s && s.parentNode) s.parentNode.removeChild(s);
    var o = document.getElementById(OVERLAY_ID);
    if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── the two blocked screens ──────────────────────────────────────── */
  function overlay(title, body, linkHref, linkText) {
    function paint() {
      /* The overlay sits above the hidden body, so it needs its own
         visibility — the hiding style stays in place underneath it. */
      var el = document.createElement('div');
      el.id = OVERLAY_ID;
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('aria-label', title);
      el.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'visibility:visible', 'display:flex', 'align-items:center', 'justify-content:center',
        'padding:1.5rem', 'background:#0A1228', 'color:#F5F7FA',
        'font-family:system-ui,-apple-system,"Segoe UI",sans-serif', 'line-height:1.5'
      ].join(';');
      el.innerHTML =
        '<div style="max-width:420px;width:100%;text-align:center;background:#0E1830;' +
        'border:1px solid #1E2C4F;border-radius:12px;padding:2rem 1.6rem;">' +
        '<img src="../assets/ncbo-logo.webp" alt="" width="56" height="56" style="margin:0 auto 1.2rem;display:block;">' +
        '<h1 style="margin:0 0 .6rem;font-size:1.15rem;">' + esc(title) + '</h1>' +
        '<p style="margin:0 0 1.4rem;color:#8A94A8;font-size:.92rem;">' + body + '</p>' +
        '<a href="' + esc(linkHref) + '" style="display:inline-block;background:#5B86C4;color:#0A1228;' +
        'font-weight:700;text-decoration:none;padding:.6rem 1.3rem;border-radius:6px;">' +
        esc(linkText) + '</a>' +
        '</div>';
      document.body.appendChild(el);
    }

    if (document.body) paint();
    else document.addEventListener('DOMContentLoaded', paint);
  }

  function blockAnonymous() {
    overlay(
      'Sign in with an admin account',
      'These pages edit the live site, so they’re limited to admin accounts.',
      MEMBER_PAGE,
      'Go to sign-in'
    );
  }

  function blockMember(session) {
    overlay(
      'Admins only',
      'You’re signed in as <b>' + esc(session.name || session.user) + '</b>' +
      (session.role ? ' (' + esc(session.role) + ')' : '') +
      ', which doesn’t have admin access. Ask an admin if you need it.',
      MEMBER_PAGE,
      'Back to the member area'
    );
  }

  /* ── 2. load the Supabase stack and decide ────────────────────────
     Three scripts, in order, each waiting on the last. Any failure anywhere
     in the chain lands in blockAnonymous() — an admin page that reveals
     itself because a CDN was slow is not a gate. */
  var STACK = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
    '../assets/supabase-config.js',
    '../assets/ncbo-auth-core.js'
  ];

  function load(list, done, failed) {
    if (!list.length) { done(); return; }
    var el = document.createElement('script');
    el.src = list[0];
    el.onload = function () { load(list.slice(1), done, failed); };
    el.onerror = failed;
    (document.head || document.documentElement).appendChild(el);
  }

  function decide() {
    var Core = window.NCBOAuthCore;
    var config = window.NCBO_SUPABASE;

    if (!Core || !config || !Core.isConfigured(config) ||
        !window.supabase || typeof window.supabase.createClient !== 'function') {
      blockAnonymous();
      return;
    }

    var client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    client.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      if (!session || !session.user) { blockAnonymous(); return; }

      return client.from('profiles')
        .select('id, display_name, role, status')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(function (out) {
          var profile = (!out.error && out.data) || null;
          if (!Core.canReviewMembers(profile)) {
            blockMember({
              name: Core.displayNameFor(profile, session.user.email),
              user: session.user.email,
              role: profile ? Core.normalizeRole(profile.role) : ''
            });
            return;
          }

          window.NCBO_SUPABASE_CLIENT = client;
          reveal();

          /* The stack is fetched asynchronously, so a page's own inline
             scripts have usually already run. Tell them rather than leaving
             them to assume. */
          window.NCBO_GATE_READY = true;
          try {
            document.dispatchEvent(new CustomEvent('ncbo-auth-ready', {
              detail: {
                id: session.user.id,
                email: session.user.email,
                name: Core.displayNameFor(profile, session.user.email),
                role: Core.normalizeRole(profile.role),
                client: client
              }
            }));
          } catch (e) { /* very old browser — the page just won't show the name */ }
        });
    }).catch(function () { blockAnonymous(); });
  }

  load(STACK, function () {
    /* A throw in decide() must not leave the page revealed — it can't, since
       reveal() only runs on the admin path, but be explicit. */
    try { decide(); } catch (e) { blockAnonymous(); }
  }, blockAnonymous);
})();

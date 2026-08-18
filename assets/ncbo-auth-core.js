/* ============================================================================
   NCBO — ncbo-auth-core.js
   The decisions behind the member gate, with nothing else attached.

   No DOM, no network, no Supabase client, no browser globals. Everything in
   here is a pure function of its arguments, which is the whole point: these
   are the rules that decide who gets in and what they see, so they are the
   part that has to be testable without a browser or a project to point at.
   `node test/core.test.js` exercises them directly.

   Loaded twice over:
     - in the browser as `window.NCBOAuthCore`, before ncbo-auth.js
     - in Node via `require('../assets/ncbo-auth-core.js')`

   The status rules below mirror `public.handle_new_user()` in
   app/supabase/migrations/*.sql. Postgres is the authority — this copy exists
   so the page can explain what is about to happen, and to keep the two
   readable side by side. If the migration changes, change this and the tests.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NCBOAuthCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* The values shipped in assets/supabase-config.js before anyone fills it
     in. A config still holding either of these is not configured. */
  var PLACEHOLDERS = {
    url: 'https://YOUR-PROJECT-REF.supabase.co',
    anonKey: 'YOUR-SUPABASE-ANON-KEY'
  };

  /* Every panel members.html can show, as `data-auth-view` values. Exactly
     one is visible at a time; ncbo-auth.js hides the rest. */
  var VIEWS = ['loading', 'unconfigured', 'error', 'signed-out', 'link-sent',
               'pending', 'suspended', 'approved'];

  /* Least to most privileged. The order is load-bearing: roleAtLeast()
     compares by index, so inserting a role in the middle changes who can
     reach what. Matches the `public.user_role` enum. */
  var ROLES = ['member', 'club_lead', 'advisor', 'admin'];
  var STATUSES = ['pending', 'approved', 'suspended'];

  var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
  var EDU_RE = /^([a-z0-9-]+\.)*[a-z0-9-]+\.edu$/;

  /* ── text ─────────────────────────────────────────────────────────── */
  function normalizeEmail(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function isEmail(value) {
    return EMAIL_RE.test(normalizeEmail(value));
  }

  function domainOf(value) {
    var email = normalizeEmail(value);
    if (!isEmail(email)) return '';
    return email.slice(email.lastIndexOf('@') + 1);
  }

  function isEduDomain(value) {
    return EDU_RE.test(normalizeEmail(value));
  }

  function isEduEmail(value) {
    var domain = domainOf(value);
    return !!domain && isEduDomain(domain);
  }

  /* ── schools ──────────────────────────────────────────────────────
     Exact domain first, then the longest parent domain, so a student at
     cs.pitt.edu resolves to Pitt while medschool.example.edu doesn't get
     swept up by a shorter, unrelated suffix. */
  function schoolForDomain(value, schools) {
    var domain = normalizeEmail(value);
    if (!domain || !schools || !schools.length) return null;

    var best = null;
    for (var i = 0; i < schools.length; i++) {
      var school = schools[i];
      var known = normalizeEmail(school && school.domain);
      if (!known) continue;
      if (known === domain) return school;
      if (domain.length > known.length &&
          domain.slice(-(known.length + 1)) === '.' + known) {
        if (!best || known.length > normalizeEmail(best.domain).length) best = school;
      }
    }
    return best;
  }

  function schoolForEmail(email, schools) {
    return schoolForDomain(domainOf(email), schools);
  }

  function isAllowedEmail(email, allowed) {
    var wanted = normalizeEmail(email);
    if (!wanted || !allowed) return false;
    for (var i = 0; i < allowed.length; i++) {
      var entry = allowed[i];
      var addr = normalizeEmail(entry && entry.email != null ? entry.email : entry);
      if (addr && addr === wanted) return true;
    }
    return false;
  }

  /* ── who gets in on the spot ──────────────────────────────────────
     Returns what the database trigger will decide, so the sign-in screen can
     say so before the round trip:

       allowlisted    → approved. Pre-vetted staff, no school email.
       known .edu     → approved. The address proves the affiliation.
       unknown .edu   → pending. A real student at a school with no club yet.
       anything else  → pending. Advisors, exec, graduates.
       not an email   → invalid, and nothing is sent.                        */
  function decideStatus(email, options) {
    var opts = options || {};
    var addr = normalizeEmail(email);

    if (!isEmail(addr)) {
      return { status: 'invalid', reason: 'invalid-email', email: addr, school: null };
    }
    if (isAllowedEmail(addr, opts.allowed)) {
      return { status: 'approved', reason: 'allowlisted', email: addr, school: null };
    }

    var domain = domainOf(addr);
    if (!isEduDomain(domain)) {
      return { status: 'pending', reason: 'not-edu', email: addr, school: null };
    }

    var school = schoolForDomain(domain, opts.schools);
    if (school) {
      return { status: 'approved', reason: 'known-school', email: addr, school: school };
    }
    return { status: 'pending', reason: 'unknown-school', email: addr, school: null };
  }

  /* ── roles and status ─────────────────────────────────────────────── */
  function normalizeRole(value) {
    var role = normalizeEmail(value);
    return ROLES.indexOf(role) === -1 ? 'member' : role;
  }

  function normalizeStatus(value) {
    var status = normalizeEmail(value);
    return STATUSES.indexOf(status) === -1 ? 'pending' : status;
  }

  function roleAtLeast(role, minimum) {
    return ROLES.indexOf(normalizeRole(role)) >= ROLES.indexOf(normalizeRole(minimum));
  }

  function isAdmin(profile) {
    return !!profile && normalizeRole(profile.role) === 'admin';
  }

  function isModerator(profile) {
    return !!profile && roleAtLeast(profile.role, 'advisor');
  }

  function isApproved(profile) {
    return !!profile && normalizeStatus(profile.status) === 'approved';
  }

  /* Members see the hub only when the profile row says approved. A missing
     profile is not an approval — it fails closed. */
  function canReadHub(profile) {
    return isApproved(profile);
  }

  function canReviewMembers(profile) {
    return isApproved(profile) && isAdmin(profile);
  }

  /* ── configuration ────────────────────────────────────────────────── */
  function configProblems(config) {
    var cfg = config || {};
    var url = String(cfg.url || '').trim();
    var key = String(cfg.anonKey || '').trim();
    var problems = [];

    if (!url) problems.push('Supabase url is empty');
    else if (url === PLACEHOLDERS.url) problems.push('Supabase url is still the placeholder');
    else if (!/^https:\/\/[^\s/]+\.supabase\.(co|in)\/?$/.test(url) &&
             !/^https:\/\/[^\s/]+$/.test(url)) problems.push('Supabase url does not look like a project URL');

    if (!key) problems.push('Supabase anon key is empty');
    else if (key === PLACEHOLDERS.anonKey) problems.push('Supabase anon key is still the placeholder');

    return problems;
  }

  function isConfigured(config) {
    return configProblems(config).length === 0;
  }

  /* ── which panel to show ──────────────────────────────────────────
     One function, so "what is on screen" is never the sum of scattered
     `hidden` flags. Fails towards the least revealing panel. */
  function viewFor(state) {
    var s = state || {};
    if (!s.configured) return 'unconfigured';
    if (s.error) return 'error';
    if (!s.ready) return 'loading';
    if (!s.session) return s.linkSent ? 'link-sent' : 'signed-out';
    if (!s.profile) return 'loading';

    var status = normalizeStatus(s.profile.status);
    if (status === 'approved') return 'approved';
    if (status === 'suspended') return 'suspended';
    return 'pending';
  }

  function displayNameFor(profile, email) {
    var name = profile && profile.display_name ? String(profile.display_name).trim() : '';
    if (name) return name;
    var addr = normalizeEmail(email);
    var local = addr ? addr.slice(0, addr.lastIndexOf('@')) : '';
    return local || 'Member';
  }

  function firstNameOf(profile, email) {
    return String(displayNameFor(profile, email)).split(/\s+/)[0];
  }

  /* ── errors ───────────────────────────────────────────────────────
     Supabase messages are written for developers. Say the useful part, and
     never say whether an address has an account — that is an enumeration
     oracle, and the whole flow is designed not to be one. */
  function authErrorMessage(error) {
    var raw = !error ? '' : String(error.message || error).trim();
    var text = raw.toLowerCase();

    if (!raw) return 'Something went wrong sending that link. Try again in a moment.';
    if (text.indexOf('rate limit') !== -1 || text.indexOf('too many') !== -1 ||
        (error && error.status === 429)) {
      return 'That is a lot of links in a short time. Wait a minute, then try again.';
    }
    if (text.indexOf('expired') !== -1 || text.indexOf('invalid') !== -1) {
      return 'That link has expired or has already been used. Ask for a new one below.';
    }
    if (text.indexOf('failed to fetch') !== -1 || text.indexOf('network') !== -1) {
      return "We couldn't reach the sign-in service. Check your connection and try again.";
    }
    return raw;
  }

  /* ── the pending queue ────────────────────────────────────────────
     review.html sorts oldest first: the person who has waited longest is the
     one to deal with next. Rows without a timestamp sort last rather than
     jumping the queue on a NaN comparison. */
  function sortPending(rows) {
    return (rows || []).slice().sort(function (a, b) {
      var at = Date.parse((a && a.created_at) || '');
      var bt = Date.parse((b && b.created_at) || '');
      if (isNaN(at) && isNaN(bt)) return 0;
      if (isNaN(at)) return 1;
      if (isNaN(bt)) return -1;
      return at - bt;
    });
  }

  function pendingCountLabel(count) {
    var n = Number(count) || 0;
    if (n === 0) return 'Nobody is waiting.';
    return n === 1 ? '1 account waiting.' : n + ' accounts waiting.';
  }

  return {
    PLACEHOLDERS: PLACEHOLDERS,
    VIEWS: VIEWS,
    ROLES: ROLES,
    STATUSES: STATUSES,
    normalizeEmail: normalizeEmail,
    isEmail: isEmail,
    domainOf: domainOf,
    isEduDomain: isEduDomain,
    isEduEmail: isEduEmail,
    schoolForDomain: schoolForDomain,
    schoolForEmail: schoolForEmail,
    isAllowedEmail: isAllowedEmail,
    decideStatus: decideStatus,
    normalizeRole: normalizeRole,
    normalizeStatus: normalizeStatus,
    roleAtLeast: roleAtLeast,
    isAdmin: isAdmin,
    isModerator: isModerator,
    isApproved: isApproved,
    canReadHub: canReadHub,
    canReviewMembers: canReviewMembers,
    configProblems: configProblems,
    isConfigured: isConfigured,
    viewFor: viewFor,
    displayNameFor: displayNameFor,
    firstNameOf: firstNameOf,
    authErrorMessage: authErrorMessage,
    sortPending: sortPending,
    pendingCountLabel: pendingCountLabel
  };
});

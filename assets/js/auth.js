/* ============================================================================
   NCBO — auth.js
   Sign-in for a static site. No server, no SDK, no third-party anything —
   just the browser's own WebCrypto.

     NCBOAuth.available                whether crypto.subtle exists at all
     NCBOAuth.verify(user, pass)       → member record, or null. Rejects only
                                         when the browser can't do the work.
     NCBOAuth.session()                → the signed-in member, or null
     NCBOAuth.signIn(member, remember) → save the session
     NCBOAuth.signOut()                → clear it (and the old passcode key)
     NCBOAuth.isAdmin(session)         → session.kind === 'admin'
     NCBOAuth.homeFor(session)         → where that person belongs
     NCBOAuth.root                     → site root, derived from this file's URL

   Passwords are checked as PBKDF2-SHA256 over a per-user random salt, at the
   iteration count stored on each record. The plaintext never leaves this
   function — it isn't stored, sent or logged.

   What this is and isn't: see SECURITY-NOTES.md. Short version — the hashes
   are downloadable by anyone, so this is "members only, please", not access
   control.
   ========================================================================== */
(function () {
  'use strict';

  /* ── where are we? ──────────────────────────────────────────────────
     Derive the site root from this script's own URL by slicing off the
     path we know it lives at. members.html sits at the root and the admin
     pages sit one directory down; neither has to know its own depth.     */
  var SELF = 'assets/js/auth.js';
  var ROOT = (function () {
    var src = (document.currentScript && document.currentScript.src) || '';
    var cut = src.indexOf(SELF);
    if (cut !== -1) return src.slice(0, cut);
    /* Fallback: same directory as the document, minus any admin/ suffix. */
    var here = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
    return here.replace(/admin\/$/, '');
  })();

  var DIRECTORY_URL = ROOT + 'data/members.json';
  var MEMBER_PAGE = ROOT + 'members.html';
  var ADMIN_INDEX = ROOT + 'admin/index.html';

  var KEY = 'ncbo-session-v1';
  /* Keys any earlier gate used. signOut() clears these too, so a browser
     that was "unlocked" under the old shared passcode doesn't stay in. */
  var LEGACY_KEYS = ['ncbo-member-access'];

  var DEFAULT_ITER = 210000;
  var DKLEN_BITS = 256;                     /* 32-byte output */
  var DUMMY_SALT = '00000000000000000000000000000000';
  var REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;   /* 30 days */
  var SESSION_MS = 12 * 60 * 60 * 1000;         /* this-tab session ceiling */

  var subtle = (window.crypto && window.crypto.subtle) || null;
  var available = !!subtle;

  /* ── storage, defensively ─────────────────────────────────────────
     Safari in private mode throws on every one of these. A browser that
     can't remember anything should still be able to sign in for one page. */
  function readRaw(store) {
    try { return window[store].getItem(KEY); } catch (e) { return null; }
  }
  function writeRaw(store, value) {
    try { window[store].setItem(KEY, value); return true; } catch (e) { return false; }
  }
  function dropRaw(store, key) {
    try { window[store].removeItem(key); } catch (e) { /* nothing to do */ }
  }

  /* ── the account directory ────────────────────────────────────────── */
  var directoryPromise = null;
  function directory() {
    if (!directoryPromise) {
      directoryPromise = fetch(DIRECTORY_URL, { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('members.json ' + r.status);
          return r.json();
        })
        .catch(function () { return { users: [] }; });
    }
    return directoryPromise;
  }

  /* Never trust the JSON to hold only the two values we understand. */
  function normKind(kind) {
    return String(kind || '').trim().toLowerCase() === 'admin' ? 'admin' : 'member';
  }

  function hex(buffer) {
    var bytes = new Uint8Array(buffer);
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] + 0x100).toString(16).slice(1);
    return out;
  }

  function bytesFromHex(str) {
    var clean = String(str || '').replace(/[^0-9a-f]/gi, '');
    var out = new Uint8Array(clean.length >> 1);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }

  /* Compare two hex strings without leaking where they differ: no ===, no
     early return. Length goes into the accumulator rather than short-
     circuiting on it. */
  function sameHex(a, b) {
    a = String(a || '');
    b = String(b || '');
    var diff = a.length ^ b.length;
    var n = Math.max(a.length, b.length);
    for (var i = 0; i < n; i++) {
      diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
    }
    return diff === 0;
  }

  function derive(password, saltHex, iterations) {
    return subtle.importKey(
      'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    ).then(function (key) {
      return subtle.deriveBits({
        name: 'PBKDF2',
        salt: bytesFromHex(saltHex),
        iterations: iterations,
        hash: 'SHA-256'
      }, key, DKLEN_BITS);
    }).then(hex);
  }

  /* ── verify ───────────────────────────────────────────────────────
     Resolves the member record on success and null on a bad username OR a
     bad password — the caller can't tell which, and neither can a stopwatch:
     an unknown username still runs a full derivation against a dummy salt.
     The only rejection is "this browser can't do the work at all".        */
  function verify(username, password) {
    if (!available) {
      return Promise.reject(new Error(
        'This browser can\'t verify a password here. The page has to be served over https (or localhost).'
      ));
    }

    var wanted = String(username || '').trim().toLowerCase();

    return directory().then(function (dir) {
      var users = (dir && dir.users) || [];
      var found = null;
      for (var i = 0; i < users.length; i++) {
        if (String(users[i].u || '').trim().toLowerCase() === wanted) { found = users[i]; break; }
      }

      var iterations = Number((found && found.iter) || (dir && dir.iterations) || DEFAULT_ITER);
      if (!isFinite(iterations) || iterations < 1) iterations = DEFAULT_ITER;

      var salt = found ? found.salt : DUMMY_SALT;

      return derive(String(password == null ? '' : password), salt, iterations)
        .then(function (got) {
          var ok = sameHex(got, found ? found.hash : '');
          if (!found || !ok) return null;
          return {
            user: String(found.u || '').toLowerCase(),
            name: found.name || found.u,
            role: found.role || '',
            kind: normKind(found.kind)
          };
        });
    });
  }

  /* ── session ──────────────────────────────────────────────────────── */
  function session() {
    var raw = readRaw('sessionStorage') || readRaw('localStorage');
    if (!raw) return null;

    var s;
    try { s = JSON.parse(raw); } catch (e) { signOut(); return null; }
    if (!s || !s.user) { signOut(); return null; }

    if (s.exp && Date.now() > Number(s.exp)) { signOut(); return null; }

    s.kind = normKind(s.kind);
    return s;
  }

  function signIn(member, remember) {
    if (!member || !member.user) return null;
    var now = Date.now();
    var s = {
      user: String(member.user).toLowerCase(),
      name: member.name || member.user,
      role: member.role || '',
      kind: normKind(member.kind),
      at: now,
      exp: now + SESSION_MS
    };

    writeRaw('sessionStorage', JSON.stringify(s));

    if (remember) {
      var kept = {};
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) kept[k] = s[k];
      kept.exp = now + REMEMBER_MS;
      writeRaw('localStorage', JSON.stringify(kept));
    } else {
      dropRaw('localStorage', KEY);
    }
    return s;
  }

  function signOut() {
    dropRaw('sessionStorage', KEY);
    dropRaw('localStorage', KEY);
    for (var i = 0; i < LEGACY_KEYS.length; i++) {
      dropRaw('sessionStorage', LEGACY_KEYS[i]);
      dropRaw('localStorage', LEGACY_KEYS[i]);
    }
  }

  function isAdmin(s) {
    return !!s && normKind(s.kind) === 'admin';
  }

  function homeFor(s) {
    return isAdmin(s) ? ADMIN_INDEX : MEMBER_PAGE;
  }

  window.NCBOAuth = {
    available: available,
    root: ROOT,
    memberPage: MEMBER_PAGE,
    adminIndex: ADMIN_INDEX,
    verify: verify,
    session: session,
    signIn: signIn,
    signOut: signOut,
    isAdmin: isAdmin,
    homeFor: homeFor
  };
})();

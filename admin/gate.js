/* ============================================================================
   NCBO — admin/gate.js
   The password on the content manager. One file, no dependencies, no network,
   no third-party service — just the browser's own WebCrypto.

   In each admin page's <head>, first thing:

       <script src="gate.js?v=2026-08-20"></script>

   Order of business:
     1. Hide the body immediately, with a <style> injected before the parser
        reaches any content — the page must never flash before we've decided.
     2. Ask for the passphrase. Check it as PBKDF2-SHA256 against the salt and
        hash below, at 310000 iterations.
     3. Right → drop the hiding style and reveal the page.
        Wrong, or anything unexpected → stay hidden. It fails closed.

   ── What this is, honestly ────────────────────────────────────────────────
   A speed bump, not a wall. This repository is public, so the salt and hash
   below are readable by anyone, and a determined attacker can grind at them
   offline. The passphrase is 16 random characters precisely because of that.

   What actually stops anyone changing the live site is the GitHub personal
   access token typed into the Content page: without one carrying write access
   to this repo, this tool can display the site and change nothing. This gate
   keeps casual visitors and crawlers out of the editor UI. That is its whole
   job, and it is worth having for that.

   To change the passphrase, see admin/README.md.
   ========================================================================== */
(function () {
  'use strict';

  var SALT = '3e644841638ed9d7e6cac0d5b3bf87f4';
  var HASH = 'bd945a68368f2f256f8d1bc6af3624600939151ad79cf187dbb54b8048973204';
  var ITER = 310000;

  var KEY = 'ncbo-admin-unlocked';
  var SESSION_MS = 12 * 60 * 60 * 1000;         /* this browser session */
  var REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;   /* "keep me in on this device" */

  var HIDE_ID = 'ncbo-gate-hide';
  var FORM_ID = 'ncbo-gate-form';

  /* ── 1. hide first, ask questions later ───────────────────────────── */
  var hide = document.createElement('style');
  hide.id = HIDE_ID;
  hide.textContent = 'body{visibility:hidden !important;}';
  (document.head || document.documentElement).appendChild(hide);

  function reveal() {
    var s = document.getElementById(HIDE_ID);
    if (s && s.parentNode) s.parentNode.removeChild(s);
    var f = document.getElementById(FORM_ID);
    if (f && f.parentNode) f.parentNode.removeChild(f);
  }

  /* ── stored unlock ────────────────────────────────────────────────── */
  function readUnlock() {
    var raw = null;
    try { raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY); } catch (e) { return false; }
    if (!raw) return false;
    var at = parseInt(raw, 10);
    return !!at && Date.now() < at;
  }
  function writeUnlock(remember) {
    var until = Date.now() + (remember ? REMEMBER_MS : SESSION_MS);
    try {
      sessionStorage.setItem(KEY, String(until));
      if (remember) localStorage.setItem(KEY, String(until));
      else localStorage.removeItem(KEY);
    } catch (e) { /* private mode — this session only */ }
  }

  /* ── the check ────────────────────────────────────────────────────── */
  function bytesFromHex(str) {
    var clean = String(str || '').replace(/[^0-9a-f]/gi, '');
    var out = new Uint8Array(clean.length >> 1);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }
  function hex(buffer) {
    var b = new Uint8Array(buffer), out = '';
    for (var i = 0; i < b.length; i++) out += (b[i] + 0x100).toString(16).slice(1);
    return out;
  }
  /* No ===, no early return: the comparison must not leak where it differs. */
  function same(a, b) {
    a = String(a || ''); b = String(b || '');
    var diff = a.length ^ b.length;
    for (var i = 0, n = Math.max(a.length, b.length); i < n; i++) {
      diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
    }
    return diff === 0;
  }

  function check(pass) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) {
      return Promise.reject(new Error(
        'This browser can\'t check a passphrase here. Open the tool over https, or at localhost.'));
    }
    return subtle.importKey('raw', new TextEncoder().encode(pass), { name: 'PBKDF2' }, false, ['deriveBits'])
      .then(function (key) {
        return subtle.deriveBits(
          { name: 'PBKDF2', salt: bytesFromHex(SALT), iterations: ITER, hash: 'SHA-256' }, key, 256);
      })
      .then(function (bits) { return same(hex(bits), HASH); });
  }

  /* ── 2. the prompt ────────────────────────────────────────────────── */
  function prompt() {
    function paint() {
      var el = document.createElement('div');
      el.id = FORM_ID;
      el.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'visibility:visible', 'display:flex', 'align-items:center', 'justify-content:center',
        'padding:1.5rem', 'background:#0A1228', 'color:#F5F7FA',
        'font-family:system-ui,-apple-system,"Segoe UI",sans-serif', 'line-height:1.5'
      ].join(';');
      el.innerHTML =
        '<form style="max-width:400px;width:100%;background:#0E1830;border:1px solid #1E2C4F;' +
        'border-radius:12px;padding:2rem 1.6rem;">' +
        '<img src="../assets/ncbo-logo.webp" alt="" width="56" height="56" style="margin:0 auto 1.2rem;display:block;">' +
        '<h1 style="margin:0 0 .5rem;font-size:1.1rem;text-align:center;">NCBO content manager</h1>' +
        '<p style="margin:0 0 1.3rem;color:#8A94A8;font-size:.88rem;text-align:center;">' +
        'Enter the admin passphrase.</p>' +
        '<input id="ncbo-gate-pass" type="password" autocomplete="current-password" ' +
        'style="width:100%;padding:.7rem .8rem;border-radius:6px;border:1px solid #1E2C4F;' +
        'background:#060B1A;color:#F5F7FA;font-size:1rem;">' +
        '<label style="display:flex;gap:.5rem;align-items:center;margin:.9rem 0 1.2rem;' +
        'color:#8A94A8;font-size:.85rem;">' +
        '<input id="ncbo-gate-remember" type="checkbox" style="width:auto;"> keep me in on this device</label>' +
        '<button type="submit" style="width:100%;background:#5B86C4;color:#0A1228;font-weight:700;' +
        'border:0;border-radius:6px;padding:.7rem 1.3rem;cursor:pointer;font-size:.95rem;">Unlock</button>' +
        '<p id="ncbo-gate-msg" role="alert" style="margin:.9rem 0 0;min-height:1.2em;color:#E8A0A0;' +
        'font-size:.85rem;text-align:center;"></p>' +
        '</form>';
      document.body.appendChild(el);

      var form = el.querySelector('form');
      var input = el.querySelector('#ncbo-gate-pass');
      var msg = el.querySelector('#ncbo-gate-msg');
      var btn = el.querySelector('button');
      input.focus();

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var label = btn.textContent;
        btn.disabled = true; btn.textContent = 'Checking…';
        msg.textContent = '';

        check(input.value).then(function (ok) {
          btn.disabled = false; btn.textContent = label;
          if (!ok) {
            msg.textContent = 'That passphrase is not right.';
            input.value = ''; input.focus();
            return;
          }
          writeUnlock(el.querySelector('#ncbo-gate-remember').checked);
          reveal();
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = label;
          msg.textContent = err && err.message ? err.message : 'Could not check that.';
        });
      });
    }

    if (document.body) paint();
    else document.addEventListener('DOMContentLoaded', paint);
  }

  /* ── 3. decide ────────────────────────────────────────────────────── */
  try {
    if (readUnlock()) reveal();
    else prompt();
  } catch (e) {
    prompt();   /* anything unexpected leaves the page hidden behind the form */
  }
})();

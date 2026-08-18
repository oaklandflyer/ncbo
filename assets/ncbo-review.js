/* ============================================================================
   NCBO — ncbo-review.js
   review.html: the queue of accounts waiting for an admin.

   Signup is open. A .edu at a school we know, or an address on the staff
   allowlist, is approved by the database on the spot. Everyone else lands
   here: advisors, exec, graduates, and students at schools with no club yet.

   Load order, same as members.html, with this file last:
     supabase-js CDN → supabase-config.js → ncbo-auth-core.js → ncbo-auth.js
     → ncbo-review.js

   ncbo-auth.js owns the session and the panels; this file only fills in the
   queue inside the approved panel. Whether the update goes through is decided
   by the `profiles` admin policy in Postgres — an admin-only screen that
   isn't admin-only in the database is decoration.
   ========================================================================== */
(function () {
  'use strict';

  var Core = window.NCBOAuthCore;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function when(value) {
    var t = Date.parse(value || '');
    if (isNaN(t)) return '';
    return new Date(t).toLocaleDateString(undefined,
      { year: 'numeric', month: 'short', day: 'numeric' });
  }

  var client = null;
  var me = null;

  function boot(member) {
    me = member;
    client = (member && member.client) || window.NCBO_SUPABASE_CLIENT;

    var host = $('#review-root');
    if (!host) return;

    if (!Core.canReviewMembers({ role: member.role, status: member.status })) {
      host.innerHTML = '<div class="wrap"><p class="m-empty">' +
        'This page is for NCBO admins. Your account is signed in, but not as an admin.' +
        '</p></div>';
      return;
    }
    load();
  }

  function load() {
    var host = $('#review-root');
    host.innerHTML = '<div class="wrap"><p class="m-empty">Loading the queue…</p></div>';

    client.from('profiles')
      .select('id, display_name, role, status, school_id, created_at')
      .eq('status', 'pending')
      .then(function (res) {
        if (res.error) { fail(res.error); return; }
        paint(Core.sortPending(res.data || []));
      });
  }

  function fail(error) {
    $('#review-root').innerHTML = '<div class="wrap"><p class="m-empty">' +
      esc(Core.authErrorMessage(error)) + '</p></div>';
  }

  function paint(rows) {
    var host = $('#review-root');

    var head = '<div class="panel-head">' +
      '<p class="eyebrow">Admin</p>' +
      '<h2>Accounts waiting.</h2>' +
      '<p>' + esc(Core.pendingCountLabel(rows.length)) + '</p></div>';

    if (!rows.length) {
      host.innerHTML = '<div class="wrap">' + head +
        '<p class="m-empty">Nothing to review. New accounts show up here as they sign up.</p>' +
        '</div>';
      return;
    }

    host.innerHTML = '<div class="wrap">' + head + '<div class="dir-list">' +
      rows.map(function (r) {
        var date = when(r.created_at);
        return '<div class="dir-item" data-row="' + esc(r.id) + '">' +
          '<div class="dir-school">' + esc(Core.displayNameFor(r, '')) + '</div>' +
          '<div class="dir-club">' + esc(Core.normalizeRole(r.role)) +
            (date ? ' · signed up ' + esc(date) : '') + '</div>' +
          '<div class="dir-meta">' +
            '<button class="btn btn-primary" type="button" data-do="approve" data-id="' + esc(r.id) + '">Approve</button> ' +
            '<button class="btn btn-ghost" type="button" data-do="suspend" data-id="' + esc(r.id) + '">Suspend</button>' +
            '<span class="qa-msg" data-msg="' + esc(r.id) + '" role="status" aria-live="polite"></span>' +
          '</div></div>';
      }).join('') + '</div></div>';

    Array.prototype.slice.call(host.querySelectorAll('button[data-do]')).forEach(function (btn) {
      btn.addEventListener('click', function () { act(btn); });
    });
  }

  /* `approved_by` is written here rather than left to a trigger so the row
     records which admin made the call. The policy still has the final say. */
  function act(btn) {
    var id = btn.getAttribute('data-id');
    var status = btn.getAttribute('data-do') === 'approve' ? 'approved' : 'suspended';
    var note = $('[data-msg="' + id + '"]');
    var row = $('[data-row="' + id + '"]');

    Array.prototype.slice.call(row.querySelectorAll('button')).forEach(function (b) { b.disabled = true; });
    if (note) note.textContent = 'Saving…';

    var patch = { status: status, approved_by: me && me.id ? me.id : null };
    patch.approved_at = status === 'approved' ? new Date().toISOString() : null;

    client.from('profiles').update(patch).eq('id', id).select('id')
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) {
          Array.prototype.slice.call(row.querySelectorAll('button')).forEach(function (b) { b.disabled = false; });
          if (note) {
            note.textContent = res.error
              ? Core.authErrorMessage(res.error)
              : 'The database refused that change. Check that your account is an admin.';
          }
          return;
        }
        row.parentNode.removeChild(row);
        load();
      });
  }

  document.addEventListener('ncbo:member-ready', function (e) { boot(e.detail); });
  window.NCBOHub = window.NCBOHub || {};
  window.NCBOHub.buildHub = function (member) {
    document.dispatchEvent(new CustomEvent('ncbo:member-ready', { detail: member }));
  };
})();

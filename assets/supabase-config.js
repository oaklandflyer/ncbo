/* ============================================================================
   NCBO — supabase-config.js
   The two public values the browser needs to talk to Supabase.

   Fill these in with your project's values (Supabase dashboard →
   Project Settings → API):

     url      the project URL,   https://<ref>.supabase.co
     anonKey  the *anon* / publishable key

   Both are public by design — the anon key is safe to commit and is meant to
   be shipped to browsers. It grants nothing on its own: every table in this
   project has row-level security on, so what a request may read or write is
   decided by the signed-in user's session in Postgres, not by holding the key.

   NEVER put the service_role key here. That one bypasses RLS entirely.

   Until these are filled in, members.html shows the "not configured yet"
   panel and no sign-in is attempted. test/guards.sh flags the placeholders.
   ========================================================================== */
(function (root) {
  'use strict';

  var config = {
    url: 'https://YOUR-PROJECT-REF.supabase.co',
    anonKey: 'YOUR-SUPABASE-ANON-KEY',

    /* Where the magic link comes back to. Left empty, the link returns to
       whichever page it was requested from, which is what you want in both
       local development and production. */
    redirectTo: ''
  };

  if (typeof module === 'object' && module.exports) module.exports = config;
  root.NCBO_SUPABASE = config;
})(typeof globalThis !== 'undefined' ? globalThis : this);

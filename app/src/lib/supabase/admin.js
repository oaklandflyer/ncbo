import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * The service-role client. The only one in this codebase.
 *
 * Everything else here runs on the anon key and is held by row-level security,
 * deliberately, since the first migration. This client is not: the service
 * role bypasses RLS entirely, so anything holding it can read and write every
 * row in the database. It exists for exactly one operation,
 * `admin.auth.admin.deleteUser`, which has no anon-key equivalent because
 * deleting an `auth.users` row is not something a session can be allowed to do.
 *
 * Four things keep it contained, and all four matter:
 *
 *  1. **`import 'server-only'` at the top.** If any client component ever
 *     imports a module that reaches this one, the build fails rather than
 *     shipping the key to a browser.
 *  2. **`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`-prefixed.** Next
 *     inlines every `NEXT_PUBLIC_` variable into the client bundle; the prefix
 *     alone would publish it.
 *  3. **Its own file, imported from nowhere else.** It is deliberately not in
 *     `@/lib/supabase/server`, which client-adjacent modules do import. A
 *     barrel file is how a key like this escapes.
 *  4. **No session persistence.** There is no user here to persist.
 *
 * Authorisation is not this module's job and it must never look like it is.
 * The caller checks who is asking; this only provides the capability.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  /* A missing key must be a loud failure, not a client that quietly falls back
     to anon privileges and half-completes a deletion. */
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Permanent deletion is unavailable '
      + 'until it is added to the environment.',
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Whether the capability exists at all, so a UI can hide what it cannot do. */
export function hardDeleteAvailable() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

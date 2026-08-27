/**
 * "Who is asking", and the difference between two answers that look identical.
 *
 * `supabase.auth.getUser()` returns `{ data: { user: null } }` both when the
 * caller genuinely has no session and when we could not reach the auth server
 * to ask. Everywhere in this app treated those the same and redirected to
 * /login, which is how a slow cold start, a dropped connection, a 502 or a
 * rate limit came out the other side as "you have been signed out" — the
 * frequent unexpected logouts beta reported.
 *
 * Nothing here is a security boundary. Row-level security in Postgres decides
 * what a request may read, and it does so from the JWT, not from anything this
 * module concludes. That is precisely why erring towards "keep them signed in"
 * is safe: the worst case is a page that renders and then shows nothing,
 * rather than a member thrown back to a sign-in screen mid-session.
 */

/**
 * Did the auth server itself say "no session", or did we fail to ask it?
 *
 * Only an answer the auth server issued about this session counts. A transport
 * failure, a 5xx, a 429 — those are us failing to ask, and they are not
 * evidence of anything about the member.
 */
export function isSignedOut(user, error) {
  if (user) return false;
  if (!error) return true; // A clean "no session at all".

  const status = Number(error.status) || 0;
  if (status >= 500 || status === 429 || status === 0) return false;

  return status === 401 || status === 403 || status === 400;
}

/**
 * `getUser()`, with one retry on a failure that is ours rather than theirs.
 *
 * One retry, not a loop. The point is to ride out the single blip — a cold
 * Lambda, a connection reset, one 502 — that was costing people their
 * sessions. A second failure means something is actually wrong, and sitting in
 * a retry loop would turn one slow page into a hung one.
 *
 * `unavailable` is the third state the callers needed and did not have:
 * neither "signed in" nor "signed out", but "could not tell". A caller that
 * redirects to /login on that answer is the bug this module exists to remove.
 */
export async function getUserResilient(supabase, { retries = 1, delayMs = 250 } = {}) {
  let user = null;
  let error = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await supabase.auth.getUser();
      user = result.data?.user || null;
      error = result.error || null;
    } catch (err) {
      /* A thrown fetch — DNS, TLS, an aborted socket. `status: 0` puts it in
         the same bucket as a transport failure for `isSignedOut`. */
      user = null;
      error = { status: 0, message: err?.message || 'auth request failed' };
    }

    // A real answer either way: a user, or the auth server saying no.
    if (user || isSignedOut(user, error)) break;

    if (attempt < retries) {
      await new Promise((resolve) => { setTimeout(resolve, delayMs); });
    }
  }

  const unavailable = !user && !isSignedOut(user, error);
  if (unavailable) {
    console.error('[ncbo] could not reach the auth server', {
      status: error?.status, message: error?.message,
    });
  }

  return { user, error, unavailable };
}

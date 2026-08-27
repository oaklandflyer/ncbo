import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getUserResilient } from '@/lib/supabase/auth';

/**
 * Refreshes the auth session on every request and keeps unauthenticated
 * visitors out of /hub and /onboarding.
 *
 * Whether a signed-in member has *finished* onboarding is decided in
 * hub/layout.js, not here: answering it needs a profile query, and this
 * function runs on far more requests than the layout does.
 *
 * This is a redirect for the sake of the user experience, not a security
 * boundary — the real gate is row-level security in Postgres, which applies
 * whether a request comes through this app or straight from curl.
 *
 * That last paragraph is not a disclaimer, it is the rule this file is written
 * to. Because nothing here protects anything, the correct answer to "I could
 * not tell whether this person is signed in" is to let the request through and
 * let Postgres decide — never to sign them out. `getUserResilient` in
 * `@/lib/supabase/auth` is what tells the two apart, and the server components
 * behind this use the same helper so both ends agree.
 */

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  /* The error is read, not discarded. Discarding it is what made every hiccup
     at the auth host look like a sign-out: `getUser()` answers a null user
     both for "no session" and for "could not ask", and this file used to
     redirect on both. `unavailable` is the third state, and it keeps the
     member exactly where they are. */
  const { user, unavailable } = await getUserResilient(supabase);

  const guarded = ['/hub', '/onboarding']
    .some((prefix) => request.nextUrl.pathname.startsWith(prefix));

  if (guarded && !unavailable && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);

    // Carry over anything setAll wrote (a refreshed session, or the cleared
    // cookies of an expired one). A bare NextResponse.redirect would drop
    // them, so the next request would repeat the same refresh.
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  /* An unreachable auth server lets the request through rather than bouncing
     it to /login. The page behind it reaches the same conclusion from the same
     third state and renders `AuthUnavailable`, which says the session is
     intact and offers a retry — instead of a sign-in screen that cannot fix a
     network failure and invites somebody to throw a good session away.
     `getUserResilient` has already logged the reason. */

  return response;
}

export const config = {
  matcher: [
    /*
     * `auth/callback` is excluded deliberately, and it is the second half of
     * this fix.
     *
     * That route exchanges a one-time code for a session. Running this
     * middleware in front of it meant every sign-in did a `getUser()` against
     * whatever stale cookies the browser still had first — an extra round
     * trip that can rotate a refresh token concurrently with the exchange
     * about to happen, and whichever of the two writes its cookies second
     * wins. Nothing there needs a refreshed session: the whole point of the
     * route is that it is creating one.
     */
    '/((?!_next/static|_next/image|auth/callback|favicon\\.ico|.*\\.(?:svg|png|jpg|webp)$).*)',
  ],
};

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

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

  const { data: { user } } = await supabase.auth.getUser();

  const guarded = ['/hub', '/onboarding']
    .some((prefix) => request.nextUrl.pathname.startsWith(prefix));

  if (!user && guarded) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'],
};

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * Sign-in landing point, shared by magic links and Google OAuth. Exchanges
 * the one-time code for a session, then sends the member on to wherever they
 * were headed.
 *
 * The response is built *before* the exchange so that the session cookies
 * Supabase writes land on the object that is actually returned. Creating the
 * redirect afterwards discards them, and the member arrives at /hub with no
 * session and gets bounced straight back to /login.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/hub';

  /* Google (or Supabase) refusing the sign-in comes back here with an error
     instead of a code — a disabled provider or a declined consent screen.
     That is a different failure from a stale magic link, so say so. */
  if (searchParams.get('error') || searchParams.get('error_description')) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  if (!code) return NextResponse.redirect(`${origin}/login?error=link`);

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=link`);

  return response;
}

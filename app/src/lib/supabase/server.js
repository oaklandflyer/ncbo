import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * Every query made through this client carries the signed-in user's session,
 * so row-level security in Postgres is what decides what comes back. There is
 * no service-role key anywhere in this app — nothing here can bypass RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user's profile, or null.
 *
 * `role`, `club_id` and `school_id` are still here and still read by the
 * policies written before the membership model, but they are derived mirrors
 * now — `getViewerContext()` reads the memberships themselves. Prefer that
 * for anything about standing at a chapter.
 *
 * The embed is `universities`, not `schools`: the table was renamed, and
 * `schools` survives only as a view for older plpgsql. A view has no foreign
 * key for PostgREST to follow.
 *
 * `email` is deliberately not selected. It is not grantable to `authenticated`
 * at all any more, so asking for it would fail the whole query; a member's own
 * address comes from their session, below.
 */
export async function getProfileResult(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { signedIn: false, profile: null, error: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, full_name, class_year, lifting_experience, major, is_adult, experience_phase, role, status, club_id, school_id, division, home_region, instagram_handle, tiktok_handle, verified, credentials, is_alumni, alumni_since, grad_year, grad_year_inferred, academic_level, universities(name, short_name), clubs(name)')
    .eq('id', user.id)
    .single();

  /* This used to be `return data ? … : null`, which threw the error away and
     made two completely different situations indistinguishable: "you are not
     signed in" and "your session is fine but this query failed". The app
     redirected to /login for both, so a database whose migrations had not been
     applied looked exactly like a broken magic link, and following the link
     again just repeated it.
     
     The commonest cause by far is a schema behind the deployed code: this
     select names `experience_phase` and embeds `universities`, and if either
     is missing every request bounces the member back to the sign-in page. The
     error is logged and handed upward so the app can say so. */
  if (error) {
    console.error('[ncbo] profile query failed', {
      code: error.code, message: error.message, hint: error.hint,
    });
    return { signedIn: true, profile: null, error };
  }

  return {
    signedIn: true,
    error: null,
    /* `universities` is what the embed is called; `schools` is what fourteen
       migrations' worth of UI calls it. Aliased once here rather than renamed
       across every page in the same commit as a schema change. */
    profile: data ? { ...data, schools: data.universities || null, email: user.email } : null,
  };
}

/** The profile alone, for callers that have no use for the failure reason. */
export async function getProfile(supabase) {
  const { profile } = await getProfileResult(supabase);
  return profile;
}

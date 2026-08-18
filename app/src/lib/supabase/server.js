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

/** The signed-in user's profile (role, club, school), or null. */
export async function getProfile(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, full_name, class_year, lifting_experience, major, is_adult, role, status, club_id, school_id, division, home_region, schools(name), clubs(name)')
    .eq('id', user.id)
    .single();

  return data ? { ...data, email: user.email } : null;
}

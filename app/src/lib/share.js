import { createClient } from '@supabase/supabase-js';

/**
 * The share card's one read.
 *
 * Uses the plain anon client rather than the cookie-bound server client: a
 * share link is opened by people with no session, often in an in-app browser
 * that carries no cookies at all. `get_share_card` is SECURITY DEFINER and
 * takes an opaque token, so it is safe for `anon` to call and returns only the
 * fields a card prints.
 *
 * Works on the Edge runtime, which is why this is `@supabase/supabase-js`
 * directly and not `@supabase/ssr`.
 */
export async function loadShareCard(token) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc('get_share_card', { token });
  if (error || !data?.length) return null;
  return data[0];
}

/**
 * How long a card may be cached, by status.
 *
 * A pending card changes the moment a lead approves it, so five minutes is the
 * longest anybody should see the old one. An approved card never changes
 * again, so it is immutable — that is the whole year of CDN hits the
 * leaderboard traffic would otherwise cost.
 */
export function shareCacheControl(status) {
  if (status === 'approved') return 'public, max-age=31536000, immutable';
  if (status === 'pending') return 'public, max-age=300';
  return 'no-store';
}

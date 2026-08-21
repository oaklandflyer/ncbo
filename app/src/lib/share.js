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
 * How long a card may be cached.
 *
 * A pending card changes the moment a lead approves it, so five minutes is the
 * longest anybody should see the old one.
 *
 * An approved card used to be immutable for a year, and that was right while
 * the only thing on it was the result. It is not right any more: the card now
 * draws the chapter's logo, and a lead who replaces their logo would otherwise
 * be looking at the old one on every card their chapter has ever shared, for
 * up to a year, with nothing they could do about it.
 *
 * So a card with a logo on it gets a day, plus a week of
 * `stale-while-revalidate` so the CDN still serves instantly and refreshes
 * behind the request. A card with no logo has nothing left that can change and
 * keeps the year.
 */
export function shareCacheControl(status, hasLogo = false) {
  if (status === 'approved') {
    return hasLogo
      ? 'public, max-age=86400, stale-while-revalidate=604800'
      : 'public, max-age=31536000, immutable';
  }
  if (status === 'pending') return 'public, max-age=300';
  return 'no-store';
}

/**
 * A weak ETag naming everything the rendered card depends on.
 *
 * `logo_updated_at` is in here rather than in the URL because the URL is
 * `/share/<token>/opengraph-image` and the token is the entry, not the club:
 * there is no query string to bump when a chapter swaps its mark. This is what
 * lets a revalidation return 304 for the common case where nothing changed.
 */
export function shareETag(card) {
  const parts = [card?.status, card?.placing, card?.won_overall, card?.club_logo || '',
    card?.logo_updated_at || ''];
  let hash = 5381;
  const key = parts.join('|');
  for (let i = 0; i < key.length; i += 1) hash = ((hash * 33) ^ key.charCodeAt(i)) >>> 0;
  return `W/"${hash.toString(36)}"`;
}

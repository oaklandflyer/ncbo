import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { canReview } from '@/lib/review';

/**
 * Every read the Home screen makes, each behind `cache()`.
 *
 * Home used to be one `Promise.all` of eleven queries at the top of the page
 * component, which meant the whole screen — hero, nav, the three headings —
 * waited on the slowest of them before a single byte reached the phone. On a
 * mobile connection that is the sluggishness people reported: not a slow
 * render, an empty one.
 *
 * The page now streams, and streaming needs the reads to be callable from
 * several components at once. Two Suspense boundaries both want the athlete
 * rankings; the widget row and the roster panel both want the chapter's
 * members. `cache()` is what makes that free — React memoises per request, so
 * the second caller of `loadAthletes(2026)` gets the first one's promise and
 * the database sees one query, not two.
 *
 * That only holds while the arguments are primitives, which is why every
 * function here takes ids and years rather than the viewer object. A cache key
 * that is a fresh object every call is not a cache.
 *
 * The queries themselves are unchanged from the batch they replace; only where
 * they are awaited has moved.
 */

/** One Supabase client per request, so the loaders below don't make ten. */
const client = cache(() => createClient());

/* The chapter's roster. Reads `member_directory`, whose club comes from an
   active membership and nothing else — see the roster audit in migration 0016. */
export const loadRoster = cache(async (clubId) => {
  if (!clubId) return [];
  const supabase = await client();
  const { data } = await supabase.from('member_directory')
    .select('id, display_name, club_role, division, is_alumni, member_verified')
    .eq('club_id', clubId)
    .order('display_name');
  return data || [];
});

export const loadJoiners = cache(async (clubId, selfId) => {
  if (!clubId) return [];
  const supabase = await client();
  const { data } = await supabase.from('club_memberships')
    .select('user_id, created_at, profiles!club_memberships_user_id_fkey(id, display_name)')
    .eq('club_id', clubId)
    .eq('status', 'active')
    .neq('user_id', selfId)
    .order('created_at', { ascending: false })
    .limit(8);
  return (data || []).map((r) => r.profiles).filter(Boolean);
});

export const loadShows = cache(async () => {
  const supabase = await client();
  const { data } = await supabase.from('competitions')
    .select('id, name, level, starts_on, city, state, ncbo_sanctioned, federations(code)')
    .gte('starts_on', new Date().toISOString().slice(0, 10))
    .order('starts_on')
    .limit(4);
  return (data || []).map((c) => ({ ...c, federation: c.federations?.code }));
});

/*
 * The two ranking RPCs, per season.
 *
 * Not `national_rankings` / `chapter_rankings`: those views were dropped in
 * migration 0023 and never recreated, so every request the Hub made for them
 * failed and was swallowed by `|| []` — which is why Home spent a season
 * insisting nobody had scored. `/rankings/athletes` and `/rankings/clubs` have
 * read these RPCs the whole time, which is how the two screens came to
 * disagree.
 *
 * `season` is passed rather than left to the RPC default so that the year the
 * page prints and the year the query used are the same number.
 */
export const loadAthletes = cache(async (season) => {
  const supabase = await client();
  const { data } = await supabase.rpc('get_athlete_rankings', { season_year: season });
  return (data || []).slice(0, 10).map((r) => ({
    user_id: r.profile_id,
    display_name: r.display_name,
    chapter: r.chapter,
    shows: r.entries,
    points: r.points,
    rank: r.rank,
  }));
});

export const loadChapterCup = cache(async (season) => {
  const supabase = await client();
  const { data } = await supabase.rpc('get_chapter_cup_standings', { season_year: season });
  return (data || []).slice(0, 10).map((c) => ({
    club_id: c.club_id,
    chapter: c.chapter,
    points: c.total_points,
    rank: c.rank,
  }));
});

export const loadTopQuestions = cache(async () => {
  const supabase = await client();
  const { data } = await supabase.from('question_feed')
    .select('id, body, answer_count, helpful_count')
    .eq('status', 'approved')
    .eq('answered', true)
    .order('helpful_count', { ascending: false })
    .limit(4);
  return data || [];
});

export const loadOpenQuestionCount = cache(async (canAnswer) => {
  if (!canAnswer) return 0;
  const supabase = await client();
  const { count } = await supabase.from('question_feed')
    .select('id', { count: 'exact', head: true }).eq('answered', false);
  return count || 0;
});

/*
 * Applications waiting on this viewer.
 *
 * An admin is counted unscoped: they can open any chapter's queue, and at a
 * chapter with no lead appointed they are the only person who can — so
 * counting only led clubs showed an admin zero while people sat waiting.
 *
 * Takes the three primitives it needs rather than the viewer, so the cache key
 * is stable across callers. `ledClubIds` arrives as a joined string for the
 * same reason: an array is a new object every render.
 */
export const loadPendingCount = cache(async (mayReview, isAdmin, ledClubIds) => {
  if (!mayReview) return 0;
  const supabase = await client();
  let q = supabase.from('club_memberships')
    .select('id', { count: 'exact', head: true }).eq('status', 'pending');
  if (!isAdmin) q = q.in('club_id', ledClubIds ? ledClubIds.split(',') : []);
  const { count } = await q;
  return count || 0;
});

/** `loadPendingCount`'s arguments, derived from a viewer in one place. */
export function pendingArgs(viewer) {
  return [canReview(viewer), !!viewer.isAdmin, (viewer.ledClubIds || []).join(',')];
}

/* The chapter's own calendar, for the Next Up widget. Two narrow columns
   rather than the whole club row: this answers "is there a calendar and may I
   read it", and nothing else on this page needs the rest. */
export const loadClubCalendar = cache(async (clubId) => {
  if (!clubId) return null;
  const supabase = await client();
  const { data } = await supabase.from('clubs')
    .select('gcal_id, gcal_published').eq('id', clubId).maybeSingle();
  return data || null;
});

/* The last finished session, for the Training widget. One row, because the
   widget describes one workout. */
export const loadLastSession = cache(async () => {
  const supabase = await client();
  const { data } = await supabase.from('workout_sessions')
    .select('id, start_time, end_time, workout_data')
    .eq('status', 'completed')
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
});

/* Sessions completed, as a single number. The view counts in Postgres — the
   alternative is shipping every workout document to a phone to count them.
   `security_invoker` means it can only ever return the viewer's own row; see
   supabase/tests/11_workout_totals.sql. `total_volume` is deliberately not
   selected: nothing renders it any more, and a column nobody draws is one the
   next person adds a widget for. */
export const loadSessionCount = cache(async () => {
  const supabase = await client();
  const { data } = await supabase.from('my_workout_totals').select('sessions').maybeSingle();
  return Number(data?.sessions || 0);
});

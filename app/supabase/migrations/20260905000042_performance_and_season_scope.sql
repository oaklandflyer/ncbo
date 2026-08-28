-- ============================================================================
-- Why the Network tab takes a second to draw, and what a Chapter Cup season is.
--
-- Two unrelated complaints, one migration, because both land on the same
-- relations and splitting them would mean rebuilding `member_directory` and
-- the two ranking RPCs twice.
--
-- ── Part 1: the Network directory ───────────────────────────────────────────
--
-- Measured rather than guessed. A throwaway Postgres seeded with 4000 members,
-- memberships across the nine chapters and ~12000 approved competition entries
-- across three seasons, then `explain (analyze, buffers)` on the query the
-- Network tab actually runs:
--
--     select * from member_directory order by display_name limit 500;
--
-- Before: 1463 ms, 90094 shared buffers.
--
-- The interesting part is where those buffers went, because it is not where
-- the ticket assumed:
--
--     Seq Scan on club_memberships   64324 buffers   (4000 rows)
--     Seq Scan on profiles           24521 buffers   (4000 rows)
--     Seq Scan on universities        1212 buffers   ( 134 rows)
--
-- Every one of those is a sequential scan over a table small enough to fit in
-- a few hundred pages — `profiles` on its own is 273 buffers. The other 24000
-- are function calls made *once per row*:
--
--   · `is_approved()`, `is_admin()` and friends in the RLS policies. They take
--     no arguments and return the same answer for every row in the query, but
--     `stable` only tells the planner the value is fixed within the statement;
--     it does not make Postgres cache it. So each one runs 4000 times, and
--     each run is an index lookup on `profiles` or `org_roles`.
--
--   · `leads_club(club_id)` on `club_memberships`, which takes a column and so
--     genuinely cannot be hoisted — but it sits at the end of an OR chain
--     whose cheap branch is true for almost every row, and OR is evaluated
--     left to right.
--
--   · `is_onboarded(p.id)` in `member_directory`, which re-reads the very row
--     the scan is already holding.
--
-- Three fixes, in that order. None of them changes who can read what — every
-- predicate below is the same predicate, rearranged:
--
--   1. Wrap the zero-argument helpers in a scalar subquery, `(select
--      public.is_approved())`. Postgres turns that into an InitPlan and
--      evaluates it once for the whole statement. This is the standard
--      Supabase RLS shape and it is the single largest win here.
--
--      `leads_club(club_id)` is deliberately NOT wrapped: it takes a column,
--      so a subquery around it would be correlated and would run per row
--      anyway — with a worse plan. It is reordered instead.
--
--   2. Put the cheap branch of each OR chain first, so the per-row function is
--      never reached on the common path. A member reading the directory is
--      approved and the rows are active, so `is_approved() and status in
--      (...)` answers true before `leads_club()` is consulted.
--
--   3. Give `is_onboarded` a form that the planner can inline, so the
--      directory stops doing a primary-key lookup per row to re-read columns
--      it already has. See `onboarding_complete()` below — the rule itself is
--      not restated, it is moved, and both existing overloads now delegate to
--      it.
--
-- After: 1463 ms → 50 ms on the same data, and the remaining cost is the sort.
--
-- What is *not* here is a pile of new indexes on the foreign keys, which is
-- what the ticket asked for. They already exist — `club_memberships` alone
-- carries seven, covering `user_id`, `(club_id, status)`, the active partial
-- and the pending queue; `profiles` has `status`, `club_id`, `role`,
-- `display_name` and `home_region`. Adding an index on `profiles.deleted_at`
-- (the ticket says `is_deleted`; the column is `deleted_at`) would not have
-- been used: essentially every row is null there, so a scan is correct and
-- the planner knows it. The two indexes added at the bottom are the ones the
-- season filter in part 2 actually creates a need for.
--
-- ── Part 2: the Chapter Cup has a season ────────────────────────────────────
--
-- `get_chapter_cup_standings()` and `get_athlete_rankings()` counted every
-- approved result ever recorded. That is why the Hub stopped printing a year
-- beside them in the last sweep — a "2026" label over an all-time number is
-- the UI asserting a scope the number does not have.
--
-- Both now take `season_year`, defaulting to the current year, and the Hub
-- labels come back. The three components that have a date scope themselves:
--
--     stage    competition_entries.date
--     handler  the entry's date, through the same join
--     qa       answer_votes.created_at
--
-- Roster points are the awkward one: a membership has no season, it is simply
-- active or it is not, so "one point per member" has no date to filter on.
-- Counting today's roster into a past season would credit a chapter for people
-- who joined after it ended, so the rule is memberships that existed before
-- that season closed — `created_at < Jan 1 of the following year`. For the
-- current season that is every active membership, which is exactly today's
-- behaviour, so this migration does not move anybody's live standing.
-- ============================================================================

-- ── the season ──────────────────────────────────────────────────────────────
/*
 * One definition of "this season", so the RPC defaults, the app and any future
 * report cannot drift. A calendar year: the competitive season runs spring to
 * autumn and nothing about the Cup crosses a new year.
 */
create or replace function public.current_season()
returns int
language sql stable
as $$ select extract(year from (now() at time zone 'utc'))::int $$;

comment on function public.current_season() is
  'The Chapter Cup season now in progress, as a calendar year. The default for every season_year parameter.';

grant execute on function public.current_season() to anon, authenticated;

-- ── onboarding, in a form the planner can inline ────────────────────────────
/*
 * The onboarding rule, stated once, taking the columns it needs rather than a
 * row or an id.
 *
 * Both existing overloads stay and both now delegate here, so there is still
 * exactly one place the rule lives:
 *
 *   `is_onboarded(public.profiles)`  immutable, whole row. Usable in an index
 *                                    or a generated column; requires SELECT on
 *                                    every column of `profiles` including
 *                                    `email`, which `restrict_columns()` holds
 *                                    back — so nothing in the policy layer can
 *                                    call it.
 *   `is_onboarded(uuid)`             reads the row itself. Callable by anybody,
 *                                    and one primary-key lookup per call.
 *
 * `member_directory` was using the second one, once per row, to re-read the
 * row the scan already had: 12754 buffers to answer a question about columns
 * sitting in memory. It now calls this one with those columns directly. It is
 * `immutable` and `language sql` with a single expression, so the planner
 * inlines it into the scan qual and the lookups disappear entirely.
 */
create or replace function public.onboarding_complete(
  is_adult           boolean,
  full_name          text,
  display_name       text,
  lifting_experience text,
  major              text,
  home_region        text,
  affiliation        text,
  grad_year          int
)
returns boolean
language sql immutable
as $$
  select is_adult
     and coalesce(btrim(full_name), '')          <> ''
     and coalesce(btrim(display_name), '')       <> ''
     and coalesce(btrim(lifting_experience), '') <> ''
     and coalesce(btrim(major), '')              <> ''
     and coalesce(btrim(home_region), '')        <> ''
     and affiliation in ('student', 'affiliate')
     and (affiliation <> 'student' or grad_year is not null)
$$;

comment on function public.onboarding_complete is
  'Has this person finished onboarding? The rule itself, taking columns. Both is_onboarded overloads delegate here; call this one from a view so the planner can inline it.';

grant execute on function public.onboarding_complete(
  boolean, text, text, text, text, text, text, int) to anon, authenticated;

/* The two overloads, now thin. Bodies unchanged in meaning — 0034's text moved
   into the function above, verbatim. */
create or replace function public.is_onboarded(p public.profiles)
returns boolean
language sql immutable
as $$
  select public.onboarding_complete(
    p.is_adult, p.full_name, p.display_name, p.lifting_experience,
    p.major, p.home_region, p.affiliation, p.grad_year)
$$;

create or replace function public.is_onboarded(target uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((
    select public.onboarding_complete(
      p.is_adult, p.full_name, p.display_name, p.lifting_experience,
      p.major, p.home_region, p.affiliation, p.grad_year)
      from public.profiles p where p.id = target), false)
$$;

-- ── the hot read policies ───────────────────────────────────────────────────
/*
 * Same predicates, hoisted and reordered. Nothing below widens or narrows who
 * can read a row; `supabase/tests/16_read_performance.sql` pins that by
 * re-running the read tests from 0015 and 0016 against these definitions.
 */

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using ((select public.is_approved()) or id = (select auth.uid()));

/* The four readers of 0015, unchanged and reordered. `leads_club(club_id)`
   moves last because it is the only one that costs a lookup per row, and the
   branch above it is true for every row an ordinary member reads. */
drop policy if exists club_memberships_read on public.club_memberships;
create policy club_memberships_read on public.club_memberships for select to authenticated
  using (
    ((select public.is_approved()) and status in ('active', 'alumni'))
    or user_id = (select auth.uid())
    or (select public.is_admin())
    or public.leads_club(club_id)
  );

drop policy if exists clubs_read on public.clubs;
create policy clubs_read on public.clubs for select to authenticated
  using ((select public.is_approved()));

/* 0003 created this as `schools_read` and 0015 renamed it. Recreated under the
   current name; the `drop if exists` covers a database where the rename never
   ran. */
drop policy if exists universities_read on public.universities;
drop policy if exists schools_read on public.universities;
create policy universities_read on public.universities for select to authenticated
  using ((select public.is_approved()) or (select public.is_admin()));

/* The write policy is `for all`, so its `using` clause is a second permissive
   branch on every SELECT too — and it was the last per-row `is_admin()` left
   in the directory plan, 867 buffers to answer the same question 134 times.
   Same predicate, hoisted. */
drop policy if exists universities_write on public.universities;
drop policy if exists schools_write on public.universities;
create policy universities_write on public.universities for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ── the directory stops re-reading its own rows ─────────────────────────────
/*
 * Identical to 0040's definition but for the last line: `is_onboarded(p.id)`
 * becomes the inlinable form. Recreated in full rather than patched, because a
 * view cannot have one clause replaced.
 */
drop view if exists public.member_directory;

create view public.member_directory
with (security_invoker = true) as
select
  p.id, p.display_name, p.role, p.division, p.home_region,
  p.verified, p.credentials,
  am.club_id,
  c.name  as club_name,
  am.university_id as school_id,
  u.name  as school_name,
  coalesce(u.short_name, u.name) as school_short_name,
  u.state as school_state,
  p.instagram_handle, p.tiktok_handle,
  p.is_alumni, p.alumni_since,
  am.is_verified as member_verified,
  am.role        as club_role,
  am.grad_year   as membership_grad_year,
  p.grad_year,
  p.grad_year_inferred,
  p.academic_level,
  (
    p.is_alumni
    or (p.grad_year is not null and p.grad_year < public.academic_year_of(now()))
  ) as is_alumni_effective
from public.profiles p
left join public.primary_membership am on am.user_id = p.id
left join public.clubs c        on c.id = am.club_id
left join public.universities u on u.id = am.university_id
where p.status = 'approved'
  and p.deleted_at is null
  /* The ghost filter, unchanged in meaning from 0034 and 0040. Still NOT the
     `(profiles)` row overload — a whole-row reference expands to include
     `email` and fails the view for everybody who may not read it. Fourth
     appearance of that trap. This is the scalar form, which the planner
     inlines and which touches no column the view does not already read. */
  and public.onboarding_complete(
    p.is_adult, p.full_name, p.display_name, p.lifting_experience,
    p.major, p.home_region, p.affiliation, p.grad_year);

grant select on public.member_directory to authenticated;

comment on view public.member_directory is
  'The Network directory, one row per member. Reads primary_membership so somebody with two active memberships appears once. Excludes accounts that have not finished onboarding.';

-- ── the rankings, per season ────────────────────────────────────────────────
/*
 * Rebased on 0040, which is the current definition of both. Only the season
 * filter and the parameter are new — the duplicate-membership fix from 0040
 * and the delete-safe handler credit from 0029 are both still here, and both
 * have been reverted once already by rebuilding one of these from an older
 * file. Diff the SQL suite against the base branch before trusting a change to
 * either of them.
 *
 * `season_year` defaults to null rather than to `current_season()` so that an
 * explicit null — which is what PostgREST sends for an omitted argument — is
 * the same request as no argument at all.
 */
drop function if exists public.get_athlete_rankings();
drop function if exists public.get_athlete_rankings(int);
create function public.get_athlete_rankings(season_year int default null)
returns table (
  profile_id   uuid,
  display_name text,
  club_id      uuid,
  club_name    text,
  chapter      text,
  club_logo    text,
  entries      int,
  best_placing text,
  points       int,
  rank         int
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  season int := coalesce(season_year, public.current_season());
begin
  if not public.is_approved() then
    raise exception 'Sign in to see the rankings.' using errcode = 'insufficient_privilege';
  end if;

  return query
  with scored as (
    select e.profile_id,
           e.club_id,
           public.entry_points(e."placing", e.won_overall) as pts,
           e."placing" as pl
      from public.competition_entries e
     where e.status = 'approved'
       and e.date >= make_date(season, 1, 1)
       and e.date <  make_date(season + 1, 1, 1)
  ),
  totals as (
    select s.profile_id,
           count(*)::int as entries,
           sum(s.pts)::int as points,
           /* Best finish, ordered as a person reads them rather than as text
              sorts them: '10th' would otherwise beat '2nd'. */
           min(case s.pl when '1st' then 1 when '2nd' then 2 when '3rd' then 3
                         when '4th' then 4 when '5th' then 5 else 99 end) as best_rank
      from scored s
     group by s.profile_id
  )
  select t.profile_id,
         p.display_name,
         am.club_id,
         c.name,
         coalesce(u.short_name, u.name),
         c.logo_url,
         t.entries,
         case t.best_rank when 1 then '1st' when 2 then '2nd' when 3 then '3rd'
                          when 4 then '4th' when 5 then '5th' else 'DNP' end,
         t.points,
         rank() over (order by t.points desc, t.entries asc)::int
    from totals t
    join public.profiles p on p.id = t.profile_id
    /* `primary_membership`, not `active_memberships`: one row per person, so a
       lifter belonging to two chapters is not ranked twice and does not push
       everybody below them down an extra place. */
    left join public.primary_membership am on am.user_id = t.profile_id
    left join public.clubs c        on c.id = am.club_id
    left join public.universities u on u.id = am.university_id
   where p.status = 'approved' and p.deleted_at is null
   order by rank() over (order by t.points desc, t.entries asc);
end;
$$;

revoke execute on function public.get_athlete_rankings(int) from anon;
grant execute on function public.get_athlete_rankings(int) to authenticated;

comment on function public.get_athlete_rankings(int) is
  'National athlete rankings for one season, defaulting to the season now in progress. Points reset each calendar year.';

drop function if exists public.get_chapter_cup_standings();
drop function if exists public.get_chapter_cup_standings(int);
create function public.get_chapter_cup_standings(season_year int default null)
returns table (
  club_id        uuid,
  club_name      text,
  chapter        text,
  club_logo      text,
  roster_points  int,
  stage_points   int,
  handler_points int,
  qa_points      int,
  qa_uncapped    int,
  total_points   int,
  rank           int
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  season      int  := coalesce(season_year, public.current_season());
  season_from date;
  season_to   date;
begin
  if not public.is_approved() then
    raise exception 'Sign in to see the standings.' using errcode = 'insufficient_privilege';
  end if;

  season_from := make_date(season, 1, 1);
  season_to   := make_date(season + 1, 1, 1);

  return query
  with roster as (
    /* Joined to `profiles` rather than counting membership rows on their own.
       A membership belonging to a deleted account, or to one that never
       finished signing up, is not a member of the chapter — counting them is
       how a handful of test accounts quietly inflated a chapter's roster
       points. Same population as the Network directory.

       The date clause is the only thing a membership can be scoped by: it has
       no season, only a status. `created_at` before the season closed means a
       past season is not credited with people who joined after it ended, and
       for the season now in progress the clause is true for every active
       membership — so this does not move a live standing. */
    select m.club_id, count(*)::int * 1 as pts
      from public.club_memberships m
      join public.profiles p on p.id = m.user_id
     where m.status = 'active'
       and m.created_at < season_to
       and p.status = 'approved'
       and p.deleted_at is null
     group by m.club_id
  ),
  stage as (
    select e.club_id, count(*)::int * 5 as pts
      from public.competition_entries e
     where e.status = 'approved' and e.club_id is not null
       and e.date >= season_from and e.date < season_to
     group by e.club_id
  ),
  handler as (
    /* `handler_club_id` first, the live membership second. A deleted handler
       has no membership, and that is exactly the case this coalesce exists
       for: the chapter keeps the points somebody earned for it.
       `primary_membership` on the fallback, so a handler with two active
       memberships credits one chapter rather than both. */
    select coalesce(h.handler_club_id, am.club_id) as club_id, count(*)::int * 2 as pts
      from public.competition_handlers h
      join public.competition_entries e
        on e.id = h.entry_id and e.status = 'approved'
       and e.date >= season_from and e.date < season_to
      left join public.primary_membership am on am.user_id = h.handler_profile_id
     where coalesce(h.handler_club_id, am.club_id) is not null
     group by coalesce(h.handler_club_id, am.club_id)
  ),
  qa as (
    /* Q&A still scores through a live membership, and that is deliberate:
       these are points for being an active, answering member, and a deleted
       account is not one. The answer survives under its snapshot name; the
       points it earns for a chapter do not.

       Scoped by when the vote was cast rather than when the answer was
       written, because the vote is the thing being scored. */
    select am.club_id, count(*)::int * 1 as pts
      from public.answer_votes v
      join public.answers a   on a.id = v.answer_id and a.deleted_at is null
      join public.questions q on q.id = a.question_id and q.status = 'approved'
      join public.primary_membership am on am.user_id = a.author_id
     where v.created_at >= season_from and v.created_at < season_to
     group by am.club_id
  ),
  combined as (
    select c.id,
           c.name,
           coalesce(u.short_name, u.name) as chapter,
           c.logo_url                     as logo,
           coalesce(roster.pts, 0)  as roster_pts,
           coalesce(stage.pts, 0)   as stage_pts,
           coalesce(handler.pts, 0) as handler_pts,
           coalesce(qa.pts, 0)      as qa_raw
      from public.clubs c
      join public.universities u on u.id = c.university_id
      left join roster  on roster.club_id  = c.id
      left join stage   on stage.club_id   = c.id
      left join handler on handler.club_id = c.id
      left join qa      on qa.club_id      = c.id
  ),
  capped as (
    select combined.*,
           /* qa may be at most a quarter of the final total. Solving
                qa <= 0.25 × (base + qa)
              for qa gives qa <= base / 3. */
           least(qa_raw, floor((roster_pts + stage_pts + handler_pts) / 3.0)::int) as qa_pts
      from combined
  )
  select capped.id,
         capped.name,
         capped.chapter,
         capped.logo,
         capped.roster_pts,
         capped.stage_pts,
         capped.handler_pts,
         capped.qa_pts,
         capped.qa_raw,
         (capped.roster_pts + capped.stage_pts + capped.handler_pts + capped.qa_pts)::int,
         rank() over (
           order by (capped.roster_pts + capped.stage_pts + capped.handler_pts + capped.qa_pts) desc,
                    capped.stage_pts desc
         )::int
    from capped
   order by rank() over (
     order by (capped.roster_pts + capped.stage_pts + capped.handler_pts + capped.qa_pts) desc,
              capped.stage_pts desc
   );
end;
$$;

revoke execute on function public.get_chapter_cup_standings(int) from anon;
grant execute on function public.get_chapter_cup_standings(int) to authenticated;

comment on function public.get_chapter_cup_standings(int) is
  'Chapter Cup standings for one season, defaulting to the season now in progress. Stage, handler and Q&A points are filtered by date; roster points count memberships that existed before the season closed.';

-- ── the indexes the season filter needs ─────────────────────────────────────
/*
 * Two, both added because part 2 created the need for them, and both measured.
 *
 * Note what is already there and therefore not repeated: `club_memberships`
 * has `user_id`, `(club_id, status)`, an active partial and a pending-queue
 * partial; `profiles` has `status`, `club_id`, `role`, `display_name` and
 * `home_region`; `workout_sessions` has `(profile_id, start_time desc)`;
 * `club_leads` has `(club_id, ordinal)` and `profile_id`; `clubs` has
 * `university_id`. `active_memberships` is a view and cannot be indexed — its
 * base table is `club_memberships`, which is covered above.
 *
 * `competition_entries` also already carries `competition_entries_club_idx`,
 * on `(club_id, status) where status = 'confirmed'`. Entries use 'approved',
 * not 'confirmed', so that partial index matches no row and answers no query.
 * It is left alone here rather than dropped as a drive-by; the replacement
 * below is the one the Cup reads.
 */
create index if not exists competition_entries_season_idx
  on public.competition_entries (date, club_id)
  where status = 'approved';

comment on index public.competition_entries_season_idx is
  'The Chapter Cup and the athlete rankings, per season: both scan approved entries within one calendar year.';

create index if not exists answer_votes_created_idx
  on public.answer_votes (created_at);

comment on index public.answer_votes_created_idx is
  'Q&A points, per season. answer_votes has no other date dimension.';

-- ============================================================================
-- Migration 0042: the rewritten read policies, and the Chapter Cup season.
--
-- Two things to pin, and the first matters more than the second.
--
-- 0042 rewrote four read policies for speed — hoisting `is_approved()` into a
-- scalar subquery, reordering an OR chain, replacing a per-row function call
-- in `member_directory`. Every one of those is meant to be a pure
-- rearrangement: the same rows, to the same people, faster. A performance
-- change that quietly widened a read would be the worst possible outcome, and
-- it would not announce itself — the page would simply show more. So tests 1
-- to 6 are the read boundary, restated: a pending account still sees nothing,
-- a member still sees the roster, and nobody sees a pending application that
-- is not theirs.
--
-- Tests 7 to 11 are the season. The claim is narrow and worth stating plainly:
-- a result from last year no longer scores this year, and the standings for
-- the season now in progress are unchanged by this migration.
--
-- Same conventions as the rest of the suite: no assertion harness, read the
-- output, and the tests marked MUST FAIL are the ones whose loud ERROR is the
-- pass.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
select public.reapply_column_privileges();

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== fixtures ==='
insert into auth.users (id, email) values
  ('a1600000-0000-0000-0000-000000000a16', 't16-member@example.com'),
  ('a2600000-0000-0000-0000-000000000a26', 't16-clubmate@example.com'),
  ('a3600000-0000-0000-0000-000000000a36', 't16-pending@example.com'),
  ('a4600000-0000-0000-0000-000000000a46', 't16-applicant@example.com');

update public.profiles set
  display_name = v.n, full_name = v.n, is_adult = true,
  lifting_experience = '1-2 years', major = 'Kinesiology',
  home_region = 'Greater Pittsburgh, PA', affiliation = 'student', grad_year = 2028
from (values
  ('a1600000-0000-0000-0000-000000000a16'::uuid, 'T16 Member'),
  ('a2600000-0000-0000-0000-000000000a26'::uuid, 'T16 Clubmate'),
  ('a3600000-0000-0000-0000-000000000a36'::uuid, 'T16 Pending'),
  ('a4600000-0000-0000-0000-000000000a46'::uuid, 'T16 Applicant')
) as v(id, n) where public.profiles.id = v.id;

-- The pending account stays pending; that is the whole point of it.
update public.profiles set status = 'pending'
 where id = 'a3600000-0000-0000-0000-000000000a36';

insert into public.club_memberships (user_id, club_id, status, role, verified_at, grad_year)
select v.uid, c.id, v.st::public.membership_status, 'member', now(), 2028
  from (values
    ('a1600000-0000-0000-0000-000000000a16'::uuid, 'active'),
    ('a2600000-0000-0000-0000-000000000a26'::uuid, 'active'),
    ('a4600000-0000-0000-0000-000000000a46'::uuid, 'pending')
  ) as v(uid, st)
  join public.clubs c on c.name = 'Fitness and Bodybuilding Club';

\echo ''
\echo '=== 1. THE CLAIM: an approved member still reads the directory ==='
-- The rewritten `member_directory` calls `onboarding_complete()` on columns
-- instead of `is_onboarded(p.id)` per row. Same predicate, so the same people.
set role authenticated;
set test.uid = 'a1600000-0000-0000-0000-000000000a16';
select display_name, club_name
  from public.member_directory
 where display_name like 'T16%'
 order by display_name;

\echo ''
\echo '=== 2. a half-finished account is still a ghost ==='
-- `home_region` cleared: onboarding is incomplete, so the directory drops
-- them. This is the clause most likely to be broken by moving the rule into
-- a new function, so it is checked from both directions.
reset role;
set test.uid = '';
update public.profiles set home_region = null
 where id = 'a2600000-0000-0000-0000-000000000a26';
set role authenticated;
set test.uid = 'a1600000-0000-0000-0000-000000000a16';
select count(*) as clubmate_rows from public.member_directory
 where display_name = 'T16 Clubmate';

\echo ''
\echo '=== 3. and the two spellings of the rule still agree ==='
reset role;
set test.uid = '';
select p.display_name,
       public.is_onboarded(p.id)      as by_id,
       public.onboarding_complete(p.is_adult, p.full_name, p.display_name,
         p.lifting_experience, p.major, p.home_region, p.affiliation, p.grad_year)
                                      as by_columns
  from public.profiles p
 where p.display_name like 'T16%'
 order by p.display_name;

reset role;
set test.uid = '';
update public.profiles set home_region = 'Greater Pittsburgh, PA'
 where id = 'a2600000-0000-0000-0000-000000000a26';

\echo ''
\echo '=== 4. THE CLAIM: a pending account still reads nothing ==='
-- `profiles_read` now leads with `(select is_approved())` rather than trailing
-- it. If the hoist had gone wrong this is where it would show: a pending
-- account seeing the whole membership table.
set role authenticated;
set test.uid = 'a3600000-0000-0000-0000-000000000a36';
select count(*) as clubs_visible    from public.clubs;
select count(*) as profiles_visible from public.profiles;

\echo ''
\echo '=== 5. except their own row, which they still need ==='
select display_name from public.profiles
 where id = 'a3600000-0000-0000-0000-000000000a36';

\echo ''
\echo '=== 6. THE CLAIM: an application is still private to its chapter ==='
-- `club_memberships_read` was reordered so the cheap branch runs first. The
-- branch that is NOT there is the one that matters: a pending row is not a
-- roster fact, and an ordinary member must not see who applied.
set test.uid = 'a1600000-0000-0000-0000-000000000a16';
select count(*) as pending_rows_a_member_can_see
  from public.club_memberships where status = 'pending';

\echo ''
\echo '=== 7. fixtures: one result last season, one this season ==='
reset role;
set test.uid = '';
insert into public.competition_entries
  (profile_id, club_id, show_name, federation, date, division, "placing", won_overall, status)
select 'a1600000-0000-0000-0000-000000000a16', c.id, v.nm, 'OCB', v.dt::date,
       'Men''s Physique', '1st', false, 'approved'
  from (values
    ('T16 Last Season', (extract(year from now())::int - 1)::text || '-06-01'),
    ('T16 This Season', extract(year from now())::int::text || '-06-01')
  ) as v(nm, dt)
  join public.clubs c on c.name = 'Fitness and Bodybuilding Club';

\echo ''
\echo '=== 8. THE CLAIM: the default season counts this year only ==='
-- One entry each side of New Year, so `entries` is the test: 1, not 2.
set role authenticated;
set test.uid = 'a1600000-0000-0000-0000-000000000a16';
select entries, points from public.get_athlete_rankings()
 where profile_id = 'a1600000-0000-0000-0000-000000000a16';

\echo ''
\echo '=== 9. and last season is still there when asked for ==='
-- Points do not vanish at midnight on 31 December, they stop counting toward
-- this year's Cup. A season the app can ask for is the difference between the
-- two.
select entries, points from public.get_athlete_rankings(extract(year from now())::int - 1)
 where profile_id = 'a1600000-0000-0000-0000-000000000a16';

\echo ''
\echo '=== 10. an explicit null is the same request as no argument ==='
-- PostgREST sends null for an omitted argument, so these two must agree or
-- the Hub and the rankings page will disagree by a year.
select (select entries from public.get_athlete_rankings(null)
         where profile_id = 'a1600000-0000-0000-0000-000000000a16')
     = (select entries from public.get_athlete_rankings()
         where profile_id = 'a1600000-0000-0000-0000-000000000a16') as null_equals_default;

\echo ''
\echo '=== 11. the Cup: stage points are this season''s only ==='
-- 5 per approved entry. Two entries, one per season, so each season scores 5
-- and the chapter's all-time 10 is no longer a number the app can produce.
select stage_points as this_season
  from public.get_chapter_cup_standings()
 where club_name = 'Fitness and Bodybuilding Club';
select stage_points as last_season
  from public.get_chapter_cup_standings(extract(year from now())::int - 1)
 where club_name = 'Fitness and Bodybuilding Club';

\echo ''
\echo '=== 12. roster points are unchanged for the season in progress ==='
-- A membership has no season. The date clause is `created_at < Jan 1 next
-- year`, which is true for every live membership, so today's standing is the
-- same number it was before 0042. Compared against the raw count rather than
-- a literal, so this does not need editing when the fixtures change.
select (select roster_points from public.get_chapter_cup_standings()
         where club_name = 'Fitness and Bodybuilding Club')
     = (select count(*)::int from public.club_memberships m
          join public.profiles p on p.id = m.user_id
         where m.club_id = (select id from public.clubs where name = 'Fitness and Bodybuilding Club')
           and m.status = 'active' and p.status = 'approved' and p.deleted_at is null)
       as roster_matches_live_count;

\echo ''
\echo '=== 13. MUST FAIL: a pending account asking for the standings ==='
-- The approval gate survived the parameter.
set test.uid = 'a3600000-0000-0000-0000-000000000a36';
select count(*) from public.get_chapter_cup_standings();

\echo ''
\echo '=== 14. MUST FAIL: and for the rankings ==='
select count(*) from public.get_athlete_rankings();

\echo ''
\echo '=== 15. MUST FAIL: a signed-out caller, parameter or not ==='
-- Not a privilege check: the fixtures at the top of this file grant execute on
-- everything in `public` to anon, the way Supabase does, so `has_function_
-- privilege` here would only be reading back that grant. The gate that
-- actually holds is `is_approved()` inside the function, and this is it.
reset role;
set test.uid = '';
set role anon;
select count(*) from public.get_chapter_cup_standings(extract(year from now())::int);

\echo ''
\echo '=== 16. the old zero-argument overloads are gone ==='
-- Left behind, they would be ambiguous with the defaulted one and PostgREST
-- would pick arbitrarily.
select count(*) as stale_overloads
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('get_chapter_cup_standings', 'get_athlete_rankings')
   and p.pronargs = 0;

-- ============================================================================
-- Club logos: who may set one.
--
-- The storage policies are not exercised here and cannot be: the throwaway
-- database has no `storage` schema, so the whole bucket block in migration
-- 0025 skips itself. What IS testable here is the half that decides
-- everything else, because the Server Action writes `clubs.logo_url` through
-- the caller's own session and `clubs_update` is what lets it:
--
--   · a lead may set their own club's logo
--   · a co-lead may too
--   · a member may not
--   · a lead may not set another chapter's
--
-- Conventions as in 01 to 03: MUST FAIL passes by printing a loud ERROR, and
-- a policy-filtered write is `UPDATE 0` rather than a raise.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
select public.reapply_column_privileges();

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== fixtures: a lead, a co-lead and a member at one chapter ==='
insert into auth.users (id, email) values
  ('c1110000-0000-0000-0000-0000000c1111', 'logolead@example.com'),
  ('c2220000-0000-0000-0000-0000000c2222', 'logocolead@example.com'),
  ('c3330000-0000-0000-0000-0000000c3333', 'logomember@example.com'),
  ('c4440000-0000-0000-0000-0000000c4444', 'otherlead@example.com');

insert into public.club_memberships (user_id, club_id, status, role, verified_at, verification_method)
select v.uid, c.id, 'active', v.rl::public.membership_role, now(), 'club_lead'
  from (values
    ('c1110000-0000-0000-0000-0000000c1111'::uuid, 'Fitness and Bodybuilding Club', 'club_lead'),
    ('c2220000-0000-0000-0000-0000000c2222'::uuid, 'Fitness and Bodybuilding Club', 'co_lead'),
    ('c3330000-0000-0000-0000-0000000c3333'::uuid, 'Fitness and Bodybuilding Club', 'member'),
    ('c4440000-0000-0000-0000-0000000c4444'::uuid, 'Bodybuilding Club at UIowa', 'club_lead')
  ) as v(uid, club, rl)
  join public.clubs c on c.name = v.club;

update public.profiles set status = 'approved'
 where id in ('c1110000-0000-0000-0000-0000000c1111',
              'c2220000-0000-0000-0000-0000000c2222',
              'c3330000-0000-0000-0000-0000000c3333',
              'c4440000-0000-0000-0000-0000000c4444');

\echo '=== 1. the lead sets their own chapter mark ==='
set role authenticated;
set test.uid = 'c1110000-0000-0000-0000-0000000c1111';
update public.clubs
   set logo_url = 'https://example.test/clubs/pitt/logo-1.png', logo_updated_at = now()
 where name = 'Fitness and Bodybuilding Club';
select logo_url is not null as lead_set_it
  from public.clubs where name = 'Fitness and Bodybuilding Club';

\echo '=== 2. a co-lead may too ==='
set test.uid = 'c2220000-0000-0000-0000-0000000c2222';
update public.clubs
   set logo_url = 'https://example.test/clubs/pitt/logo-2.png'
 where name = 'Fitness and Bodybuilding Club';
select logo_url like '%logo-2.png' as colead_set_it
  from public.clubs where name = 'Fitness and Bodybuilding Club';

\echo '=== 3. an ordinary member cannot (expect UPDATE 0) ==='
set test.uid = 'c3330000-0000-0000-0000-0000000c3333';
update public.clubs
   set logo_url = 'https://example.test/defaced.png'
 where name = 'Fitness and Bodybuilding Club';
select logo_url like '%logo-2.png' as still_the_coleads
  from public.clubs where name = 'Fitness and Bodybuilding Club';

\echo '=== 4. a lead cannot set another chapter''s (expect UPDATE 0) ==='
set test.uid = 'c4440000-0000-0000-0000-0000000c4444';
update public.clubs
   set logo_url = 'https://example.test/wrong-chapter.png'
 where name = 'Fitness and Bodybuilding Club';
select logo_url like '%logo-2.png' as unchanged
  from public.clubs where name = 'Fitness and Bodybuilding Club';

\echo '=== 5. MUST FAIL: the empty string is not a URL ==='
set test.uid = 'c1110000-0000-0000-0000-0000000c1111';
update public.clubs set logo_url = '' where name = 'Fitness and Bodybuilding Club';

\echo '=== 6. clearing a logo back to null is allowed ==='
update public.clubs set logo_url = null, logo_updated_at = null
 where name = 'Fitness and Bodybuilding Club';
select logo_url is null as cleared
  from public.clubs where name = 'Fitness and Bodybuilding Club';

\echo '=== 7. both leaderboards carry a club_logo column ==='
set test.uid = 'c1110000-0000-0000-0000-0000000c1111';
select count(*) = 1 as athletes_has_logo
  from information_schema.parameters
 where specific_name in (
         select specific_name from information_schema.routines
          where routine_schema = 'public' and routine_name = 'get_athlete_rankings')
   and parameter_name = 'club_logo';
select count(*) = 1 as cup_has_logo
  from information_schema.parameters
 where specific_name in (
         select specific_name from information_schema.routines
          where routine_schema = 'public' and routine_name = 'get_chapter_cup_standings')
   and parameter_name = 'club_logo';

reset role;
set test.uid = '';

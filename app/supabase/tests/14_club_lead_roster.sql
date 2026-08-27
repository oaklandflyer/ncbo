-- ============================================================================
-- Club lead roster management, and the duplicate member.
--
-- Covers migration 0040: `remove_club_member()`, `transfer_club_leadership()`,
-- and the `primary_membership` dedup behind the Network directory and the two
-- leaderboards.
--
-- Same conventions as the rest of this suite: no assertion harness, read the
-- output, and the tests marked MUST FAIL are the ones whose loud ERROR is the
-- pass.
--
-- The two that matter most are 3 and 4. Before 0040 a lead's authority came
-- from EITHER `club_memberships.role` OR the `club_leads` table, and
-- `set_club_lead()` wrote only the second — so somebody whose role made them a
-- lead could not be demoted by anything in the app. That is the reported
-- "test accounts stuck as Club Leads", and it is what 3 and 4 pin.
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
  ('11100000-0000-0000-0000-000000000111', 't14-lead@example.com'),
  ('22200000-0000-0000-0000-000000000222', 't14-heir@example.com'),
  ('33300000-0000-0000-0000-000000000333', 't14-ordinary@example.com'),
  ('44400000-0000-0000-0000-000000000444', 't14-testaccount@example.com'),
  ('55500000-0000-0000-0000-000000000555', 't14-otherlead@example.com'),
  ('66600000-0000-0000-0000-000000000666', 't14-dual@example.com');

update public.profiles set
  display_name = v.n, full_name = v.n, is_adult = true,
  lifting_experience = '1-2 years', major = 'Kinesiology',
  home_region = 'Greater Pittsburgh, PA', affiliation = 'student', grad_year = 2028
from (values
  ('11100000-0000-0000-0000-000000000111'::uuid, 'Chapter Lead'),
  ('22200000-0000-0000-0000-000000000222'::uuid, 'The Heir'),
  ('33300000-0000-0000-0000-000000000333'::uuid, 'Ordinary Member'),
  ('44400000-0000-0000-0000-000000000444'::uuid, 'Stuck Test Account'),
  ('55500000-0000-0000-0000-000000000555'::uuid, 'Purdue Lead Two'),
  ('66600000-0000-0000-0000-000000000666'::uuid, 'Dual Member')
) as v(id, n) where public.profiles.id = v.id;

insert into public.club_memberships (user_id, club_id, status, role, verified_at, grad_year)
select v.uid, c.id, v.st::public.membership_status, v.rl::public.membership_role, now(), 2028
  from (values
    ('11100000-0000-0000-0000-000000000111'::uuid, 'Fitness and Bodybuilding Club', 'active', 'club_lead'),
    ('22200000-0000-0000-0000-000000000222'::uuid, 'Fitness and Bodybuilding Club', 'active', 'member'),
    ('33300000-0000-0000-0000-000000000333'::uuid, 'Fitness and Bodybuilding Club', 'active', 'member'),
    -- The stuck account: a lead by MEMBERSHIP ROLE only, with no `club_leads`
    -- row. This is the shape `set_club_lead()` could never demote.
    ('44400000-0000-0000-0000-000000000444'::uuid, 'Fitness and Bodybuilding Club', 'active', 'co_lead'),
    ('55500000-0000-0000-0000-000000000555'::uuid, 'Purdue Bodybuilding Club',      'active', 'club_lead')
  ) as v(uid, club, st, rl)
  join public.clubs c on c.name = v.club;

-- The duplicate: a second ACTIVE membership at a different university. The
-- partial unique index is on (user_id, university_id), so this is legal — and
-- it is exactly what put one person in the directory twice.
insert into public.club_memberships (user_id, club_id, status, role, verified_at, grad_year)
select '66600000-0000-0000-0000-000000000666', c.id, 'active', 'member', now(), 2028
  from public.clubs c where c.name in ('Fitness and Bodybuilding Club', 'Purdue Bodybuilding Club');

\echo ''
\echo '=== 1. THE DUPLICATE: two active memberships, one person ==='
select count(*) as active_memberships
  from public.active_memberships where user_id = '66600000-0000-0000-0000-000000000666';

\echo ''
\echo '=== 2. primary_membership collapses them to one (this is the fix) ==='
select count(*) as primary_rows
  from public.primary_membership where user_id = '66600000-0000-0000-0000-000000000666';

\echo ''
\echo '=== 3. and the directory shows them once, not twice ==='
set role authenticated;
set test.uid = '11100000-0000-0000-0000-000000000111';
select count(*) as directory_rows
  from public.member_directory where id = '66600000-0000-0000-0000-000000000666';

\echo ''
\echo '=== 4. THE STUCK LEAD: authority from the membership role alone ==='
reset role;
set test.uid = '';
select
  (select count(*) from public.club_leads
    where profile_id = '44400000-0000-0000-0000-000000000444') as club_leads_rows,
  (select role::text from public.club_memberships
    where user_id = '44400000-0000-0000-0000-000000000444') as membership_role;

set role authenticated;
set test.uid = '44400000-0000-0000-0000-000000000444';
select array_length(public.my_led_clubs(), 1) as clubs_they_lead;

\echo ''
\echo '=== 5. the lead removes the stuck test account ==='
set test.uid = '11100000-0000-0000-0000-000000000111';
select public.remove_club_member('44400000-0000-0000-0000-000000000444');

\echo ''
\echo '=== 6. THE CLAIM: they are off the roster AND no longer a lead ==='
reset role;
set test.uid = '';
select
  (select status::text from public.club_memberships
    where user_id = '44400000-0000-0000-0000-000000000444') as status,
  (select role::text from public.club_memberships
    where user_id = '44400000-0000-0000-0000-000000000444') as role,
  (select count(*) from public.club_leads
    where profile_id = '44400000-0000-0000-0000-000000000444') as club_leads_rows,
  (select club_id is null from public.profiles
    where id = '44400000-0000-0000-0000-000000000444') as mirror_cleared;

set role authenticated;
set test.uid = '44400000-0000-0000-0000-000000000444';
select coalesce(array_length(public.my_led_clubs(), 1), 0) as clubs_they_lead_now;

\echo ''
\echo '=== 7. and they are gone from the chapter roster ==='
set test.uid = '11100000-0000-0000-0000-000000000111';
select count(*) as still_on_roster
  from public.get_club_roster((select id from public.clubs where name = 'Fitness and Bodybuilding Club'))
 where id = '44400000-0000-0000-0000-000000000444';

\echo ''
\echo '=== 8. MUST FAIL: a lead removing somebody at another chapter ==='
select public.remove_club_member('55500000-0000-0000-0000-000000000555');

\echo ''
\echo '=== 9. MUST FAIL: an ordinary member removing anybody ==='
set test.uid = '33300000-0000-0000-0000-000000000333';
select public.remove_club_member('22200000-0000-0000-0000-000000000222');

\echo ''
\echo '=== 10. MUST FAIL: a lead removing themselves ==='
set test.uid = '11100000-0000-0000-0000-000000000111';
select public.remove_club_member('11100000-0000-0000-0000-000000000111');

\echo ''
\echo '=== 11. MUST FAIL: a lead promoting somebody without giving up the seat ==='
-- The table-level rule from 0015 is intact: only an admin appoints a
-- club_lead. 0040 opens exactly one door, and it is not this one.
update public.club_memberships set role = 'club_lead'
 where user_id = '22200000-0000-0000-0000-000000000222';

\echo ''
\echo '=== 12. MUST FAIL: a member promoting themselves ==='
set test.uid = '22200000-0000-0000-0000-000000000222';
update public.club_memberships set role = 'club_lead'
 where user_id = '22200000-0000-0000-0000-000000000222';

\echo ''
\echo '=== 13. the lead transfers the chapter to the heir ==='
set test.uid = '11100000-0000-0000-0000-000000000111';
select public.transfer_club_leadership('22200000-0000-0000-0000-000000000222');

\echo ''
\echo '=== 14. THE CLAIM: the seat moved, both sources agree, and it did not multiply ==='
reset role;
set test.uid = '';
select
  (select role::text from public.club_memberships
    where user_id = '22200000-0000-0000-0000-000000000222') as heir_role,
  (select role::text from public.club_memberships
    where user_id = '11100000-0000-0000-0000-000000000111') as old_lead_role,
  (select count(*) from public.club_leads
    where profile_id = '22200000-0000-0000-0000-000000000222') as heir_named,
  (select count(*) from public.club_leads
    where profile_id = '11100000-0000-0000-0000-000000000111') as old_lead_named;

\echo ''
\echo '=== 15. the heir leads, the old lead does not ==='
set role authenticated;
set test.uid = '22200000-0000-0000-0000-000000000222';
select coalesce(array_length(public.my_led_clubs(), 1), 0) as heir_leads;
set test.uid = '11100000-0000-0000-0000-000000000111';
select coalesce(array_length(public.my_led_clubs(), 1), 0) as old_lead_leads;

\echo ''
\echo '=== 16. MUST FAIL: the old lead can no longer remove anybody ==='
select public.remove_club_member('33300000-0000-0000-0000-000000000333');

\echo ''
\echo '=== 17. MUST FAIL: transferring a chapter you do not lead ==='
set test.uid = '33300000-0000-0000-0000-000000000333';
select public.transfer_club_leadership('22200000-0000-0000-0000-000000000222');

\echo ''
\echo '=== 18. MUST FAIL: the transfer flag alone grants nothing ==='
-- The GUC the guard reads is not an authorisation. Setting it by hand and
-- then writing the table still meets `leads_club`, which this member fails.
set test.uid = '33300000-0000-0000-0000-000000000333';
select set_config('ncbo.leadership_transfer', 'on', true);
update public.club_memberships set role = 'club_lead'
 where user_id = '33300000-0000-0000-0000-000000000333';
select set_config('ncbo.leadership_transfer', 'off', true);

\echo ''
\echo ''
\echo '=== 19. the roster component ignores soft-deleted accounts ==='
-- Ordinary Member is soft-deleted; the membership row stays 'active', which
-- is exactly the state a test account left behind. Before 0040 the roster
-- component counted it.
reset role;
set test.uid = '';
select count(*) as active_membership_rows
  from public.club_memberships m
  join public.clubs c on c.id = m.club_id
 where c.name = 'Fitness and Bodybuilding Club' and m.status = 'active';

update public.profiles set deleted_at = now()
 where id = '33300000-0000-0000-0000-000000000333';

set role authenticated;
set test.uid = '22200000-0000-0000-0000-000000000222';
select roster_points
  from public.get_chapter_cup_standings()
 where club_name = 'Fitness and Bodybuilding Club';

\echo '(roster_points must be one lower than active_membership_rows above)'

reset role;
set test.uid = '';
update public.profiles set deleted_at = null
 where id = '33300000-0000-0000-0000-000000000333';

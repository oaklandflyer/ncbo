-- ============================================================================
-- The "Led by" line, and the three ways it named people who were not there.
--
-- Covers migration 0041: the `club_directory.leads` join, `orphan_lead_count`,
-- `get_club_lead_entries()`, `remove_club_lead_entry()` and
-- `clean_orphaned_club_leads()`.
--
-- Same conventions as the rest of this suite: no assertion harness, read the
-- output, and the tests marked MUST FAIL are the ones whose loud ERROR is the
-- pass.
--
-- Tests 2 to 5 are the bug report, one line each: a name with no account, a
-- name whose account was deleted, a name whose account was soft-deleted, and
-- a real lead who must survive all three filters. If 5 ever starts printing
-- an empty array the fix has gone too far and the directory is hiding real
-- leadership.
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
  ('a1500000-0000-0000-0000-000000000a15', 't15-lead@example.com'),
  ('a2500000-0000-0000-0000-000000000a25', 't15-member@example.com'),
  ('a3500000-0000-0000-0000-000000000a35', 't15-softdeleted@example.com'),
  ('a4500000-0000-0000-0000-000000000a45', 't15-otherclub@example.com');

update public.profiles set
  display_name = v.n, full_name = v.n, is_adult = true,
  lifting_experience = '1-2 years', major = 'Kinesiology',
  home_region = 'Greater Pittsburgh, PA', affiliation = 'student', grad_year = 2028
from (values
  ('a1500000-0000-0000-0000-000000000a15'::uuid, 'Real Lead'),
  ('a2500000-0000-0000-0000-000000000a25'::uuid, 'Real Member'),
  ('a3500000-0000-0000-0000-000000000a35'::uuid, 'Soft Deleted Lead'),
  ('a4500000-0000-0000-0000-000000000a45'::uuid, 'Other Club Lead')
) as v(id, n) where public.profiles.id = v.id;

insert into public.club_memberships (user_id, club_id, status, role, verified_at, grad_year)
select v.uid, c.id, 'active', v.rl::public.membership_role, now(), 2028
  from (values
    ('a1500000-0000-0000-0000-000000000a15'::uuid, 'Fitness and Bodybuilding Club', 'club_lead'),
    ('a2500000-0000-0000-0000-000000000a25'::uuid, 'Fitness and Bodybuilding Club', 'member'),
    ('a3500000-0000-0000-0000-000000000a35'::uuid, 'Fitness and Bodybuilding Club', 'co_lead'),
    ('a4500000-0000-0000-0000-000000000a45'::uuid, 'Purdue Bodybuilding Club',      'club_lead')
  ) as v(uid, club, rl)
  join public.clubs c on c.name = v.club;

/* The four shapes of a club_leads row, at one chapter.

   `t15 Ghost Name` is the seeded placeholder: a name and nothing else, which
   is what 0014 left behind for eleven real people who never signed up.
   `t15 Deleted Account` stands in for a hard delete — the FK is
   `on delete set null`, so what survives the deletion is exactly this: a row
   with a name and a null profile. */
insert into public.club_leads (club_id, name, profile_id, ordinal)
select c.id, v.nm, v.pid, v.ord
  from (values
    ('t15 Ghost Name',       null::uuid,                                     10),
    ('t15 Deleted Account',  null::uuid,                                     11),
    ('Soft Deleted Lead',    'a3500000-0000-0000-0000-000000000a35'::uuid,   12),
    ('Real Lead',            'a1500000-0000-0000-0000-000000000a15'::uuid,   13)
  ) as v(nm, pid, ord)
  join public.clubs c on c.name = 'Fitness and Bodybuilding Club';

insert into public.club_leads (club_id, name, profile_id, ordinal)
select c.id, 'Other Club Lead', 'a4500000-0000-0000-0000-000000000a45', 10
  from public.clubs c where c.name = 'Purdue Bodybuilding Club';

-- The soft delete, applied after the lead row exists.
update public.profiles set deleted_at = now()
 where id = 'a3500000-0000-0000-0000-000000000a35';

\echo ''
\echo '=== 1. every lead row at the chapter, as stored ==='
select name, profile_id is null as unlinked
  from public.club_leads
 where club_id = (select id from public.clubs where name = 'Fitness and Bodybuilding Club')
   and name like 't15%' or name in ('Real Lead', 'Soft Deleted Lead')
 order by name;

\echo ''
\echo '=== 2-5. THE CLAIM: only the live, approved account is published ==='
-- Expect exactly {Real Lead}: the ghost name, the deleted account and the
-- soft-deleted lead are all suppressed; the real lead survives.
set role authenticated;
set test.uid = 'a1500000-0000-0000-0000-000000000a15';
select leads, orphan_lead_count
  from public.club_directory
 where club_name = 'Fitness and Bodybuilding Club';

\echo ''
\echo '=== 6. a lead can read the entries, with a reason for each ==='
select name, is_published, orphan_reason
  from public.get_club_lead_entries(
    (select id from public.clubs where name = 'Fitness and Bodybuilding Club'))
 where name like 't15%' or name in ('Real Lead', 'Soft Deleted Lead')
 order by name;

\echo ''
\echo '=== 7. MUST FAIL: an ordinary member reading them ==='
set test.uid = 'a2500000-0000-0000-0000-000000000a25';
select count(*) from public.get_club_lead_entries(
  (select id from public.clubs where name = 'Fitness and Bodybuilding Club'));

\echo ''
\echo '=== 8. MUST FAIL: a lead reading another chapter''s entries ==='
set test.uid = 'a1500000-0000-0000-0000-000000000a15';
select count(*) from public.get_club_lead_entries(
  (select id from public.clubs where name = 'Purdue Bodybuilding Club'));

\echo ''
\echo '=== 9. the lead removes one orphaned entry ==='
reset role;
set test.uid = '';
select id as ghost_id from public.club_leads where name = 't15 Ghost Name' \gset
set role authenticated;
set test.uid = 'a1500000-0000-0000-0000-000000000a15';
select public.remove_club_lead_entry(:'ghost_id');
reset role;
set test.uid = '';
select count(*) as ghost_rows_left from public.club_leads where name = 't15 Ghost Name';

\echo ''
\echo '=== 10. MUST FAIL: a lead removing their own entry ==='
reset role;
set test.uid = '';
select id as own_id from public.club_leads
 where profile_id = 'a1500000-0000-0000-0000-000000000a15' \gset
set role authenticated;
set test.uid = 'a1500000-0000-0000-0000-000000000a15';
select public.remove_club_lead_entry(:'own_id');

\echo ''
\echo '=== 11. MUST FAIL: a lead removing an entry at another chapter ==='
reset role;
set test.uid = '';
select id as purdue_id from public.club_leads
 where profile_id = 'a4500000-0000-0000-0000-000000000a45' \gset
set role authenticated;
set test.uid = 'a1500000-0000-0000-0000-000000000a15';
select public.remove_club_lead_entry(:'purdue_id');

\echo ''
\echo '=== 12. MUST FAIL: an ordinary member removing an entry ==='
set test.uid = 'a2500000-0000-0000-0000-000000000a25';
select public.remove_club_lead_entry(:'purdue_id');

\echo ''
\echo '=== 13. MUST FAIL: a club lead running the bulk sweep ==='
-- Deleting a chapter's seeded history is an organisation decision.
set test.uid = 'a1500000-0000-0000-0000-000000000a15';
select public.clean_orphaned_club_leads(
  (select id from public.clubs where name = 'Fitness and Bodybuilding Club'));

\echo ''
\echo '=== 14. an admin sweeps the chapter, and is told what went ==='
reset role;
set test.uid = '';
insert into public.org_roles (user_id, role)
values ('a2500000-0000-0000-0000-000000000a25', 'admin')
on conflict do nothing;
set role authenticated;
set test.uid = 'a2500000-0000-0000-0000-000000000a25';
select public.clean_orphaned_club_leads(
  (select id from public.clubs where name = 'Fitness and Bodybuilding Club')) as rows_removed;

\echo ''
\echo '=== 15. THE CLAIM: the orphans are gone and the real lead is untouched ==='
select leads, orphan_lead_count
  from public.club_directory
 where club_name = 'Fitness and Bodybuilding Club';

\echo ''
\echo '=== 16. the sweep took only what the directory was already hiding ==='
reset role;
set test.uid = '';
select count(*) as remaining_rows_at_chapter
  from public.club_leads
 where club_id = (select id from public.clubs where name = 'Fitness and Bodybuilding Club');

\echo ''
\echo '=== 17. authority never came from an orphan row anyway ==='
-- `my_led_clubs()` matches `profile_id = auth.uid()`, and a null is not a
-- uuid. Hiding these names took nobody's access away, which is why 0041 is
-- safe to apply before the rows are cleaned up.
set role authenticated;
set test.uid = 'a1500000-0000-0000-0000-000000000a15';
select coalesce(array_length(public.my_led_clubs(), 1), 0) as real_lead_still_leads;
set test.uid = 'a2500000-0000-0000-0000-000000000a25';
reset role;
set test.uid = '';
delete from public.org_roles
 where user_id = 'a2500000-0000-0000-0000-000000000a25' and role = 'admin';

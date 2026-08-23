-- ============================================================================
-- Approving somebody into a chapter — the queue read, the nav count, and the
-- admin's placement.
--
-- The bug this file pins down: applications arrived `pending` and nothing
-- could move them on. The lead's queue had lost its screen, and the admin's
-- only other route — the club dropdown on the user editor — wrote
-- `profiles.club_id`, which has been a derived mirror since 0015. So the
-- member stayed off every roster and showed in the Network under "No club
-- yet", which is `member_directory`, which reads `active_memberships`.
--
-- Same conventions as the rest: no harness, read the output, and a MUST FAIL
-- is a test whose loud ERROR is the pass.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
select public.reapply_column_privileges();

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== fixtures: an admin, a lead, and two people waiting ==='
insert into auth.users (id, email) values
  ('12000000-0000-0000-0000-000000000001', 'approval-admin@example.com'),
  ('12000000-0000-0000-0000-000000000002', 'approval-lead@example.com'),
  ('12000000-0000-0000-0000-000000000003', 'approval-applicant@example.com'),
  ('12000000-0000-0000-0000-000000000004', 'approval-leadclaim@example.com'),
  ('12000000-0000-0000-0000-000000000005', 'approval-outsider@example.com');

/* Onboarded, not ghosts: `member_directory` filters on `is_onboarded`, and a
   fixture missing a major or a home region is invisible there for a reason
   that has nothing to do with what this file is testing. */
update public.profiles set
  display_name = v.n, full_name = v.n, status = 'approved',
  lifting_experience = '1-2 years', major = 'Kinesiology',
  home_region = 'Greater Pittsburgh, PA', affiliation = 'student',
  grad_year = 2029, is_adult = true
from (values
  ('12000000-0000-0000-0000-000000000001'::uuid, 'Approval Admin'),
  ('12000000-0000-0000-0000-000000000002'::uuid, 'Iowa Lead'),
  ('12000000-0000-0000-0000-000000000003'::uuid, 'Iowa Applicant'),
  ('12000000-0000-0000-0000-000000000004'::uuid, 'Baylor Claimant'),
  ('12000000-0000-0000-0000-000000000005'::uuid, 'Outsider')
) as v(id, n) where public.profiles.id = v.id;

insert into public.org_roles (user_id, role)
  values ('12000000-0000-0000-0000-000000000001', 'admin');

insert into public.club_memberships (user_id, club_id, status, role, verified_at, verification_method)
select '12000000-0000-0000-0000-000000000002', c.id, 'active', 'club_lead', now(), 'club_lead'
  from public.clubs c join public.universities u on u.id = c.university_id
 where u.domain = 'uiowa.edu';

insert into public.club_memberships (user_id, club_id, status, legal_name, group_chat_handle, group_chat_platform)
select '12000000-0000-0000-0000-000000000003', c.id, 'pending', 'Iowa Applicant', '@iowaapplicant', 'GroupMe'
  from public.clubs c join public.universities u on u.id = c.university_id
 where u.domain = 'uiowa.edu';

-- Baylor, which has no lead: the admin is the only person who could ever act
-- on this one, and 0032 wrote the claim that nothing has ever displayed.
insert into public.club_memberships (user_id, club_id, status, legal_name, claimed_lead)
select '12000000-0000-0000-0000-000000000004', c.id, 'pending', 'Baylor Claimant', true
  from public.clubs c join public.universities u on u.id = c.university_id
 where u.domain = 'baylor.edu';

\echo ''
\echo '=== 1. the queue carries the lead claim, so a reviewer can see it ==='
set role authenticated;
set test.uid = '12000000-0000-0000-0000-000000000001';
select display_name, claimed_lead
  from public.get_club_queue((select c.id from public.clubs c
                                join public.universities u on u.id = c.university_id
                               where u.domain = 'baylor.edu'))
 order by display_name;

\echo ''
\echo '=== 2. an admin sees every chapter with somebody waiting ==='
select short_name, pending, approver_count
  from public.pending_applications_by_club()
 where short_name in ('Iowa', 'Baylor')
 order by short_name;

\echo ''
\echo '=== 3. a lead sees only their own chapter on that list ==='
set test.uid = '12000000-0000-0000-0000-000000000002';
select short_name, pending from public.pending_applications_by_club() order by short_name;

\echo ''
\echo '=== 4. somebody who leads nothing sees nothing, rather than everything ==='
set test.uid = '12000000-0000-0000-0000-000000000005';
select count(*) as rows_visible from public.pending_applications_by_club();

\echo ''
\echo '=== 5. the nav count carries applications, scoped the same way ==='
set test.uid = '12000000-0000-0000-0000-000000000002';
select 'iowa lead' as who, pending_applications from public.get_viewer_nav_counts();
set test.uid = '12000000-0000-0000-0000-000000000005';
select 'outsider' as who, pending_applications from public.get_viewer_nav_counts();

\echo ''
\echo '=== 6. MUST FAIL: a member placing themselves in a chapter ==='
select public.admin_place_member('12000000-0000-0000-0000-000000000005',
                                 (select c.id from public.clubs c
                                    join public.universities u on u.id = c.university_id
                                   where u.domain = 'baylor.edu'));

\echo ''
\echo '=== 7. MUST FAIL: a club lead placing somebody, even at their own club ==='
set test.uid = '12000000-0000-0000-0000-000000000002';
select public.admin_place_member('12000000-0000-0000-0000-000000000005',
                                 (select c.id from public.clubs c
                                    join public.universities u on u.id = c.university_id
                                   where u.domain = 'uiowa.edu'));

\echo ''
\echo '=== 8. before: the claimant is in the directory with no club at all ==='
set test.uid = '12000000-0000-0000-0000-000000000001';
select display_name, coalesce(club_name, 'No club yet') as shows_as
  from public.member_directory where id = '12000000-0000-0000-0000-000000000004';

\echo ''
\echo '=== 9. an admin places them as the lead of a chapter that had none ==='
select public.admin_place_member(
  '12000000-0000-0000-0000-000000000004',
  (select c.id from public.clubs c join public.universities u on u.id = c.university_id
    where u.domain = 'baylor.edu'),
  'club_lead');

select display_name, coalesce(club_name, 'No club yet') as shows_as, club_role, member_verified
  from public.member_directory where id = '12000000-0000-0000-0000-000000000004';

\echo ''
\echo '=== 10. the membership is the fact, and it says who did it ==='
select m.status, m.role, m.verification_method,
       m.decided_by_user_id = '12000000-0000-0000-0000-000000000001' as decided_by_the_admin
  from public.club_memberships m
 where m.user_id = '12000000-0000-0000-0000-000000000004';

\echo ''
\echo '=== 11. the mirror on profiles caught up without anybody writing it ==='
select p.role as mirrored_role, p.club_id is not null as mirrored_club
  from public.profiles p where p.id = '12000000-0000-0000-0000-000000000004';

\echo ''
\echo '=== 12. and the chapter that had no approver now has one ==='
set test.uid = '12000000-0000-0000-0000-000000000004';
select public.leads_club((select c.id from public.clubs c
                            join public.universities u on u.id = c.university_id
                           where u.domain = 'baylor.edu')) as leads_baylor_now;
set test.uid = '12000000-0000-0000-0000-000000000001';
select public.club_approver_count((select c.id from public.clubs c
                                     join public.universities u on u.id = c.university_id
                                    where u.domain = 'baylor.edu')) as baylor_approvers;

\echo ''
\echo '=== 13. no club means off the roster, and the record survives ==='
set test.uid = '12000000-0000-0000-0000-000000000001';
select public.admin_place_member('12000000-0000-0000-0000-000000000004', null);
select status from public.club_memberships
 where user_id = '12000000-0000-0000-0000-000000000004';
select count(*) as still_in_the_directory_with_a_club
  from public.member_directory
 where id = '12000000-0000-0000-0000-000000000004' and club_name is not null;

\echo ''
\echo '=== 14. approving through the queue is still the lead''s own path ==='
set test.uid = '12000000-0000-0000-0000-000000000002';
select public.decide_membership(
  (select m.id from public.club_memberships m
    where m.user_id = '12000000-0000-0000-0000-000000000003'), 'approve');
select display_name, coalesce(club_name, 'No club yet') as shows_as
  from public.member_directory where id = '12000000-0000-0000-0000-000000000003';

reset role;
set test.uid = '';

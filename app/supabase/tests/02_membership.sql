-- ============================================================================
-- Membership, club scoping, and the roster audit.
--
-- Two of these groups are the ones the brief singles out as the places a bug
-- leaks data across chapters, and they are why this file exists separately
-- from 01: the club scoping in 2.2 and the roster filtering in 2.5.
--
-- Same conventions as 01_rls.sql: no assertion harness, read the output, and
-- the tests marked MUST FAIL are the ones whose loud ERROR is the pass.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- The blanket grant above hands back the table-level SELECT that
-- `restrict_columns()` takes away. Re-apply it, or test 10 would be checking
-- this file's own grant instead of the schema.
select public.restrict_columns('public.profiles', array['email']);
select public.restrict_columns('public.club_memberships',
  array['legal_name', 'group_chat_handle', 'group_chat_platform',
        'found_via', 'student_id_photo_path', 'decision_note']);
select public.restrict_columns('public.school_email_codes', array['code_hash']);

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== fixtures ==='
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-0000000000a1', 'pittlead@example.com'),
  ('a2000000-0000-0000-0000-0000000000a2', 'pittco@example.com'),
  ('a3000000-0000-0000-0000-0000000000a3', 'pittmember@example.com'),
  ('a4000000-0000-0000-0000-0000000000a4', 'pittmember2@example.com'),
  ('b1000000-0000-0000-0000-0000000000b1', 'purduelead@example.com'),
  ('c1000000-0000-0000-0000-0000000000c1', 'pittapplicant@example.com'),
  ('c2000000-0000-0000-0000-0000000000c2', 'purdueapplicant@example.com'),
  ('d1000000-0000-0000-0000-0000000000d1', 'orgadmin@example.com'),
  ('d2000000-0000-0000-0000-0000000000d2', 'advisor@example.com'),
  ('e1000000-0000-0000-0000-0000000000e1', 'nobody@example.com'),
  ('f1000000-0000-0000-0000-0000000000f1', 'studentadmin@example.com');

update public.profiles set display_name = v.n from (values
  ('a1000000-0000-0000-0000-0000000000a1'::uuid, 'Pitt Lead'),
  ('a2000000-0000-0000-0000-0000000000a2'::uuid, 'Pitt Co-Lead'),
  ('a3000000-0000-0000-0000-0000000000a3'::uuid, 'Pitt Member'),
  ('a4000000-0000-0000-0000-0000000000a4'::uuid, 'Pitt Member Two'),
  ('b1000000-0000-0000-0000-0000000000b1'::uuid, 'Purdue Lead'),
  ('c1000000-0000-0000-0000-0000000000c1'::uuid, 'Pitt Applicant'),
  ('c2000000-0000-0000-0000-0000000000c2'::uuid, 'Purdue Applicant'),
  ('d1000000-0000-0000-0000-0000000000d1'::uuid, 'Org Admin'),
  ('d2000000-0000-0000-0000-0000000000d2'::uuid, 'Coaching Advisor'),
  ('e1000000-0000-0000-0000-0000000000e1'::uuid, 'Unaffiliated Person'),
  ('f1000000-0000-0000-0000-0000000000f1'::uuid, 'Student Admin')
) as v(id, n) where public.profiles.id = v.id;

-- Org roles, and deliberately NO membership for the two of them. This is the
-- fixture the whole of group 2.5 turns on.
insert into public.org_roles (user_id, role) values
  ('d1000000-0000-0000-0000-0000000000d1', 'admin'),
  ('d2000000-0000-0000-0000-0000000000d2', 'coaching_advisor'),
  ('f1000000-0000-0000-0000-0000000000f1', 'admin');

insert into public.club_memberships (user_id, club_id, status, role, verified_at, verification_method, grad_year, legal_name, group_chat_handle, group_chat_platform)
select v.uid, c.id, v.st::public.membership_status, v.rl::public.membership_role,
       case when v.st = 'active' then now() end,
       case when v.st = 'active' then 'club_lead'::public.verification_method end,
       v.gy, v.ln, v.handle, 'GroupMe'
  from (values
    ('a1000000-0000-0000-0000-0000000000a1'::uuid, 'Fitness and Bodybuilding Club', 'active',  'club_lead', 2026, 'Pitt Lead',        '@pittlead'),
    ('a2000000-0000-0000-0000-0000000000a2'::uuid, 'Fitness and Bodybuilding Club', 'active',  'co_lead',   2027, 'Pitt Co-Lead',     '@pittco'),
    ('a3000000-0000-0000-0000-0000000000a3'::uuid, 'Fitness and Bodybuilding Club', 'active',  'member',    2028, 'Pitt Member',      '@pittmember'),
    ('a4000000-0000-0000-0000-0000000000a4'::uuid, 'Fitness and Bodybuilding Club', 'active',  'member',    2028, 'Pitt Member Two',  '@pittmember2'),
    ('b1000000-0000-0000-0000-0000000000b1'::uuid, 'Purdue Bodybuilding Club',      'active',  'club_lead', 2026, 'Purdue Lead',      '@purduelead'),
    ('c1000000-0000-0000-0000-0000000000c1'::uuid, 'Fitness and Bodybuilding Club', 'pending', 'member',    2029, 'Pitt Applicant',   '@pittapplicant'),
    ('c2000000-0000-0000-0000-0000000000c2'::uuid, 'Purdue Bodybuilding Club',      'pending', 'member',    2029, 'Purdue Applicant', '@purdueapplicant'),
    ('f1000000-0000-0000-0000-0000000000f1'::uuid, 'Fitness and Bodybuilding Club', 'active',  'member',    2027, 'Student Admin',    '@studentadmin')
  ) as v(uid, club, st, rl, gy, ln, handle)
  join public.clubs c on c.name = v.club;

select display_name, role as mirrored_role from public.profiles
 where id in ('a1000000-0000-0000-0000-0000000000a1','d1000000-0000-0000-0000-0000000000d1',
              'd2000000-0000-0000-0000-0000000000d2','a3000000-0000-0000-0000-0000000000a3')
 order by display_name;

-- ============================================================================
-- A university has exactly one club
-- ============================================================================
\echo ''
\echo '=== 1. MUST FAIL: a second club at a university that already has one ==='
insert into public.clubs (university_id, name, status)
select id, 'Rival Pitt Club', 'Active' from public.universities where domain = 'pitt.edu';

\echo ''
\echo '=== 2. MUST FAIL: a second membership for one person at one university ==='
-- Two different clubs would be needed, and 1 just proved there cannot be two.
-- This is the same rule from the other side: the partial unique index.
insert into public.club_memberships (user_id, club_id, status)
select 'a3000000-0000-0000-0000-0000000000a3', c.id, 'pending'
  from public.clubs c where c.name = 'Fitness and Bodybuilding Club';

\echo ''
\echo '=== 3. a denied application does not lock somebody out of re-applying ==='
select count(*) as pitt_clubs from public.clubs c
  join public.universities u on u.id = c.university_id where u.domain = 'pitt.edu';

-- ============================================================================
-- 2.2 — the approval queue is club-scoped
-- ============================================================================
\echo ''
\echo '=== 4. a Pitt lead sees ONLY Pitt applicants in their queue ==='
set role authenticated;
set test.uid = 'a1000000-0000-0000-0000-0000000000a1';
select display_name, group_chat_handle, grad_year, found_via is null as no_source_given
  from public.get_club_queue((select id from public.clubs where name = 'Fitness and Bodybuilding Club'));

\echo ''
\echo '=== 5. MUST FAIL: a Pitt lead opening Purdue''s queue ==='
select * from public.get_club_queue((select id from public.clubs where name = 'Purdue Bodybuilding Club'));

\echo ''
\echo '=== 6. MUST FAIL: a Pitt lead deciding a Purdue application ==='
-- The id is captured as superuser and passed in as a literal. Reading it back
-- as the Pitt lead would return null, because RLS already hides Purdue's
-- pending rows from them — and the RPC would then refuse for the wrong
-- reason, proving nothing about its own authorisation check.
reset role;
set test.uid = '';
select id as purdue_app from public.club_memberships
 where user_id = 'c2000000-0000-0000-0000-0000000000c2' \gset
set role authenticated;
set test.uid = 'a1000000-0000-0000-0000-0000000000a1';
select public.decide_membership(:'purdue_app', 'approve');

\echo ''
\echo '=== 7. a Pitt lead writing a Purdue membership row directly changes nothing ==='
-- No ERROR here, and that is correct: an UPDATE the policy does not match is
-- filtered to zero rows rather than raised on. The assertion is the row
-- afterwards, not the absence of an exception.
-- The RPC is refused above; this is the same attempt with the RPC removed
-- from the picture, because a lead can reach the table with their own token.
update public.club_memberships set status = 'active' where id = :'purdue_app';
reset role;
set test.uid = '';
select status as purdue_applicant_untouched from public.club_memberships
 where id = :'purdue_app';
set role authenticated;
set test.uid = 'a1000000-0000-0000-0000-0000000000a1';

\echo ''
\echo '=== 8. approving flips to active and records WHO verified, and how ==='
select public.decide_membership(
  (select id from public.club_memberships where user_id = 'c1000000-0000-0000-0000-0000000000c1'),
  'approve', 'Recognised from the Tuesday lift.');
select m.status,
       m.verified_at is not null as verified,
       p.display_name as verified_by,
       m.verification_method
  from public.club_memberships m
  left join public.profiles p on p.id = m.verified_by_user_id
 where m.user_id = 'c1000000-0000-0000-0000-0000000000c1';

\echo ''
\echo '=== 9. MUST FAIL: deciding the same application twice ==='
select public.decide_membership(
  (select id from public.club_memberships where user_id = 'c1000000-0000-0000-0000-0000000000c1'),
  'deny');

\echo ''
\echo '=== 10. MUST FAIL: an ordinary member reading the group-chat handle ==='
-- Column privilege, not RLS: a hard refusal rather than an empty column. 2.3
-- says this field is verification data for leads only, and a member is on the
-- same roster as the applicant, so a row policy alone would hand it over.
set test.uid = 'a3000000-0000-0000-0000-0000000000a3';
select group_chat_handle from public.club_memberships limit 1;

\echo ''
\echo '=== 11. an ordinary member cannot see who is waiting at their own club ==='
select count(*) as pending_rows_visible_to_a_member
  from public.club_memberships where status = 'pending';

\echo ''
\echo '=== 12. MUST FAIL: a member approving themselves ==='
set test.uid = 'c2000000-0000-0000-0000-0000000000c2';
update public.club_memberships set status = 'active'
 where user_id = 'c2000000-0000-0000-0000-0000000000c2';

\echo ''
\echo '=== 13. MUST FAIL: a member verifying themselves ==='
update public.club_memberships set verified_at = now()
 where user_id = 'c2000000-0000-0000-0000-0000000000c2';

\echo ''
\echo '=== 14. an applicant CAN correct what they typed while pending ==='
update public.club_memberships set preferred_name = 'Purdue A.'
 where user_id = 'c2000000-0000-0000-0000-0000000000c2';
select preferred_name is not null as applicant_edited_their_own_row
  from public.club_memberships where user_id = 'c2000000-0000-0000-0000-0000000000c2';

-- ============================================================================
-- 2.5 — org roles are not club membership
-- ============================================================================
\echo ''
\echo '=== 15. an admin with no student membership is on ZERO rosters ==='
reset role;
set test.uid = '';
select count(*) as rosters_containing_the_org_admin
  from public.club_memberships where user_id = 'd1000000-0000-0000-0000-0000000000d1';
select count(*) as rosters_containing_the_advisor
  from public.club_memberships where user_id = 'd2000000-0000-0000-0000-0000000000d2';

\echo ''
\echo '=== 16. and is counted in NO chapter''s member total ==='
-- Pitt's active memberships are: lead, co-lead, two members, the student
-- admin, and the applicant approved in test 8. Six. The org admin and the
-- coaching advisor are not among them, which is the acceptance criterion.
select short_name, member_count, pending_count, approver_count
  from public.club_directory order by short_name;

\echo ''
\echo '=== 17. an org-role holder appears in the directory as Independent ==='
select display_name,
       coalesce(club_name, 'Independent') as chapter,
       coalesce(club_role::text, 'none')  as club_role
  from public.member_directory
 where display_name in ('Org Admin', 'Coaching Advisor', 'Unaffiliated Person', 'Pitt Member')
 order by display_name;

\echo ''
\echo '=== 18. an admin who IS a student appears as a member of that chapter ==='
-- Role derived from the membership, never from the org role: the same person
-- holds `org_roles.admin` and shows up on Pitt''s roster as a member.
select display_name, club_name, club_role
  from public.member_directory where display_name = 'Student Admin';

\echo ''
\echo '=== 19. the lead''s roster carries the same people, and no others ==='
set role authenticated;
set test.uid = 'a1000000-0000-0000-0000-0000000000a1';
select display_name, club_role, is_verified, dues_current
  from public.get_club_roster((select id from public.clubs where name = 'Fitness and Bodybuilding Club'))
 order by display_name;

-- ============================================================================
-- Verified and dues are two flags
-- ============================================================================
\echo ''
\echo '=== 20. dues lapse without touching verification ==='
select public.record_dues_payment(
  (select id from public.club_memberships where user_id = 'a3000000-0000-0000-0000-0000000000a3'),
  'Fall 2026', (current_date + 90));
select public.record_dues_payment(
  (select id from public.club_memberships where user_id = 'a4000000-0000-0000-0000-0000000000a4'),
  'Fall 2025', (current_date - 10));
select p.display_name,
       (m.verified_at is not null) as still_verified,
       public.dues_current(m.id)   as dues_current
  from public.club_memberships m join public.profiles p on p.id = m.user_id
 where p.display_name in ('Pitt Member', 'Pitt Member Two')
 order by p.display_name;

\echo ''
\echo '=== 21. a clubmate cannot read somebody else''s dues ==='
set test.uid = 'a3000000-0000-0000-0000-0000000000a3';
select count(*) as other_peoples_dues_rows_visible from public.membership_dues
 where membership_id <> (select id from public.club_memberships
                          where user_id = 'a3000000-0000-0000-0000-0000000000a3');

-- ============================================================================
-- Referral fast-track
-- ============================================================================
\echo ''
\echo '=== 22. a verified clubmate can SEE an application to vouch for ==='
reset role;
set test.uid = '';
insert into auth.users (id, email) values ('c3000000-0000-0000-0000-0000000000c3', 'referred@example.com');
update public.profiles set display_name = 'Referred Applicant'
 where id = 'c3000000-0000-0000-0000-0000000000c3';
insert into public.club_memberships (user_id, club_id, status, legal_name)
select 'c3000000-0000-0000-0000-0000000000c3', c.id, 'pending', 'Referred Applicant'
  from public.clubs c where c.name = 'Fitness and Bodybuilding Club';

-- Through the reader, because a member cannot SELECT a pending row directly:
-- that is deliberate, and it is also why discovery needs its own door.
set role authenticated;
set test.uid = 'a3000000-0000-0000-0000-0000000000a3';
select display_name, club_name, vouch_count, i_have_vouched
  from public.get_vouchable_applications();

\echo ''
\echo '=== 23. two vouches is not three ==='
select membership_id as referred_app from public.get_vouchable_applications()
 where display_name = 'Referred Applicant' \gset
insert into public.membership_vouches (membership_id, voucher_id)
values (:'referred_app', 'a3000000-0000-0000-0000-0000000000a3');
set test.uid = 'a4000000-0000-0000-0000-0000000000a4';
insert into public.membership_vouches (membership_id, voucher_id)
values (:'referred_app', 'a4000000-0000-0000-0000-0000000000a4');
reset role;
set test.uid = '';
select status as still_pending_after_two_vouches from public.club_memberships
 where user_id = 'c3000000-0000-0000-0000-0000000000c3';

\echo ''
\echo '=== 24. MUST FAIL: a vouch from somebody at another chapter ==='
-- Purdue's lead is verified and active, just not here. Without this clause
-- "three people vouched" would be three strangers, and the fast-track would
-- be the easiest way in rather than the hardest.
set role authenticated;
set test.uid = 'b1000000-0000-0000-0000-0000000000b1';
-- One row, and it is Purdue's own applicant, not Pitt's. The count alone
-- would not say which, so the club is printed: a reader who sees "1" and
-- assumes a leak is reading the wrong thing.
select display_name, club_name from public.get_vouchable_applications();
select count(*) filter (where display_name = 'Referred Applicant')
         as pitt_applications_visible_to_the_purdue_lead
  from public.get_vouchable_applications();
insert into public.membership_vouches (membership_id, voucher_id)
values (:'referred_app', 'b1000000-0000-0000-0000-0000000000b1');

\echo ''
\echo '=== 25. the third vouch from a verified clubmate auto-approves ==='
set test.uid = 'a2000000-0000-0000-0000-0000000000a2';
insert into public.membership_vouches (membership_id, voucher_id)
values (:'referred_app', 'a2000000-0000-0000-0000-0000000000a2');
reset role;
set test.uid = '';
select status, verification_method from public.club_memberships
 where user_id = 'c3000000-0000-0000-0000-0000000000c3';

\echo ''
\echo '=== 25b. and the lead is told it happened ==='
set role authenticated;
set test.uid = 'a1000000-0000-0000-0000-0000000000a1';
select body from public.membership_notes where membership_id = :'referred_app';

\echo '=== 26. a lead CAN name a co-lead ==='
select public.set_club_role('a3000000-0000-0000-0000-0000000000a3',
  (select id from public.clubs where name = 'Fitness and Bodybuilding Club'), 'co_lead');
select role as pitt_member_role from public.club_memberships
 where user_id = 'a3000000-0000-0000-0000-0000000000a3';

\echo ''
\echo '=== 27. MUST FAIL: a lead appointing another club lead ==='
select public.set_club_role('a4000000-0000-0000-0000-0000000000a4',
  (select id from public.clubs where name = 'Fitness and Bodybuilding Club'), 'club_lead');

\echo ''
\echo '=== 28. MUST FAIL: a lead naming a co-lead at another chapter ==='
select public.set_club_role('b1000000-0000-0000-0000-0000000000b1',
  (select id from public.clubs where name = 'Purdue Bodybuilding Club'), 'co_lead');

\echo ''
\echo '=== 29. MUST FAIL: a lead stepping themselves down ==='
select public.set_club_role('a1000000-0000-0000-0000-0000000000a1',
  (select id from public.clubs where name = 'Fitness and Bodybuilding Club'), 'member');

\echo ''
\echo '=== 30. the single-approver warning: Purdue has one, Pitt has several ==='
reset role;
set test.uid = '';
select short_name, approver_count,
       (approver_count <= 1) as warn_the_lead
  from public.club_directory where short_name in ('Pitt', 'Purdue') order by short_name;

\echo ''
\echo '=== 31. an application older than 72 hours escalates, once ==='
update public.club_memberships set created_at = now() - interval '80 hours'
 where user_id = 'c2000000-0000-0000-0000-0000000000c2';
select public.escalate_stale_applications() as escalated_first_call;
select public.escalate_stale_applications() as escalated_second_call;
select escalation_level from public.club_memberships
 where user_id = 'c2000000-0000-0000-0000-0000000000c2';

\echo ''
\echo '=== 32. the digest is one row per club per day, not one per application ==='
select public.build_lead_digests() as clubs_with_something_to_report;
select public.build_lead_digests() as same_call_again;
select c.name, d.pending, d.escalated
  from public.lead_digests d join public.clubs c on c.id = d.club_id
 order by c.name;

-- ============================================================================
-- 2.3 — the profile popup shows what it is allowed to show
-- ============================================================================
\echo ''
\echo '=== 33. the popup projection carries no email, no dues, no handle ==='
set role authenticated;
set test.uid = 'a3000000-0000-0000-0000-0000000000a3';
-- Read off the function's declared result, which is the actual contract. A
-- component that "doesn't render" a field still received it; this is the check
-- that the field never leaves Postgres in the first place.
select pg_get_function_result(p.oid) ~ '\memail\M'        as leaks_email,
       pg_get_function_result(p.oid) ~ 'dues'             as leaks_dues,
       pg_get_function_result(p.oid) ~ 'group_chat'       as leaks_group_chat,
       pg_get_function_result(p.oid) ~ 'legal_name'       as leaks_legal_name
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'get_public_profile';
select display_name, club_name, university_short_name, grad_year, is_verified, org_roles
  from public.get_public_profile('a1000000-0000-0000-0000-0000000000a1');

\echo ''
\echo '=== 34. an unaffiliated person reads as Independent, with no chapter ==='
select display_name, coalesce(club_name, 'Independent') as chapter, is_verified
  from public.get_public_profile('e1000000-0000-0000-0000-0000000000e1');

\echo ''
\echo '=== 35. a coaching advisor carries their org role and no chapter ==='
select display_name, coalesce(club_name, 'Independent') as chapter, org_roles
  from public.get_public_profile('d2000000-0000-0000-0000-0000000000d2');
reset role;

-- ============================================================================
-- 2.4 — the optional school-email code
-- ============================================================================
\echo ''
\echo '=== 36. a code verifies the address, and never becomes a login ==='
reset role;
set test.uid = '';
-- Pitt applies, so there is a pending membership to attach the code to.
insert into auth.users (id, email) values ('c4000000-0000-0000-0000-0000000000c4', 'codepath@gmail.com');
update public.profiles set display_name = 'Code Path'
 where id = 'c4000000-0000-0000-0000-0000000000c4';
insert into public.club_memberships (user_id, club_id, status, legal_name)
select 'c4000000-0000-0000-0000-0000000000c4', c.id, 'pending', 'Code Path'
  from public.clubs c where c.name = 'Fitness and Bodybuilding Club';

set role authenticated;
set test.uid = 'c4000000-0000-0000-0000-0000000000c4';
-- A subdomain address, because schools are inconsistent about them and the
-- apex-only rule would turn real students away.
select public.issue_school_email_code('someone@students.pitt.edu') as code \gset
select public.redeem_school_email_code(:'code') as redeemed;
reset role;
set test.uid = '';
select status, verification_method, verified_at is not null as verified
  from public.club_memberships where user_id = 'c4000000-0000-0000-0000-0000000000c4';

\echo ''
\echo '=== 37. the address did NOT become a login, and is not on the profile ==='
select count(*) as auth_rows_for_that_address from auth.users
 where email = 'someone@students.pitt.edu';
select email = 'codepath@gmail.com' as login_address_unchanged
  from public.profiles where id = 'c4000000-0000-0000-0000-0000000000c4';

\echo ''
\echo '=== 38. MUST FAIL: a code for a school you did not apply to ==='
set role authenticated;
set test.uid = 'c4000000-0000-0000-0000-0000000000c4';
select public.issue_school_email_code('someone@purdue.edu');

\echo ''
\echo '=== 39. a wrong code is refused, and reading the hash MUST FAIL ==='
select public.redeem_school_email_code('000000') as wrong_code_accepted;
select code_hash from public.school_email_codes limit 1;
reset role;

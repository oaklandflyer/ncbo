-- Supabase grants table privileges to these roles; RLS is the actual gate.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- The blanket grant above stands in for Supabase's own, and it hands back the
-- table-level SELECT that `restrict_columns()` takes away. Re-apply it, or the
-- email test below would be checking this line instead of the schema.
select public.restrict_columns('public.profiles', array['email']);
select public.restrict_columns('public.club_memberships',
  array['legal_name', 'group_chat_handle', 'group_chat_platform',
        'found_via', 'student_id_photo_path', 'decision_note']);
select public.restrict_columns('public.school_email_codes', array['code_hash']);

\set ON_ERROR_STOP 0
\pset pager off

\echo '=== 1. ANY address can sign up, and gets a live account with no chapter ==='
-- 0015 reversed 0001 here. A school address is no longer proof of anything:
-- students do not maintain a password on an inbox they never read, so the
-- address became a barrier to the people it was meant to admit. Verification
-- moved to a club lead, and this is the check that the door is open.
insert into auth.users (id, email) values
  ('0e000000-0000-0000-0000-00000000000e', 'someone@gmail.com');
select status as account_is_live,
       (school_id is null) as no_school_assigned,
       (club_id is null)   as no_club_assigned
  from profiles where id = '0e000000-0000-0000-0000-00000000000e';
select count(*) as memberships_created_by_signup
  from club_memberships where user_id = '0e000000-0000-0000-0000-00000000000e';

\echo ''
\echo '=== 2. a .edu signup is provisioned exactly like any other ==='
-- No school is resolved from the domain any more. The `school` column below
-- is null for all four on purpose: affiliation now comes from a membership a
-- lead granted, never from the right-hand side of an @.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alex@pitt.edu'),
  ('22222222-2222-2222-2222-222222222222', 'dana@cs.pitt.edu'),
  ('33333333-3333-3333-3333-333333333333', 'coach@psu.edu'),
  ('44444444-4444-4444-4444-444444444444', 'boss@purdue.edu');
select p.display_name, s.name as school, p.role
  from profiles p left join schools s on s.id = p.school_id order by p.display_name;

-- Promote by hand (as superuser) to set up the role fixtures.
update profiles set role = 'advisor' where id = '33333333-3333-3333-3333-333333333333';
update profiles set role = 'admin'   where id = '44444444-4444-4444-4444-444444444444';

\echo ''
\echo '=== 3. a member CANNOT promote themselves to admin ==='
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
update profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== 4. a member CANNOT reassign their own club ==='
update profiles set club_id = (select id from clubs limit 1)
  where id = '11111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== 5. a member CAN edit their own display name ==='
update profiles set display_name = 'Alex C.' where id = '11111111-1111-1111-1111-111111111111';
select display_name from profiles where id = '11111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== 6. a member CANNOT edit someone else''s profile ==='
update profiles set display_name = 'hacked' where id = '33333333-3333-3333-3333-333333333333';
select display_name from profiles where id = '33333333-3333-3333-3333-333333333333';

\echo ''
\echo '=== 7. member posts, one named + one anonymous ==='
insert into posts (channel_id, author_id, body, anonymous)
  values ((select id from channels where slug='general'), '11111111-1111-1111-1111-111111111111', 'Named post from Alex', false),
         ((select id from channels where slug='general'), '11111111-1111-1111-1111-111111111111', 'Anonymous post from Alex', true);

\echo ''
\echo '=== 8. a member CANNOT post as somebody else ==='
insert into posts (channel_id, author_id, body)
  values ((select id from channels where slug='general'), '33333333-3333-3333-3333-333333333333', 'forged');

\echo ''
\echo '=== 9. the feed hides the author of an anonymous post ==='
set test.uid = '33333333-3333-3333-3333-333333333333';  -- advisor reading the board
select author_name, author_school, anonymous, author_id is null as author_hidden, body
  from post_feed order by body;

\echo ''
\echo '=== 10. a member CANNOT answer a question ==='
set test.uid = '11111111-1111-1111-1111-111111111111';
insert into questions (author_id, body) values ('11111111-1111-1111-1111-111111111111', 'How early should I start prep?');
insert into answers (question_id, author_id, body)
  values ((select id from questions limit 1), '11111111-1111-1111-1111-111111111111', 'member trying to answer');

\echo ''
\echo '=== 11. an advisor CAN answer ==='
set test.uid = '33333333-3333-3333-3333-333333333333';
insert into answers (question_id, author_id, body)
  values ((select id from questions limit 1), '33333333-3333-3333-3333-333333333333', '16-20 weeks for a first show.');
select author_name, author_role, body from answer_feed;

\echo ''
\echo '=== 12. an admin CAN change a role ==='
set test.uid = '44444444-4444-4444-4444-444444444444';
update profiles set role = 'club_lead' where id = '11111111-1111-1111-1111-111111111111';
select display_name, role from profiles where id = '11111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== 13. a member CANNOT read raw posts (the anonymity boundary) ==='
set test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as raw_posts_visible_to_member from posts;
select count(*) as feed_posts_visible_to_member from post_feed;
reset role;

\echo ''
\echo '=== 14. a non-.edu address on the allowlist CAN sign up (staff) ==='
reset role;
insert into allowed_emails (email, note) values ('  Coach@IFBBpro.COM ', 'Advisory board — posing');
select email from allowed_emails;
insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'coach@ifbbpro.com');
select p.display_name, p.role, s.name as school
  from profiles p left join schools s on s.id = p.school_id
 where p.id = '55555555-5555-5555-5555-555555555555';

\echo ''
\echo '=== 15. an address not on the allowlist signs up live, and unaffiliated ==='
-- The allowlist is vestigial after 0015: it used to be the only way past the
-- .edu rule, and there is no .edu rule left. It is kept because it costs
-- nothing and admins may still have entries in it.
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'randomer@gmail.com');
select display_name, status from profiles where id = '99999999-9999-9999-9999-999999999999';
select count(*) as memberships from club_memberships
 where user_id = '99999999-9999-9999-9999-999999999999';

\echo ''
\echo '=== 16. a member CANNOT read or write the allowlist ==='
set role authenticated;
set test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as allowlist_rows_visible_to_member from allowed_emails;
insert into allowed_emails (email) values ('me@gmail.com');
reset role;

\echo ''
\echo '=== 17. a recognised school domain buys NO chapter access ==='
-- This is the point of the reframe, stated as a test. psu.edu is a school
-- NCBO runs a chapter at, and a psu.edu signup still lands with no school,
-- no club and no membership. Only a lead grants those.
reset role;
insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'newkid@psu.edu');
select display_name, status, (school_id is not null) as school_linked
  from profiles where id = '66666666-6666-6666-6666-666666666666';
select count(*) as memberships from club_memberships
 where user_id = '66666666-6666-6666-6666-666666666666';

\echo ''
\echo '=== 18. an unrecognised school domain is treated identically ==='
-- Same result as 17, which is the honest outcome: the database has no opinion
-- about either address, so it does not pretend to.
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'student@ohio-state.edu');
select display_name, status, (school_id is not null) as school_linked
  from profiles where id = '77777777-7777-7777-7777-777777777777';

\echo ''
\echo '=== 19. a pre-vetted staff address is approved on the spot ==='
insert into allowed_emails (email, note) values ('pro@ocbpro.com', 'Advisory');
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'pro@ocbpro.com');
select display_name, status from profiles where id = '88888888-8888-8888-8888-888888888888';

\echo ''
\echo '=== 20. nobody can hand themselves an account status ==='
set role authenticated;
set test.uid = '77777777-7777-7777-7777-777777777777';
update profiles set status = 'approved' where id = '77777777-7777-7777-7777-777777777777';

\echo ''
\echo '=== 21. an unaffiliated user CAN read the open surfaces ==='
-- Deliberately open, and this is the test that says so. Gating the whole app
-- behind verification kills signup conversion, so browsing, the calendar, Q&A
-- and club discovery are open to anybody with an account. What verification
-- gates is chapter membership, and that is tested in 02_membership.sql.
select count(*) as channels_visible from channels;
select count(*) > 0 as clubs_discoverable from club_directory;
select status as own_status_visible from profiles where id = '77777777-7777-7777-7777-777777777777';

\echo ''
\echo '=== 22. an unaffiliated user CAN ask a question ==='
insert into questions (author_id, body) values ('77777777-7777-7777-7777-777777777777', 'how do I find a club');

\echo ''
\echo '=== 23. but they are on NOBODY''s roster ==='
select count(*) as rosters_containing_them
  from club_memberships where user_id = '77777777-7777-7777-7777-777777777777';
reset role;

\echo ''
\echo '=== 24. signup no longer manufactures a name from the email address ==='
-- 0004 removed the split_part(email, '@', 1) fallback. A new profile arrives
-- with no display_name at all, which is what sends the member to /onboarding.
select count(*) as profiles_with_a_manufactured_name
  from profiles p join auth.users u on u.id = p.id
 where p.display_name is not null
   and lower(p.display_name) = lower(split_part(u.email, '@', 1));

\echo ''
\echo '=== 25. a member CAN fill in their own onboarding fields ==='
set role authenticated;
set test.uid = '77777777-7777-7777-7777-777777777777';
update profiles
   set full_name = 'Sam Rivera', display_name = 'Sam', class_year = 'Junior',
       major = 'Kinesiology', lifting_experience = '3–5 years', is_adult = true
 where id = '77777777-7777-7777-7777-777777777777';
-- The by-id overload, not `is_onboarded(p)`: a whole-row reference needs
-- SELECT on every column of the table, and `email` is held back from
-- `authenticated` by `restrict_columns()`.
select is_onboarded('77777777-7777-7777-7777-777777777777'::uuid) as onboarded_after_the_form;

\echo ''
\echo '=== 26. an unfinished profile does NOT count as onboarded ==='
select is_onboarded('55555555-5555-5555-5555-555555555555'::uuid)
         as onboarded_with_no_form_filled_in;

\echo ''
\echo '=== 27. nobody can make the 18+ attestation for someone else ==='
-- Not even an admin: this is the member's own statement, so the guard checks
-- it before the admin bypass.
set test.uid = '44444444-4444-4444-4444-444444444444';
update profiles set is_adult = true
  where id = '55555555-5555-5555-5555-555555555555';
reset role;

\echo ''
\echo '=== 28. declining is its own status, distinct from suspension ==='
set role authenticated;
set test.uid = '44444444-4444-4444-4444-444444444444';
update profiles set status = 'rejected' where id = '55555555-5555-5555-5555-555555555555';
select status as after_decline from profiles where id = '55555555-5555-5555-5555-555555555555';

\echo ''
\echo '=== 29. an admin CAN write an audit entry in their own name ==='
insert into admin_actions (actor_id, target_id, action, previous_status)
values ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555',
        'rejected', 'pending');
select action, previous_status from admin_actions where target_id = '55555555-5555-5555-5555-555555555555';

\echo ''
\echo '=== 30. an admin CANNOT write one in someone else''s name ==='
insert into admin_actions (actor_id, target_id, action)
values ('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'approved');

\echo ''
\echo '=== 31. the log is append-only — no update, no delete, even for an admin ==='
update admin_actions set action = 'approved' where target_id = '55555555-5555-5555-5555-555555555555';
select count(*) as rows_changed_by_update from admin_actions where action = 'approved';
delete from admin_actions where target_id = '55555555-5555-5555-5555-555555555555';
select count(*) as rows_left_after_delete from admin_actions where target_id = '55555555-5555-5555-5555-555555555555';

\echo ''
\echo '=== 32. a member CANNOT read the log ==='
set test.uid = '77777777-7777-7777-7777-777777777777';
select count(*) as log_rows_visible_to_a_member from admin_actions;
reset role;

-- ── club lead review scoping ────────────────────────────────────────────────
-- Fixtures: one pending account at Pitt (where user 1 is the club lead) and
-- one at Penn State (where they are not). Both addresses auto-approve on
-- signup, so they are put back to pending as superuser to make the queue.
reset role;
-- Clear the acting user as well as the role: auth.uid() reads a session GUC
-- that `reset role` leaves alone, and the privilege guard would otherwise
-- treat this superuser fixture as whoever the last test was pretending to be.
select set_config('test.uid', '', false);
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'freshman@pitt.edu'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'freshman@psu.edu');
update profiles set status = 'pending', approved_at = null
 where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

\echo ''
\echo '=== 33. the account-level approval queue no longer decides anything ==='
-- Kept, retitled, and its expectation corrected. This queue was already dead
-- before 0015: the lead here leads no club, so `my_led_clubs()` is empty and
-- the write was refused (UPDATE 0) on the baseline too. 0015 finished the job
-- by making the account status stop meaning "waiting to be let in" at all.
-- The queue that does decide something is club-scoped and lives in
-- 02_membership.sql, tests 4 through 9.
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';   -- alex@pitt.edu, club_lead
update profiles set status = 'approved', approved_at = now(), approved_by = auth.uid()
 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select status as pitt_pending_after_lead_approval
  from profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo ''
\echo '=== 34. a club lead CANNOT decide on another school''s account ==='
update profiles set status = 'approved'
 where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select status as psu_pending_untouched
  from profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

\echo ''
\echo '=== 35. a club lead CANNOT change a role, even at their own school ==='
update profiles set role = 'admin'
 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo ''
\echo '=== 36. a club lead CANNOT suspend an approved member at their own school ==='
update profiles set status = 'suspended'
 where id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '=== 37. a club lead CANNOT move someone to another school while deciding ==='
update profiles set status = 'rejected', school_id = null
 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo ''
\echo '=== 38. a club lead CAN log their own decision, but not another school''s ==='
insert into admin_actions (actor_id, target_id, action, previous_status)
values ('11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'approved', 'pending');
select count(*) as own_school_entries_visible_to_lead from admin_actions;
insert into admin_actions (actor_id, target_id, action)
values ('11111111-1111-1111-1111-111111111111',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'approved');

\echo ''
\echo '=== 39. an admin still reaches every school ==='
set test.uid = '44444444-4444-4444-4444-444444444444';
update profiles set status = 'approved', approved_at = now(), approved_by = auth.uid()
 where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select status as psu_pending_after_admin_approval
  from profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select count(*) as all_log_entries_visible_to_admin from admin_actions;
reset role;

\echo ''
\echo '=== 40. a new question is pending, and pending questions are NOT on the feed ==='
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
insert into questions (author_id, body, anonymous)
values ('11111111-1111-1111-1111-111111111111', 'Pending named question', false),
       ('11111111-1111-1111-1111-111111111111', 'Pending anonymous question', true);
select body, status from questions
 where body like 'Pending%' order by body;
select count(*) as pending_rows_on_member_feed
  from question_feed where body like 'Pending%';

\echo ''
\echo '=== 41. the author CANNOT approve their own question ==='
update questions set status = 'approved' where body = 'Pending named question';
select body, status as still_pending from questions where body = 'Pending named question';

\echo ''
\echo '=== 42. an advisor sees the queue and CAN approve ==='
set test.uid = '33333333-3333-3333-3333-333333333333';
select count(*) as pending_rows_visible_to_moderator
  from question_feed where status = 'pending';
update questions set status = 'approved', moderated_at = now(), moderated_by = auth.uid()
 where body = 'Pending named question';
select body, status as approved_by_advisor from questions where body = 'Pending named question';

\echo ''
\echo '=== 43. once approved it reaches the member, and the anonymous one still does not ==='
set test.uid = '22222222-2222-2222-2222-222222222222';
select body, author_name, author_id is null as author_hidden
  from question_feed where body like 'Pending%' order by body;

\echo ''
\echo '=== 44. a member CANNOT vet themselves or award themselves a credential ==='
set test.uid = '11111111-1111-1111-1111-111111111111';
update profiles set verified = true where id = '11111111-1111-1111-1111-111111111111';
update profiles set credentials = '{"IFBB Pro"}' where id = '11111111-1111-1111-1111-111111111111';
select verified as self_vetted, credentials as self_awarded
  from profiles where id = '11111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== 45. an admin CAN vet a coach ==='
set test.uid = '44444444-4444-4444-4444-444444444444';
update profiles set verified = true, verified_at = now(), verified_by = auth.uid(),
                    credentials = '{"IFBB Pro","OCB Wellness"}'
 where id = '33333333-3333-3333-3333-333333333333';
select verified, credentials from profiles where id = '33333333-3333-3333-3333-333333333333';
reset role;

\echo ''
\echo '=== 46. a member reads OTHER members'' approved questions through the feed ==='
-- The read path for the board is question_feed, not the base table. This is
-- what makes widening `questions_read_own` unnecessary — and unsafe: the base
-- table carries author_id, so exposing approved rows there would hand out the
-- author of every anonymous question.
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';   -- Alex asks
insert into questions (author_id, body, anonymous)
values ('11111111-1111-1111-1111-111111111111', 'Feed visibility check', false);
set test.uid = '33333333-3333-3333-3333-333333333333';   -- advisor approves
update questions set status = 'approved' where body = 'Feed visibility check';

set test.uid = '22222222-2222-2222-2222-222222222222';   -- Dana, a plain member
select body, author_name from question_feed where body = 'Feed visibility check';
select count(*) as same_row_via_base_table
  from questions where body = 'Feed visibility check';
select count(*) as anonymous_authors_dana_can_read
  from questions where anonymous;
reset role;

\echo ''
\echo '=== 47. a member CANNOT vote as somebody else, and CANNOT vote twice ==='
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
insert into question_votes (question_id, user_id)
values ((select id from questions where status='approved' order by created_at limit 1),
        '33333333-3333-3333-3333-333333333333');
insert into question_votes (question_id, user_id)
values ((select id from questions where status='approved' order by created_at limit 1),
        '11111111-1111-1111-1111-111111111111')
on conflict do nothing;
insert into question_votes (question_id, user_id)
values ((select id from questions where status='approved' order by created_at limit 1),
        '11111111-1111-1111-1111-111111111111');

\echo ''
\echo '=== 48. a member CANNOT delete somebody else''s vote ==='
delete from question_votes where user_id = '33333333-3333-3333-3333-333333333333';
select count(*) as other_members_votes_intact
  from question_votes where user_id = '33333333-3333-3333-3333-333333333333';

\echo ''
\echo '=== 49. a member CANNOT add a resource; a moderator CAN ==='
insert into resources (title, category, type, external_url)
values ('Member-added resource', 'General', 'article', 'https://example.com/x');
set test.uid = '33333333-3333-3333-3333-333333333333';
insert into resources (title, category, type, external_url)
values ('Advisor-added resource', 'General', 'article', 'https://example.com/x');
select title from resources where title like '%-added resource';

\echo ''
\echo '=== 50. a resource URL must be https, and cannot be a script ==='
insert into resources (title, category, type, external_url)
values ('Script link', 'General', 'article', 'javascript:alert(1)');
insert into resources (title, category, type, external_url)
values ('Plain http link', 'General', 'article', 'http://example.com/x');

\echo ''
\echo '=== 51. a member CAN set their own social handles, but not a URL ==='
set test.uid = '11111111-1111-1111-1111-111111111111';
update profiles set instagram_handle = 'alex.lifts'
 where id = '11111111-1111-1111-1111-111111111111';
select instagram_handle from profiles where id = '11111111-1111-1111-1111-111111111111';
update profiles set instagram_handle = 'https://instagram.com/someone'
 where id = '11111111-1111-1111-1111-111111111111';
update profiles set instagram_handle = 'hacked'
 where id = '33333333-3333-3333-3333-333333333333';
select instagram_handle as advisor_handle_untouched
  from profiles where id = '33333333-3333-3333-3333-333333333333';
reset role;

\echo ''
\echo '=== 52. the widened board policy: approved+named readable, anonymous NOT ==='
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
insert into questions (id, author_id, body, status, anonymous) values
  ('aaaa0000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
   'V1 approved named', 'approved', false),
  ('bbbb0000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111',
   'V1 approved anonymous', 'approved', true);
set test.uid = '22222222-2222-2222-2222-222222222222';   -- a plain member
select body as base_table_rows_dana_can_read
  from questions where body like 'V1 %' order by body;
select body, author_id is null as author_hidden
  from question_feed where body like 'V1 %' order by body;

\echo ''
\echo '=== 53. a member CANNOT soft-delete another member''s question ==='
update questions set deleted_at = now() where id = 'aaaa0000-0000-0000-0000-00000000000a';
select count(*) as still_live
  from questions where id = 'aaaa0000-0000-0000-0000-00000000000a' and deleted_at is null;

\echo ''
\echo '=== 54. an advisor CAN, and the answers survive the removal ==='
set test.uid = '33333333-3333-3333-3333-333333333333';
insert into answers (question_id, author_id, body)
values ('aaaa0000-0000-0000-0000-00000000000a', '33333333-3333-3333-3333-333333333333', 'Kept.');
update questions set deleted_at = now(), deleted_by = auth.uid()
 where id = 'aaaa0000-0000-0000-0000-00000000000a';
select count(*) as removed_from_feed
  from question_feed where id = 'aaaa0000-0000-0000-0000-00000000000a';
select count(*) as answer_still_recoverable
  from answers where question_id = 'aaaa0000-0000-0000-0000-00000000000a';

\echo ''
\echo '=== 55. the roster is one club per school, pipelines included ==='
select status, count(*) from club_directory group by status order by status;
select count(*) as clubs_with_leads from club_directory where array_length(leads, 1) > 0;
reset role;

\echo ''
\echo '=== 56. a plain member marks THEMSELVES alumni, and nobody else ==='
-- 2222 is a plain member; 1111 is a club lead by this point in the suite, and
-- a lead marking their own school's graduates is allowed by design (test 57a).
set role authenticated;
set test.uid = '22222222-2222-2222-2222-222222222222';
update profiles set is_alumni = true, alumni_since = current_date
 where id = '22222222-2222-2222-2222-222222222222';
select is_alumni as self_marked from profiles where id = '22222222-2222-2222-2222-222222222222';
update profiles set is_alumni = true where id = '33333333-3333-3333-3333-333333333333';
select is_alumni as advisor_untouched from profiles where id = '33333333-3333-3333-3333-333333333333';

\echo ''
\echo '=== 57a. a club lead CAN mark a graduate at their own school ==='
set test.uid = '11111111-1111-1111-1111-111111111111';
update profiles set is_alumni = false where id = '22222222-2222-2222-2222-222222222222';
select is_alumni as lead_cleared_it from profiles where id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '=== 57. an advisor CAN edit a member''s details and alumni flag ==='
set test.uid = '33333333-3333-3333-3333-333333333333';
update profiles set display_name = 'Corrected Name', is_alumni = true
 where id = '22222222-2222-2222-2222-222222222222';
select display_name, is_alumni from profiles where id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '=== 58. an advisor CANNOT remove an account or change a role ==='
update profiles set status = 'removed' where id = '22222222-2222-2222-2222-222222222222';
update profiles set role = 'admin' where id = '33333333-3333-3333-3333-333333333333';
select status as status_unchanged from profiles where id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '=== 59. an admin CAN remove an account, and it leaves the directory ==='
set test.uid = '44444444-4444-4444-4444-444444444444';
update profiles set status = 'removed' where id = '22222222-2222-2222-2222-222222222222';
select status as removed_status from profiles where id = '22222222-2222-2222-2222-222222222222';
select count(*) as rows_in_directory
  from member_directory where id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '=== 60. site settings: everyone reads, only moderators write ==='
set test.uid = '11111111-1111-1111-1111-111111111111';
select count(*) as settings_readable_by_member from site_settings;
update site_settings set logo_path = 'member-was-here.png' where id;
select coalesce(logo_path, 'still null') as after_member_write from site_settings;
set test.uid = '33333333-3333-3333-3333-333333333333';
update site_settings set logo_path = 'logo-1.png' where id;
select logo_path as after_advisor_write from site_settings;
reset role;

\echo ''
\echo '=== 61. MUST FAIL: email is NOT selectable by a member, through any path ==='
set role authenticated;
set test.uid = '22222222-2222-2222-2222-222222222222';
-- Column privilege, not RLS: this is a hard refusal, not an empty result.
select email from profiles where id = '11111111-1111-1111-1111-111111111111';
select * from member_directory limit 1;   -- projection must not carry email

\echo ''
\echo '=== 62. a member CANNOT call the privileged readers ==='
select * from get_admin_members();
select * from get_club_roster((select id from clubs limit 1));

\echo ''
\echo '=== 63. leadership is club-scoped: two clubs at two schools, one lead ==='
-- `reset role` alone is not enough: auth.uid() reads a GUC, so the privilege
-- guard still saw a member and refused the fixture writes.
reset role;
set test.uid = '';
insert into auth.users (id, email) values
  ('dddd0000-0000-0000-0000-00000000000d', 'leadA@pitt.edu'),
  ('eeee0000-0000-0000-0000-00000000000e', 'memberA@pitt.edu'),
  ('ffff0000-0000-0000-0000-00000000000f', 'memberB@pitt.edu');
-- Two clubs at two DIFFERENT universities. Before 0015 this fixture built a
-- second club at Pitt, which the 1:1 unique index now forbids outright: a
-- university has exactly one club, so the only way two clubs can exist is at
-- two schools. That makes this the acceptance case from 2.2 as well as a
-- scoping test, since Purdue is somebody else's chapter.
update profiles set role = 'club_lead', status = 'approved',
       club_id = (select id from clubs where name = 'Fitness and Bodybuilding Club')
 where id = 'dddd0000-0000-0000-0000-00000000000d';
update profiles set status = 'approved',
       club_id = (select id from clubs where name = 'Fitness and Bodybuilding Club')
 where id = 'eeee0000-0000-0000-0000-00000000000e';
update profiles set status = 'approved',
       club_id = (select id from clubs where name = 'Purdue Bodybuilding Club')
 where id = 'ffff0000-0000-0000-0000-00000000000f';

insert into club_leads (club_id, name, profile_id, ordinal)
values ((select id from clubs where name = 'Fitness and Bodybuilding Club'),
        'Lead A', 'dddd0000-0000-0000-0000-00000000000d', 1);

set role authenticated;
set test.uid = 'dddd0000-0000-0000-0000-00000000000d';
select array_length(my_led_clubs(), 1) as clubs_i_lead;
select display_name, role, club_id is not null as has_club
  from profiles where id = 'dddd0000-0000-0000-0000-00000000000d';
select leads_club_of('eeee0000-0000-0000-0000-00000000000e') as leads_own_club_member;
select leads_club_of('ffff0000-0000-0000-0000-00000000000f') as leads_other_club_member;

\echo ''
\echo '=== 64. a lead CAN edit their own club''s member, NOT another chapter''s ==='
update profiles set division = 'Bikini' where id = 'eeee0000-0000-0000-0000-00000000000e';
select division as own_club_edited from profiles where id = 'eeee0000-0000-0000-0000-00000000000e';
update profiles set division = 'Should not stick' where id = 'ffff0000-0000-0000-0000-00000000000f';
select coalesce(division, 'untouched') as other_club_untouched
  from profiles where id = 'ffff0000-0000-0000-0000-00000000000f';

\echo ''
\echo '=== 65. a lead CAN read their own club''s emails, NOT another chapter''s ==='
select count(*) as own_roster_rows
  from get_club_roster((select id from clubs where name = 'Fitness and Bodybuilding Club'));
select count(*) from get_club_roster((select id from clubs where name = 'Purdue Bodybuilding Club'));

\echo ''
\echo '=== 66. a lead CANNOT promote themselves to admin or remove an account ==='
update profiles set role = 'admin' where id = 'dddd0000-0000-0000-0000-00000000000d';
update profiles set status = 'removed' where id = 'eeee0000-0000-0000-0000-00000000000e';
select role as lead_role_unchanged, status as member_status_unchanged
  from profiles where id = 'dddd0000-0000-0000-0000-00000000000d';

\echo ''
\echo '=== 67. a lead CAN take a member off the roster, but not reassign them ==='
update profiles set club_id = null where id = 'eeee0000-0000-0000-0000-00000000000e';
select coalesce(club_id::text, 'off the roster') as after_removal
  from profiles where id = 'eeee0000-0000-0000-0000-00000000000e';

\echo ''
\echo '=== 68. an advisor moderates content but CANNOT manage accounts ==='
set test.uid = '33333333-3333-3333-3333-333333333333';
select is_moderator() as advisor_moderates;
update profiles set status = 'removed' where id = 'ffff0000-0000-0000-0000-00000000000f';

\echo ''
\echo '=== 69. an admin sees every member, with addresses ==='
set test.uid = '44444444-4444-4444-4444-444444444444';
select count(*) > 0 as admin_sees_members, count(*) filter (where email is not null) > 0 as with_emails
  from get_admin_members();
reset role;

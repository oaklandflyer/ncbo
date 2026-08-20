-- Supabase grants table privileges to these roles; RLS is the actual gate.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

\set ON_ERROR_STOP 0
\pset pager off

\echo '=== 1. non-.edu signup is rejected ==='
insert into auth.users (email) values ('someone@gmail.com');

\echo ''
\echo '=== 2. .edu signup provisions a profile and maps the school ==='
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
\echo '=== 15. a non-.edu address NOT on the allowlist signs up PENDING ==='
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'randomer@gmail.com');
select display_name, status from profiles where id = '99999999-9999-9999-9999-999999999999';

\echo ''
\echo '=== 16. a member CANNOT read or write the allowlist ==='
set role authenticated;
set test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as allowlist_rows_visible_to_member from allowed_emails;
insert into allowed_emails (email) values ('me@gmail.com');
reset role;

\echo ''
\echo '=== 17. .edu at a KNOWN school is approved automatically ==='
reset role;
insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'newkid@psu.edu');
select display_name, status, (school_id is not null) as school_linked
  from profiles where id = '66666666-6666-6666-6666-666666666666';

\echo ''
\echo '=== 18. .edu at an UNKNOWN school lands in the queue ==='
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'student@ohio-state.edu');
select display_name, status, (school_id is not null) as school_linked
  from profiles where id = '77777777-7777-7777-7777-777777777777';

\echo ''
\echo '=== 19. a pre-vetted staff address is approved on the spot ==='
insert into allowed_emails (email, note) values ('pro@ocbpro.com', 'Advisory');
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'pro@ocbpro.com');
select display_name, status from profiles where id = '88888888-8888-8888-8888-888888888888';

\echo ''
\echo '=== 20. a pending user CANNOT approve themselves ==='
set role authenticated;
set test.uid = '77777777-7777-7777-7777-777777777777';
update profiles set status = 'approved' where id = '77777777-7777-7777-7777-777777777777';

\echo ''
\echo '=== 21. a pending user CANNOT read the board, but CAN see their own row ==='
select count(*) as channels_visible_to_pending from channels;
select count(*) as posts_visible_to_pending from post_feed;
select status as own_status_visible from profiles where id = '77777777-7777-7777-7777-777777777777';

\echo ''
\echo '=== 22. a pending user CANNOT post ==='
insert into questions (author_id, body) values ('77777777-7777-7777-7777-777777777777', 'let me in');

\echo ''
\echo '=== 23. an admin CAN approve them, and then the board opens up ==='
set test.uid = '44444444-4444-4444-4444-444444444444';
update profiles set status = 'approved', approved_at = now(), approved_by = auth.uid()
  where id = '77777777-7777-7777-7777-777777777777';
set test.uid = '77777777-7777-7777-7777-777777777777';
select count(*) as channels_visible_after_approval from channels;
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
select is_onboarded(p) as onboarded_after_the_form
  from profiles p where id = '77777777-7777-7777-7777-777777777777';

\echo ''
\echo '=== 26. an unfinished profile does NOT count as onboarded ==='
select is_onboarded(p) as onboarded_with_no_form_filled_in
  from profiles p where id = '55555555-5555-5555-5555-555555555555';

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
\echo '=== 33. a club lead CAN approve a pending account at their own school ==='
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

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

-- ============================================================================
-- Competitions, results, and rankings.
--
-- The three things worth testing here are the three that decide whether a
-- leaderboard means anything: you cannot confirm your own result, you cannot
-- confirm another chapter's, and an unconfirmed result scores nothing.
--
-- Conventions as in 01 and 02: MUST FAIL passes by printing a loud ERROR, and
-- a policy-filtered write is `UPDATE 0` rather than a raise.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

select public.restrict_columns('public.profiles', array['email']);
select public.restrict_columns('public.club_memberships',
  array['legal_name', 'group_chat_handle', 'group_chat_platform',
        'found_via', 'student_id_photo_path', 'decision_note']);

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== fixtures: two chapters, nine lifters, two shows ==='
insert into auth.users (id, email) values
  ('11110000-0000-0000-0000-000000001111', 'pl@example.com'),
  ('22220000-0000-0000-0000-000000002222', 'p1@example.com'),
  ('33330000-0000-0000-0000-000000003333', 'p2@example.com'),
  ('44440000-0000-0000-0000-000000004444', 'p3@example.com'),
  ('55550000-0000-0000-0000-000000005555', 'p4@example.com'),
  ('66660000-0000-0000-0000-000000006666', 'p5@example.com'),
  ('77770000-0000-0000-0000-000000007777', 'p6@example.com'),
  ('88880000-0000-0000-0000-000000008888', 'ul@example.com'),
  ('99990000-0000-0000-0000-000000009999', 'u1@example.com'),
  ('aaaa0000-0000-0000-0000-00000000aaaa', 'nobody2@example.com');

update public.profiles set display_name = v.n from (values
  ('11110000-0000-0000-0000-000000001111'::uuid, 'Pitt Lead C'),
  ('22220000-0000-0000-0000-000000002222'::uuid, 'Pitt One'),
  ('33330000-0000-0000-0000-000000003333'::uuid, 'Pitt Two'),
  ('44440000-0000-0000-0000-000000004444'::uuid, 'Pitt Three'),
  ('55550000-0000-0000-0000-000000005555'::uuid, 'Pitt Four'),
  ('66660000-0000-0000-0000-000000006666'::uuid, 'Pitt Five'),
  ('77770000-0000-0000-0000-000000007777'::uuid, 'Pitt Six'),
  ('88880000-0000-0000-0000-000000008888'::uuid, 'Iowa Lead'),
  ('99990000-0000-0000-0000-000000009999'::uuid, 'Iowa One'),
  ('aaaa0000-0000-0000-0000-00000000aaaa'::uuid, 'No Chapter')
) as v(id, n) where public.profiles.id = v.id;

insert into public.club_memberships (user_id, club_id, status, role, verified_at, verification_method)
select v.uid, c.id, 'active', v.rl::public.membership_role, now(), 'club_lead'
  from (values
    ('11110000-0000-0000-0000-000000001111'::uuid, 'Fitness and Bodybuilding Club', 'club_lead'),
    ('22220000-0000-0000-0000-000000002222'::uuid, 'Fitness and Bodybuilding Club', 'member'),
    ('33330000-0000-0000-0000-000000003333'::uuid, 'Fitness and Bodybuilding Club', 'member'),
    ('44440000-0000-0000-0000-000000004444'::uuid, 'Fitness and Bodybuilding Club', 'member'),
    ('55550000-0000-0000-0000-000000005555'::uuid, 'Fitness and Bodybuilding Club', 'member'),
    ('66660000-0000-0000-0000-000000006666'::uuid, 'Fitness and Bodybuilding Club', 'member'),
    ('77770000-0000-0000-0000-000000007777'::uuid, 'Fitness and Bodybuilding Club', 'member'),
    ('88880000-0000-0000-0000-000000008888'::uuid, 'Bodybuilding Club at UIowa', 'club_lead'),
    ('99990000-0000-0000-0000-000000009999'::uuid, 'Bodybuilding Club at UIowa', 'member')
  ) as v(uid, club, rl)
  join public.clubs c on c.name = v.club;

insert into public.competitions (id, name, federation_id, level, starts_on, city, state, ncbo_sanctioned)
select '0c000000-0000-0000-0000-00000000000c', 'Spring Natural Open', f.id, 'regional',
       current_date - 30, 'Pittsburgh', 'PA', true
  from public.federations f where f.code = 'OCB';

insert into public.competitions (id, name, federation_id, level, starts_on, city, state)
select '0d000000-0000-0000-0000-00000000000d', 'Autumn Collegiate Showdown', f.id, 'national',
       current_date + 45, 'Columbus', 'OH'
  from public.federations f where f.code = 'OCB';

\echo ''
\echo '=== 1. the scoring curve: steep at the top, flat at the bottom ==='
select placement_points(1, 'local')  as first_local,
       placement_points(2, 'local')  as second_local,
       placement_points(8, 'local')  as eighth_local,
       placement_points(9, 'local')  as ninth_local,
       placement_points(1, 'national') as first_national,
       placement_points(null, 'local') as competed_only;

\echo ''
\echo '=== 2. an entry stamps the chapter from the membership, not the request ==='
set role authenticated;
set test.uid = '22220000-0000-0000-0000-000000002222';
-- Deliberately claiming Iowa. The trigger overwrites it with Pitt.
insert into public.competition_entries (competition_id, user_id, club_id, division, placement, class_size)
select '0c000000-0000-0000-0000-00000000000c', '22220000-0000-0000-0000-000000002222',
       (select id from public.clubs where name = 'Bodybuilding Club at UIowa'),
       'Men''s Physique', 1, 12;
reset role;
set test.uid = '';
select c.name as chapter_it_actually_scores_for, e.status
  from public.competition_entries e join public.clubs c on c.id = e.club_id
 where e.user_id = '22220000-0000-0000-0000-000000002222';

\echo ''
\echo '=== 3. MUST FAIL: confirming your own result ==='
set role authenticated;
set test.uid = '22220000-0000-0000-0000-000000002222';
update public.competition_entries set status = 'confirmed'
 where user_id = '22220000-0000-0000-0000-000000002222';

\echo ''
\echo '=== 4. a pending result scores nothing and is on no leaderboard ==='
reset role;
set test.uid = '';
select count(*) as scored_rows from public.scored_results;
select count(*) as ranking_rows from public.national_rankings;

\echo ''
\echo '=== 5. MUST FAIL: another chapter''s lead confirming it ==='
set role authenticated;
set test.uid = '88880000-0000-0000-0000-000000008888';
update public.competition_entries set status = 'confirmed'
 where user_id = '22220000-0000-0000-0000-000000002222';

\echo ''
\echo '=== 6. the entrant''s own lead CAN confirm, and it is recorded ==='
set test.uid = '11110000-0000-0000-0000-000000001111';
update public.competition_entries set status = 'confirmed'
 where user_id = '22220000-0000-0000-0000-000000002222';
reset role;
set test.uid = '';
select e.status, p.display_name as confirmed_by, e.confirmed_at is not null as stamped
  from public.competition_entries e
  left join public.profiles p on p.id = e.confirmed_by
 where e.user_id = '22220000-0000-0000-0000-000000002222';

\echo ''
\echo '=== 7. and now it scores ==='
select display_name, chapter, shows, points, rank from public.national_rankings order by rank;

\echo ''
\echo '=== 8. MUST FAIL: editing a placement after it was confirmed ==='
set role authenticated;
set test.uid = '22220000-0000-0000-0000-000000002222';
update public.competition_entries set placement = 1, class_size = 200
 where user_id = '22220000-0000-0000-0000-000000002222';

\echo ''
\echo '=== 9. a chapter scores its best five, not its total ==='
-- Seven Pitt lifters, all confirmed. Only the top five count, so the sixth
-- and seventh add nothing: a chapter of ninety must not win by existing.
reset role;
set test.uid = '';
insert into public.competition_entries
  (competition_id, user_id, club_id, division, placement, class_size, status, confirmed_at)
select '0c000000-0000-0000-0000-00000000000c', v.uid,
       (select id from public.clubs where name = 'Fitness and Bodybuilding Club'),
       v.div, v.pl, 10, 'confirmed', now()
  from (values
    ('33330000-0000-0000-0000-000000003333'::uuid, 'Classic Physique', 2),
    ('44440000-0000-0000-0000-000000004444'::uuid, 'Bikini', 3),
    ('55550000-0000-0000-0000-000000005555'::uuid, 'Wellness', 4),
    ('66660000-0000-0000-0000-000000006666'::uuid, 'Figure', 5),
    ('77770000-0000-0000-0000-000000007777'::uuid, 'Bodybuilding', 6)
  ) as v(uid, div, pl);

insert into public.competition_entries
  (competition_id, user_id, club_id, division, placement, class_size, status, confirmed_at)
select '0c000000-0000-0000-0000-00000000000c', '99990000-0000-0000-0000-000000009999',
       (select id from public.clubs where name = 'Bodybuilding Club at UIowa'),
       'Men''s Physique', 1, 10, 'confirmed', now();

select chapter, competing_members, scoring_members, shows, points, rank
  from public.chapter_rankings order by rank;

\echo ''
\echo '=== 10. the calendar is open to somebody with no chapter at all ==='
set role authenticated;
set test.uid = 'aaaa0000-0000-0000-0000-00000000aaaa';
select count(*) as competitions_visible_to_an_unaffiliated_account from public.competitions;
select name, level, starts_on > current_date as upcoming
  from public.competitions order by starts_on;

\echo ''
\echo '=== 11. but a pending result of somebody else''s is not ==='
reset role;
set test.uid = '';
insert into public.competition_entries (competition_id, user_id, club_id, division, placement, status)
values ('0d000000-0000-0000-0000-00000000000d', '33330000-0000-0000-0000-000000003333',
        (select id from public.clubs where name = 'Fitness and Bodybuilding Club'),
        'Classic Physique', 1, 'pending');
set role authenticated;
set test.uid = 'aaaa0000-0000-0000-0000-00000000aaaa';
select count(*) as pending_results_visible_to_a_stranger
  from public.competition_entries where status = 'pending';

\echo ''
\echo '=== 12. competition history on the profile popup is confirmed only ==='
select competition_name, placement, points
  from public.get_competition_history('33330000-0000-0000-0000-000000003333');

\echo ''
\echo '=== 13. MUST FAIL: an ordinary member putting a show on the calendar ==='
set test.uid = '22220000-0000-0000-0000-000000002222';
insert into public.competitions (name, level, starts_on)
values ('Made-up Invitational', 'national', current_date + 10);

\echo ''
\echo '=== 14. a club lead CAN, because their members are entering it ==='
set test.uid = '11110000-0000-0000-0000-000000001111';
insert into public.competitions (name, level, starts_on)
values ('Local Qualifier', 'local', current_date + 20);
select name, created_by is not null as creator_stamped
  from public.competitions where name = 'Local Qualifier';
reset role;

-- ============================================================================
-- The Q&A starter library
-- ============================================================================
\echo ''
\echo '=== 15. the board is not empty on day one ==='
reset role;
set test.uid = '';
select count(*) as starter_questions from public.questions
 where author_id = '00000000-0000-4000-a000-00000000ed17';
select count(*) as starter_answers from public.answers where body like '%[starter]%';
select count(*) as unanswered_starters from public.questions q
 where q.author_id = '00000000-0000-4000-a000-00000000ed17'
   and not exists (select 1 from public.answers a where a.question_id = q.id);

\echo ''
\echo '=== 16. they are attributed to the desk, not to a named advisor ==='
select p.display_name as byline, count(*) as answers
  from public.answers a join public.profiles p on p.id = a.author_id
 where a.body like '%[starter]%'
 group by p.display_name;

\echo ''
\echo '=== 17. a member reads them, and they are approved rather than pending ==='
set role authenticated;
set test.uid = '22220000-0000-0000-0000-000000002222';
select count(*) as starter_rows_on_the_member_feed
  from public.question_feed where answered and status = 'approved';
reset role;

\echo ''
\echo '=== 18. the whole set is clearable in one statement ==='
-- Not run here, just proved to match: this is the query the migration header
-- promises a moderator can use to clear the library once advisors replace it.
select count(*) as rows_that_would_be_cleared
  from public.answers where body like '%[starter]%';

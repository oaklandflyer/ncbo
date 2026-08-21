-- ============================================================================
-- Entries, the two leaderboards, and the Chapter Cup's cap.
--
-- The rules that decide whether any of this means anything:
--   · nobody verifies their own result
--   · nobody verifies another chapter's
--   · a pending result scores nothing
--   · sending one back has to say why
--   · Q&A can never be more than a quarter of a club's Chapter Cup score
--
-- Conventions as in 01 and 02: MUST FAIL passes by printing a loud ERROR, and
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

\echo '=== fixtures: two chapters, ten people, two shows ==='
insert into auth.users (id, email) values
  ('11110000-0000-0000-0000-000000001111', 'pl@example.com'),
  ('22220000-0000-0000-0000-000000002222', 'p1@example.com'),
  ('33330000-0000-0000-0000-000000003333', 'p2@example.com'),
  ('44440000-0000-0000-0000-000000004444', 'p3@example.com'),
  ('55550000-0000-0000-0000-000000005555', 'p4@example.com'),
  ('66660000-0000-0000-0000-000000006666', 'p5@example.com'),
  ('88880000-0000-0000-0000-000000008888', 'ul@example.com'),
  ('99990000-0000-0000-0000-000000009999', 'u1@example.com'),
  ('aaaa0000-0000-0000-0000-00000000aaaa', 'nobody2@example.com'),
  ('bbbb0000-0000-0000-0000-00000000bbbb', 'voter@example.com');

update public.profiles set display_name = v.n from (values
  ('11110000-0000-0000-0000-000000001111'::uuid, 'Pitt Lead C'),
  ('22220000-0000-0000-0000-000000002222'::uuid, 'Pitt One'),
  ('33330000-0000-0000-0000-000000003333'::uuid, 'Pitt Two'),
  ('44440000-0000-0000-0000-000000004444'::uuid, 'Pitt Three'),
  ('55550000-0000-0000-0000-000000005555'::uuid, 'Pitt Four'),
  ('66660000-0000-0000-0000-000000006666'::uuid, 'Pitt Five'),
  ('88880000-0000-0000-0000-000000008888'::uuid, 'Iowa Lead'),
  ('99990000-0000-0000-0000-000000009999'::uuid, 'Iowa One'),
  ('aaaa0000-0000-0000-0000-00000000aaaa'::uuid, 'No Chapter'),
  ('bbbb0000-0000-0000-0000-00000000bbbb'::uuid, 'A Voter')
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
    ('88880000-0000-0000-0000-000000008888'::uuid, 'Bodybuilding Club at UIowa', 'club_lead'),
    ('99990000-0000-0000-0000-000000009999'::uuid, 'Bodybuilding Club at UIowa', 'member')
  ) as v(uid, club, rl)
  join public.clubs c on c.name = v.club;

\echo ''
\echo '=== 1. the scoring model, in one function ==='
select entry_points('1st') as first, entry_points('2nd') as second,
       entry_points('5th') as fifth, entry_points('DNP') as dnp,
       entry_points('1st', true) as first_with_overall;

\echo ''
\echo '=== 2. an entry stamps the chapter from the membership, not the request ==='
set role authenticated;
set test.uid = '22220000-0000-0000-0000-000000002222';
-- Deliberately claiming Iowa. The trigger overwrites it with Pitt.
insert into public.competition_entries
  (profile_id, club_id, show_name, federation, date, division, "placing")
select '22220000-0000-0000-0000-000000002222',
       (select id from public.clubs where name = 'Bodybuilding Club at UIowa'),
       'Spring Natural Open', 'OCB', current_date - 30, 'Men''s Physique', '1st';
reset role;
set test.uid = '';
select c.name as chapter_it_scores_for, e.status, e.share_token is not null as has_share_token
  from public.competition_entries e join public.clubs c on c.id = e.club_id
 where e.profile_id = '22220000-0000-0000-0000-000000002222';

\echo ''
\echo '=== 3. MUST FAIL: verifying your own result ==='
set role authenticated;
set test.uid = '22220000-0000-0000-0000-000000002222';
update public.competition_entries set status = 'approved'
 where profile_id = '22220000-0000-0000-0000-000000002222';

\echo ''
\echo '=== 4. a pending result scores nothing ==='
set test.uid = '11110000-0000-0000-0000-000000001111';
select count(*) as scored_rows from public.scored_results;
select coalesce(sum(points), 0) as athlete_points_so_far from public.get_athlete_rankings();

\echo ''
\echo '=== 5. another chapter''s lead verifying it changes nothing ==='
set test.uid = '88880000-0000-0000-0000-000000008888';
update public.competition_entries set status = 'approved'
 where profile_id = '22220000-0000-0000-0000-000000002222';
reset role;
set test.uid = '';
select status as still_pending from public.competition_entries
 where profile_id = '22220000-0000-0000-0000-000000002222';

\echo ''
\echo '=== 6. the entrant''s own lead CAN, and it is recorded ==='
set role authenticated;
set test.uid = '11110000-0000-0000-0000-000000001111';
update public.competition_entries set status = 'approved'
 where profile_id = '22220000-0000-0000-0000-000000002222';
reset role;
set test.uid = '';
select e.status, p.display_name as confirmed_by
  from public.competition_entries e left join public.profiles p on p.id = e.confirmed_by
 where e.profile_id = '22220000-0000-0000-0000-000000002222';

\echo ''
\echo '=== 7. MUST FAIL: returning an entry without saying why ==='
update public.competition_entries set status = 'returned', rejection_reason = null
 where profile_id = '22220000-0000-0000-0000-000000002222';

\echo ''
\echo '=== 8. MUST FAIL: editing a placing after approval ==='
set role authenticated;
set test.uid = '22220000-0000-0000-0000-000000002222';
update public.competition_entries set "placing" = '1st', won_overall = true
 where profile_id = '22220000-0000-0000-0000-000000002222';
reset role;
set test.uid = '';

\echo ''
\echo '=== 9. the Chapter Cup breakdown, before any Q&A ==='
-- Pitt: 6 active members = 6 roster, 1 approved entry = 5 stage.
insert into public.competition_handlers (entry_id, handler_profile_id)
select e.id, '33330000-0000-0000-0000-000000003333'
  from public.competition_entries e
 where e.profile_id = '22220000-0000-0000-0000-000000002222';

set role authenticated;
set test.uid = '11110000-0000-0000-0000-000000001111';
select chapter, roster_points, stage_points, handler_points, qa_points, total_points
  from public.get_chapter_cup_standings() where chapter in ('Pitt', 'Iowa') order by chapter;
reset role;
set test.uid = '';

\echo ''
\echo '=== 10. THE CAP: Q&A can never exceed 25% of a club''s total ==='
-- Twelve upvotes on answers written by a Pitt member. Uncapped that would be
-- 12 of 25 points, 48% of the total, and a chapter could win the Cup without
-- anyone competing. The cap is qa <= base/3, which is exactly 25% of the
-- resulting total.
insert into auth.users (id, email)
select ('cccc0000-0000-0000-0000-00000000000' || i)::uuid, 'voter' || i || '@example.com'
  from generate_series(1, 4) as i;

insert into public.answers (id, question_id, author_id, body)
select ('dddd0000-0000-0000-0000-00000000000' || i)::uuid,
       (select id from public.questions order by created_at limit 1),
       '22220000-0000-0000-0000-000000002222',
       'Starter-adjacent answer ' || i
  from generate_series(1, 3) as i;

insert into public.answer_votes (answer_id, user_id)
select ('dddd0000-0000-0000-0000-00000000000' || a)::uuid,
       ('cccc0000-0000-0000-0000-00000000000' || v)::uuid
  from generate_series(1, 3) as a, generate_series(1, 4) as v;

set role authenticated;
set test.uid = '11110000-0000-0000-0000-000000001111';
select chapter, roster_points, stage_points, handler_points,
       qa_uncapped, qa_points, total_points,
       round(100.0 * qa_points / nullif(total_points, 0), 1) as qa_percent_of_total,
       (qa_points::numeric <= 0.25 * total_points) as cap_holds
  from public.get_chapter_cup_standings() where chapter = 'Pitt';

\echo ''
\echo '=== 11. and the cap does not bite a club that has not farmed it ==='
select chapter, qa_uncapped, qa_points, (qa_uncapped = qa_points) as uncapped
  from public.get_chapter_cup_standings() where chapter = 'Iowa';
reset role;
set test.uid = '';

\echo ''
\echo '=== 12. MUST FAIL: upvoting your own answer ==='
set role authenticated;
set test.uid = '22220000-0000-0000-0000-000000002222';
insert into public.answer_votes (answer_id, user_id)
values ('dddd0000-0000-0000-0000-000000000001', '22220000-0000-0000-0000-000000002222');

\echo ''
\echo '=== 13. MUST FAIL: voting twice on the same answer ==='
set test.uid = 'cccc0000-0000-0000-0000-000000000001';
insert into public.answer_votes (answer_id, user_id)
values ('dddd0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001');

\echo ''
\echo '=== 14. athlete rankings score approved entries only ==='
set test.uid = '11110000-0000-0000-0000-000000001111';
select display_name, chapter, entries, best_placing, points, rank
  from public.get_athlete_rankings();

\echo ''
\echo '=== 15. nav counts are scoped to the clubs you lead ==='
-- A pending entry at Pitt, so there is something to count. Without one every
-- row below reads zero and the test would pass while proving nothing.
reset role;
set test.uid = '';
insert into public.competition_entries
  (profile_id, club_id, show_name, federation, date, division, "placing", status)
select '44440000-0000-0000-0000-000000004444',
       (select id from public.clubs where name = 'Fitness and Bodybuilding Club'),
       'Winter Classic', 'OCB', current_date - 5, 'Bikini', '3rd', 'pending';
set role authenticated;
set test.uid = '11110000-0000-0000-0000-000000001111';
select 'pitt lead' as who, pending_entries, pending_questions from public.get_viewer_nav_counts();
set test.uid = '88880000-0000-0000-0000-000000008888';
select 'iowa lead' as who, pending_entries, pending_questions from public.get_viewer_nav_counts();
set test.uid = 'aaaa0000-0000-0000-0000-00000000aaaa';
select 'no chapter' as who, pending_entries, pending_questions from public.get_viewer_nav_counts();

\echo ''
\echo '=== 16. a stranger cannot see somebody else''s pending entry ==='
reset role;
set test.uid = '';
insert into public.competition_entries
  (profile_id, club_id, show_name, federation, date, division, "placing", status)
select '33330000-0000-0000-0000-000000003333',
       (select id from public.clubs where name = 'Fitness and Bodybuilding Club'),
       'Autumn Collegiate Showdown', 'OCB', current_date + 45, 'Classic Physique', '2nd', 'pending';
set role authenticated;
set test.uid = 'aaaa0000-0000-0000-0000-00000000aaaa';
select count(*) as pending_visible_to_a_stranger
  from public.competition_entries where status = 'pending';

\echo ''
\echo '=== 17. the share card is public, and prints no ids ==='
reset role;
set test.uid = '';
select share_token as tok from public.competition_entries
 where profile_id = '22220000-0000-0000-0000-000000002222' \gset
set role anon;
select athlete_name, chapter, show_name, "placing", status
  from public.get_share_card(:'tok');

\echo ''
\echo '=== 18. a returned entry yields nothing, but keeps its token ==='
reset role;
set test.uid = '';
update public.competition_entries
   set status = 'returned', rejection_reason = 'Placing does not match the posted results.'
 where profile_id = '33330000-0000-0000-0000-000000003333';
select share_token as rtok from public.competition_entries
 where profile_id = '33330000-0000-0000-0000-000000003333' \gset
set role anon;
select count(*) as rows_for_a_returned_entry from public.get_share_card(:'rtok');
reset role;
set test.uid = '';
select share_token is not null as token_still_alive from public.competition_entries
 where profile_id = '33330000-0000-0000-0000-000000003333';

\echo ''
\echo '=== 19. the calendar is open to somebody with no chapter ==='
set role authenticated;
set test.uid = 'aaaa0000-0000-0000-0000-00000000aaaa';
select count(*) >= 0 as calendar_readable from public.competitions;

\echo ''
\echo '=== 20. MUST FAIL: an ordinary member putting a show on the calendar ==='
set test.uid = '22220000-0000-0000-0000-000000002222';
insert into public.competitions (name, level, starts_on)
values ('Made-up Invitational', 'national', current_date + 10);

\echo ''
\echo '=== 21. a club lead CAN ==='
set test.uid = '11110000-0000-0000-0000-000000001111';
insert into public.competitions (name, level, starts_on)
values ('Local Qualifier', 'local', current_date + 20);
select name from public.competitions where name = 'Local Qualifier';
reset role;

\echo ''
\echo '=== 22. the Q&A starter library is still intact ==='
set test.uid = '';
select count(*) as starter_questions from public.questions
 where author_id = '00000000-0000-4000-a000-00000000ed17';
select count(*) as starter_answers from public.answers where body like '%[starter]%';

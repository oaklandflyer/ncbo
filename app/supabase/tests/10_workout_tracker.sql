-- ============================================================================
-- The workout tracker's one privacy claim, and the JSONB shape behind it.
--
-- Everywhere else in this schema a club lead sees their roster's data and an
-- admin sees everything. A training log deliberately breaks that: it records
-- what somebody's body did on a Tuesday, and a member has to be able to log an
-- honest one without wondering who reads it.
--
-- So the interesting tests here are the ones that FAIL: a lead reading their
-- own member's workout, and an admin reading anybody's.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
select public.reapply_column_privileges();

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== fixtures: a lifter, their club lead, and an admin ==='
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-00000000c001', 'lifter@example.com'),
  ('c0000000-0000-0000-0000-00000000c002', 'theirlead@example.com'),
  ('c0000000-0000-0000-0000-00000000c003', 'anadmin@example.com');

insert into public.club_memberships (user_id, club_id, status, role, verified_at, verification_method)
select v.uid, c.id, 'active', v.rl::public.membership_role, now(), 'club_lead'
  from (values
    ('c0000000-0000-0000-0000-00000000c001'::uuid, 'member'),
    ('c0000000-0000-0000-0000-00000000c002'::uuid, 'club_lead')
  ) as v(uid, rl)
  join public.clubs c on c.name = 'Purdue Bodybuilding Club';

insert into public.org_roles (user_id, role) values
  ('c0000000-0000-0000-0000-00000000c003', 'admin');

\echo '=== 1. the catalogue is readable by any approved member ==='
set role authenticated;
set test.uid = 'c0000000-0000-0000-0000-00000000c001';
select count(*) > 20 as catalogue_seeded from public.exercises;
-- expect t

\echo '=== 2. MUST FAIL: a member cannot add to the catalogue ==='
/* Otherwise it becomes four spellings of "Romanian Deadlift" within a month. */
insert into public.exercises (name, muscle_group) values ('Bicep Blaster 9000', 'Arms');

\echo '=== 3. the lifter logs a workout, with the real JSONB shape ==='
insert into public.workout_sessions (profile_id, workout_data)
values ('c0000000-0000-0000-0000-00000000c001',
  '[{"exercise_id": null, "exercise_name": "Barbell Bench Press",
     "sets": [{"weight": 100, "reps": 5, "completed": true},
              {"weight": 100, "reps": 5, "completed": true}]}]'::jsonb);

select status,
       jsonb_array_length(workout_data) as exercises,
       workout_data #>> '{0,exercise_name}' as first_exercise,
       jsonb_array_length(workout_data #> '{0,sets}') as sets
  from public.workout_sessions where profile_id = 'c0000000-0000-0000-0000-00000000c001';
-- expect in_progress | 1 | Barbell Bench Press | 2

\echo '=== 4. they can read their own ==='
select count(*) as mine from public.workout_sessions;
-- expect 1

\echo '=== 5. THE CLAIM: their club lead cannot see it ==='
/* A lead sees this member's roster row, their application, their competition
   results. Not this. */
set test.uid = 'c0000000-0000-0000-0000-00000000c002';
select count(*) as visible_to_their_lead from public.workout_sessions;
-- expect 0

\echo '=== 6. THE CLAIM: nor can an admin ==='
set test.uid = 'c0000000-0000-0000-0000-00000000c003';
select count(*) as visible_to_admin from public.workout_sessions;
-- expect 0

\echo '=== 7. MUST FAIL: and nobody can log a workout for somebody else ==='
insert into public.workout_sessions (profile_id, workout_data)
values ('c0000000-0000-0000-0000-00000000c001', '[]'::jsonb);

\echo '=== 8. MUST FAIL: two live workouts at once ==='
/* Not a state the UI can represent, so the database says so rather than a
   comment somebody has to remember. */
set test.uid = 'c0000000-0000-0000-0000-00000000c001';
insert into public.workout_sessions (profile_id) values ('c0000000-0000-0000-0000-00000000c001');

\echo '=== 9. MUST FAIL: workout_data that is not an array ==='
insert into public.workout_sessions (profile_id, workout_data, status, end_time)
values ('c0000000-0000-0000-0000-00000000c001', '{"oops": true}'::jsonb, 'completed', now());

\echo '=== 10. MUST FAIL: completed with no end_time ==='
update public.workout_sessions set status = 'completed'
 where profile_id = 'c0000000-0000-0000-0000-00000000c001';

\echo '=== 11. finishing properly works, and frees the one-active slot ==='
update public.workout_sessions set status = 'completed', end_time = now()
 where profile_id = 'c0000000-0000-0000-0000-00000000c001';
insert into public.workout_sessions (profile_id) values ('c0000000-0000-0000-0000-00000000c001');
select count(*) as sessions,
       count(*) filter (where status = 'completed') as completed,
       count(*) filter (where status = 'in_progress') as running
  from public.workout_sessions;
-- expect 2 | 1 | 1

\echo '=== 12. updated_at moves on write ==='
select updated_at > created_at as touched from public.workout_sessions
 where status = 'completed';
-- expect t

\echo '=== 13. deleting the lifter takes their workouts with them ==='
/* CASCADE, unlike competition results. A workout is a personal record and
   nobody else s score depends on it, so there is nothing to keep anonymously. */
reset role;
set test.uid = '';
delete from auth.users where id = 'c0000000-0000-0000-0000-00000000c001';
select count(*) as workouts_left from public.workout_sessions
 where profile_id = 'c0000000-0000-0000-0000-00000000c001';
-- expect 0

reset role;
set test.uid = '';

-- ============================================================================
-- Lifetime volume, and the privacy claim it inherits.
--
-- `my_workout_totals` exists so a phone does not have to download every
-- workout document to show one number. The risk in adding a view over private
-- rows is that it quietly becomes a way around the policy on those rows, so
-- the tests that matter are the two that return NOTHING: a club lead and an
-- admin asking for a member's totals.
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
  ('d0000000-0000-0000-0000-00000000d001', 'volume-lifter@example.com'),
  ('d0000000-0000-0000-0000-00000000d002', 'volume-lead@example.com'),
  ('d0000000-0000-0000-0000-00000000d003', 'volume-admin@example.com');

insert into public.club_memberships (user_id, club_id, status, role, verified_at, verification_method)
select v.uid, c.id, 'active', v.rl::public.membership_role, now(), 'club_lead'
  from (values
    ('d0000000-0000-0000-0000-00000000d001'::uuid, 'member'),
    ('d0000000-0000-0000-0000-00000000d002'::uuid, 'club_lead')
  ) as v(uid, rl)
  join public.clubs c on c.name = 'Purdue Bodybuilding Club';

insert into public.org_roles (user_id, role) values
  ('d0000000-0000-0000-0000-00000000d003', 'admin');

\echo '=== 1. two finished sessions and one still running ==='
set role authenticated;
set test.uid = 'd0000000-0000-0000-0000-00000000d001';

insert into public.workout_sessions (profile_id, start_time, end_time, status, workout_data)
values ('d0000000-0000-0000-0000-00000000d001', now() - interval '2 hours', now() - interval '1 hour', 'completed',
  '[{"exercise_id": null, "exercise_name": "Bench Press (Barbell)",
     "sets": [{"weight": 185, "reps": 10, "completed": true},
              {"weight": 225, "reps": 5, "completed": true},
              {"weight": 275, "reps": 1, "completed": false}]}]'::jsonb);

insert into public.workout_sessions (profile_id, start_time, end_time, status, workout_data)
values ('d0000000-0000-0000-0000-00000000d001', now() - interval '26 hours', now() - interval '25 hours', 'completed',
  '[{"exercise_id": null, "exercise_name": "Squat (Barbell)",
     "sets": [{"weight": 315, "reps": 3, "completed": true},
              {"weight": null, "reps": 12, "completed": true}]}]'::jsonb);

insert into public.workout_sessions (profile_id, workout_data)
values ('d0000000-0000-0000-0000-00000000d001',
  '[{"exercise_id": null, "exercise_name": "Deadlift", "sets": [{"weight": 405, "reps": 1, "completed": true}]}]'::jsonb);

\echo '=== 2. only completed sets of completed sessions count ==='
/* 185x10 + 225x5 = 2975, plus 315x3 = 945. The un-ticked 275 does not count,
   the bodyweight set contributes nothing, and the workout still in progress
   is not history yet. */
select sessions, total_volume from public.my_workout_totals;
-- expect 2 | 3920

\echo '=== 3. MUST RETURN NOTHING: a club lead reading their member''s volume ==='
set test.uid = 'd0000000-0000-0000-0000-00000000d002';
select count(*) as rows_visible from public.my_workout_totals
 where profile_id = 'd0000000-0000-0000-0000-00000000d001';
-- expect 0

\echo '=== 4. MUST RETURN NOTHING: an admin reading anybody''s volume ==='
set test.uid = 'd0000000-0000-0000-0000-00000000d003';
select count(*) as rows_visible from public.my_workout_totals;
-- expect 0

\echo '=== 5. somebody who has never lifted has no row, not a zero ==='
/* The widget renders "no workouts yet" from the absence. A zero row would be
   indistinguishable from a session that happened and moved nothing. */
set test.uid = 'd0000000-0000-0000-0000-00000000d002';
select count(*) as own_rows from public.my_workout_totals;
-- expect 0

reset role;
set test.uid = '';

-- ============================================================================
-- The workout tracker, phase 1.
--
-- Two tables, and the shape of the second one is the whole design decision.
--
-- A normalised tracker is three tables and a join per render: sessions, then
-- session_exercises, then sets. A single logged workout is thirty or forty
-- set rows, written one at a time as somebody actually lifts, each write a
-- round trip from a phone on gym wifi. On a free tier that is a lot of rows
-- and a lot of requests to store something that is only ever read back whole.
--
-- So a session carries its exercises and sets as one JSONB document. The
-- client holds the live workout in local state and writes the document; the
-- database stores what happened. Nothing joins to read a workout because a
-- workout is one row.
--
-- What that costs, stated plainly rather than discovered later:
--
--   · no foreign key from a logged set back to `exercises`, so renaming an
--     exercise does not rewrite history. That is why the document carries
--     `exercise_name` alongside `exercise_id`: the name as it was, the id for
--     anything that wants to aggregate later.
--   · aggregate queries ("my best bench") need JSONB traversal rather than a
--     GROUP BY. Phase 1 does not have them. If they arrive and hurt, the fix
--     is a derived table populated on completion, not a reshape of this one.
--
-- `exercises` IS a real table, because it is a shared catalogue that admins
-- curate and every athlete reads. It is the one part of this that is not
-- per-person.
-- ============================================================================

-- ── the catalogue ───────────────────────────────────────────────────────────
create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  muscle_group text,
  created_at   timestamptz not null default now()
);

/* Case-insensitive, so "Bench Press" and "bench press" cannot both exist and
   split somebody's history in two. */
create unique index if not exists exercises_name_key on public.exercises (lower(name));
create index if not exists exercises_muscle_group_idx on public.exercises (muscle_group);

comment on table public.exercises is
  'The shared exercise catalogue. A real table rather than part of the JSONB document because it is curated once and read by everybody.';

alter table public.exercises enable row level security;

drop policy if exists exercises_read  on public.exercises;
drop policy if exists exercises_write on public.exercises;

/* Every signed-in member reads it; only an admin edits it. A catalogue anybody
   can add to becomes four spellings of "Romanian Deadlift" inside a month. */
create policy exercises_read on public.exercises
  for select to authenticated using (public.is_approved());

create policy exercises_write on public.exercises
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.exercises to authenticated;

-- ── the sessions ────────────────────────────────────────────────────────────
create table if not exists public.workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  start_time   timestamptz not null default now(),
  end_time     timestamptz,
  status       text not null default 'in_progress'
                 check (status in ('in_progress', 'completed')),
  workout_data jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.workout_sessions is
  'One row per workout. The exercises and sets live in workout_data as a JSONB document rather than in child tables: a workout is written and read whole, and forty set rows per session is a lot of writes from a phone to store something nothing ever queries piecewise.';
comment on column public.workout_sessions.workout_data is
  'Array of {exercise_id, exercise_name, sets: [{weight, reps, completed}]}. exercise_name is denormalised on purpose, so renaming a catalogue entry does not rewrite what somebody actually did.';

/* CASCADE, matching every other per-person table. A workout is a personal
   record, not a chapter one: unlike a competition result, nobody else's score
   depends on it, so there is nothing to preserve anonymously. */

create index if not exists workout_sessions_profile_idx
  on public.workout_sessions (profile_id, start_time desc);

/* One in-progress session per person. Two live workouts is not a state the UI
   can represent, and a partial index is how you say that in Postgres rather
   than in a comment somebody has to remember. */
create unique index if not exists workout_sessions_one_active
  on public.workout_sessions (profile_id) where status = 'in_progress';

/* The document has to be an array of objects, because everything reading it
   assumes that. A malformed write should fail at the boundary rather than
   surface as a crash in whichever screen renders it next. */
alter table public.workout_sessions drop constraint if exists workout_sessions_data_shape;
alter table public.workout_sessions
  add constraint workout_sessions_data_shape
  check (jsonb_typeof(workout_data) = 'array');

/* A finished session has a finish time, and an unfinished one does not. */
alter table public.workout_sessions drop constraint if exists workout_sessions_end_time_check;
alter table public.workout_sessions
  add constraint workout_sessions_end_time_check
  check ((status = 'completed') = (end_time is not null));

create or replace function public.touch_workout_session()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_workout_session_trg on public.workout_sessions;
create trigger touch_workout_session_trg
  before update on public.workout_sessions
  for each row execute function public.touch_workout_session();

-- ── row-level security ──────────────────────────────────────────────────────
alter table public.workout_sessions enable row level security;

drop policy if exists workout_sessions_read   on public.workout_sessions;
drop policy if exists workout_sessions_insert on public.workout_sessions;
drop policy if exists workout_sessions_update on public.workout_sessions;
drop policy if exists workout_sessions_delete on public.workout_sessions;

/*
 * Yours and nobody else's. Not the club lead's, not an admin's.
 *
 * That is a deliberate departure from the rest of this schema, where a lead
 * sees their roster's data and an admin sees everything. A training log is not
 * roster information: it records what somebody's body did on a Tuesday, and a
 * member has to be able to log an honest one without wondering who reads it.
 * If a coaching feature ever needs this, it should be built as sharing the
 * member switches on, not as a policy they never agreed to.
 */
create policy workout_sessions_read on public.workout_sessions
  for select to authenticated using (profile_id = auth.uid());

create policy workout_sessions_insert on public.workout_sessions
  for insert to authenticated
  with check (profile_id = auth.uid() and public.is_approved());

create policy workout_sessions_update on public.workout_sessions
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy workout_sessions_delete on public.workout_sessions
  for delete to authenticated using (profile_id = auth.uid());

grant select, insert, update, delete on public.workout_sessions to authenticated;
revoke all on public.workout_sessions from anon;
revoke all on public.exercises from anon;

-- ── a starting catalogue ────────────────────────────────────────────────────
/* Enough to log a session on day one without an admin having to seed it
   first. Compound movements first because those are what a program is built
   around; the accessories are the ones most likely to get added to. */
insert into public.exercises (name, muscle_group) values
  ('Barbell Back Squat',      'Legs'),
  ('Front Squat',             'Legs'),
  ('Leg Press',               'Legs'),
  ('Romanian Deadlift',       'Hamstrings'),
  ('Lying Leg Curl',          'Hamstrings'),
  ('Leg Extension',           'Quads'),
  ('Standing Calf Raise',     'Calves'),
  ('Conventional Deadlift',   'Back'),
  ('Barbell Row',             'Back'),
  ('Lat Pulldown',            'Back'),
  ('Seated Cable Row',        'Back'),
  ('Pull-Up',                 'Back'),
  ('Barbell Bench Press',     'Chest'),
  ('Incline Dumbbell Press',  'Chest'),
  ('Cable Fly',               'Chest'),
  ('Dip',                     'Chest'),
  ('Overhead Press',          'Shoulders'),
  ('Dumbbell Lateral Raise',  'Shoulders'),
  ('Rear Delt Fly',           'Shoulders'),
  ('Barbell Curl',            'Biceps'),
  ('Incline Dumbbell Curl',   'Biceps'),
  ('Hammer Curl',             'Biceps'),
  ('Cable Triceps Pushdown',  'Triceps'),
  ('Overhead Triceps Extension', 'Triceps'),
  ('Skullcrusher',            'Triceps'),
  ('Hanging Leg Raise',       'Core'),
  ('Cable Crunch',            'Core'),
  ('Plank',                   'Core')
on conflict do nothing;

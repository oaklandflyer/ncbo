-- ============================================================================
-- The academic model: the year, the level, and which of the two is a guess.
--
-- The rules worth a test:
--   · August, not January, is when the academic year turns over
--   · a stated membership year always beats a projected one
--   · only projected rows are flagged inferred
--   · an alumnus is derived from a year that has passed, or marked by hand
--   · the view does not become a way to read `email`
--
-- Conventions as in 01 to 04: MUST FAIL passes by printing a loud ERROR.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
select public.reapply_column_privileges();

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== 1. August is the boundary, not January ==='
select public.academic_year_of('2026-07-31T12:00:00Z'::timestamptz) as july_2026,
       public.academic_year_of('2026-08-01T12:00:00Z'::timestamptz) as august_2026,
       public.academic_year_of('2026-12-31T12:00:00Z'::timestamptz) as december_2026,
       public.academic_year_of('2027-01-01T12:00:00Z'::timestamptz) as january_2027;
-- expect 2026 | 2027 | 2027 | 2027

\echo '=== 2. a standing projects onto an academic year ==='
select public.project_grad_year('Freshman',  '2026-09-01T12:00:00Z') as freshman,
       public.project_grad_year('Sophomore', '2026-09-01T12:00:00Z') as sophomore,
       public.project_grad_year('Junior',    '2026-09-01T12:00:00Z') as junior,
       public.project_grad_year('Senior',    '2026-09-01T12:00:00Z') as senior,
       public.project_grad_year('Graduate student', '2026-09-01T12:00:00Z') as grad;
-- expect 2030 | 2029 | 2028 | 2027 | 2029

\echo '=== 3. "Not a student" and junk project to NULL rather than to a guess ==='
select public.project_grad_year('Not a student', now()) is null as not_a_student,
       public.project_grad_year('banana', now())        is null as junk,
       public.project_grad_year(null, now())            is null as null_in;

\echo '=== 4. the standing to level map ==='
select public.level_of_standing('Junior')           as junior,
       public.level_of_standing('Graduate student') as grad,
       public.level_of_standing('Not a student')    is null as not_a_student;

\echo '=== fixtures: four people, four different situations ==='
insert into auth.users (id, email) values
  ('a1110000-0000-0000-0000-0000000a1111', 'stated@example.com'),
  ('a2220000-0000-0000-0000-0000000a2222', 'projected@example.com'),
  ('a3330000-0000-0000-0000-0000000a3333', 'neither@example.com'),
  ('a4440000-0000-0000-0000-0000000a4444', 'graduated@example.com');

update public.profiles set class_year = v.cy from (values
  ('a1110000-0000-0000-0000-0000000a1111'::uuid, 'Freshman'),
  ('a2220000-0000-0000-0000-0000000a2222'::uuid, 'Junior'),
  ('a3330000-0000-0000-0000-0000000a3333'::uuid, 'Not a student'),
  ('a4440000-0000-0000-0000-0000000a4444'::uuid, 'Senior')
) as v(id, cy) where public.profiles.id = v.id;

/* Only the first has a stated membership year, and it deliberately disagrees
   with what "Freshman" would project, so the test can tell which one won. */
insert into public.club_memberships (user_id, club_id, status, role, grad_year)
select 'a1110000-0000-0000-0000-0000000a1111'::uuid, c.id, 'active', 'member', 2028
  from public.clubs c where c.name = 'Fitness and Bodybuilding Club';

-- Re-run the two backfill passes over the rows just inserted.
with stated as (
  select p.id, m.grad_year from public.profiles p
    join lateral (
      select cm.grad_year from public.club_memberships cm
       where cm.user_id = p.id and cm.grad_year is not null
       order by (cm.status = 'active') desc, cm.created_at desc limit 1
    ) m on true
   where p.grad_year is null
)
update public.profiles p set grad_year = stated.grad_year::smallint, grad_year_inferred = false
  from stated where p.id = stated.id and stated.grad_year between 1960 and 2100;

update public.profiles p
   set grad_year = public.project_grad_year(p.class_year, now()), grad_year_inferred = true
 where p.grad_year is null and public.project_grad_year(p.class_year, now()) is not null;

\echo '=== 5. a stated year wins, and is NOT flagged inferred ==='
select grad_year, grad_year_inferred
  from public.profiles where id = 'a1110000-0000-0000-0000-0000000a1111';
-- expect 2028 | f   (2028 stated, NOT the freshman projection)

\echo '=== 6. a projected year IS flagged inferred ==='
select grad_year = (public.academic_year_of(now()) + 1) as junior_projects_correctly,
       grad_year_inferred
  from public.profiles where id = 'a2220000-0000-0000-0000-0000000a2222';
-- expect t | t

\echo '=== 7. no standing and no membership leaves both null ==='
select grad_year is null as no_year, grad_year_inferred as flagged
  from public.profiles where id = 'a3330000-0000-0000-0000-0000000a3333';
-- expect t | f

\echo '=== 8. MUST FAIL: a year outside the range ==='
update public.profiles set grad_year = 20264
 where id = 'a3330000-0000-0000-0000-0000000a3333';

\echo '=== 9. MUST FAIL: inferred with no year to have inferred ==='
update public.profiles set grad_year = null, grad_year_inferred = true
 where id = 'a3330000-0000-0000-0000-0000000a3333';

\echo '=== 10. a year that has passed makes an alumnus, without anybody setting a flag ==='
update public.profiles set grad_year = public.academic_year_of(now()) - 1, is_alumni = false
 where id = 'a4440000-0000-0000-0000-0000000a4444';
select is_alumni as flag_is_off, is_alumni_effective, alumni_reason
  from public.profiles_with_status where id = 'a4440000-0000-0000-0000-0000000a4444';
-- expect f | t | graduated

\echo '=== 11. the current academic year is NOT yet alumni ==='
update public.profiles set grad_year = public.academic_year_of(now())
 where id = 'a4440000-0000-0000-0000-0000000a4444';
select grad_year, is_alumni_effective
  from public.profiles_with_status where id = 'a4440000-0000-0000-0000-0000000a4444';
-- expect <this academic year> | f

\echo '=== 12. the hand-set flag still wins over a future year ==='
update public.profiles set grad_year = public.academic_year_of(now()) + 3, is_alumni = true
 where id = 'a4440000-0000-0000-0000-0000000a4444';
select is_alumni_effective, alumni_reason
  from public.profiles_with_status where id = 'a4440000-0000-0000-0000-0000000a4444';
-- expect t | marked

\echo '=== 13. MUST FAIL: the view has no email column at all ==='
set role authenticated;
set test.uid = 'a1110000-0000-0000-0000-0000000a1111';
select email from public.profiles_with_status limit 1;

\echo '=== 14. and an ordinary member CAN read the view ==='
/* The regression this guards: with security_invoker, a `select p.*` body
   expands to include `email`, which authenticated cannot read, so the whole
   view fails for everybody with `permission denied for table profiles`. It is
   the 0015-to-0020 outage wearing a different hat. */
select count(*) > 0 as view_readable from public.profiles_with_status;

\echo '=== 15. and it still resolves alumni status for them ==='
select is_alumni_effective is not null as computed
  from public.profiles_with_status where id = 'a1110000-0000-0000-0000-0000000a1111';

reset role;
set test.uid = '';

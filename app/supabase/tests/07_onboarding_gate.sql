-- ============================================================================
-- Who counts as finished signing up.
--
-- The trap this suite exists for: `is_onboarded` required `class_year`, and
-- migration 0026 deprecated that column and stopped writing it. Left alone,
-- every account created afterwards would be permanently unfinished, sent back
-- to a form that no longer offers the field that would release them. It is a
-- lockout with no error message, which is the worst kind.
--
-- Conventions as in 01 to 06.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
select public.reapply_column_privileges();

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== fixtures ==='
insert into auth.users (id, email) values
  ('e1110000-0000-0000-0000-0000000e1111', 'student@example.com'),
  ('e2220000-0000-0000-0000-0000000e2222', 'coach@example.com'),
  ('e3330000-0000-0000-0000-0000000e3333', 'halfway@example.com');

update public.profiles set
  full_name = 'A Student', display_name = 'Student', lifting_experience = '1-2 years',
  major = 'Kinesiology', is_adult = true, affiliation = 'student', grad_year = 2028
 where id = 'e1110000-0000-0000-0000-0000000e1111';

update public.profiles set
  full_name = 'A Coach', display_name = 'Coach', lifting_experience = '5+ years',
  major = 'n/a', is_adult = true, affiliation = 'affiliate', grad_year = null
 where id = 'e2220000-0000-0000-0000-0000000e2222';

update public.profiles set
  full_name = 'Half Way', display_name = 'Half', lifting_experience = '1-2 years',
  major = 'Physics', is_adult = true, affiliation = null, grad_year = null
 where id = 'e3330000-0000-0000-0000-0000000e3333';

\echo '=== 1. a complete student is finished ==='
select public.is_onboarded('e1110000-0000-0000-0000-0000000e1111'::uuid) as student_done;
-- expect t

\echo '=== 2. an affiliate is finished WITHOUT a graduation year ==='
/* A coach does not have one. Requiring it would trap them in the form. */
select public.is_onboarded('e2220000-0000-0000-0000-0000000e2222'::uuid) as affiliate_done;
-- expect t

\echo '=== 3. an unanswered affiliation is NOT finished ==='
select public.is_onboarded('e3330000-0000-0000-0000-0000000e3333'::uuid) as halfway_done;
-- expect f

\echo '=== 4. a student with no graduation year is NOT finished ==='
update public.profiles set grad_year = null
 where id = 'e1110000-0000-0000-0000-0000000e1111';
select public.is_onboarded('e1110000-0000-0000-0000-0000000e1111'::uuid) as student_no_year;
-- expect f

\echo '=== 5. THE REGRESSION: class_year is not required ==='
/* If this ever returns f, every account created after migration 0026 is
   locked out of the app with no way to satisfy the form. */
update public.profiles set grad_year = 2028, class_year = null
 where id = 'e1110000-0000-0000-0000-0000000e1111';
select public.is_onboarded('e1110000-0000-0000-0000-0000000e1111'::uuid) as finished_without_class_year;
-- expect t

\echo '=== 6. the 18+ attestation is still required ==='
update public.profiles set is_adult = false
 where id = 'e1110000-0000-0000-0000-0000000e1111';
select public.is_onboarded('e1110000-0000-0000-0000-0000000e1111'::uuid) as not_adult;
update public.profiles set is_adult = true
 where id = 'e1110000-0000-0000-0000-0000000e1111';
-- expect f

\echo '=== 7. MUST FAIL: an affiliation nobody defined ==='
/* Fails closed, and at the database rather than only in the form: a role name
   smuggled in here must not become a value the app then trusts. */
update public.profiles set affiliation = 'admin'
 where id = 'e1110000-0000-0000-0000-0000000e1111';

\echo '=== 8. affiliation grants nothing: the role is still derived ==='
update public.profiles set affiliation = 'affiliate'
 where id = 'e1110000-0000-0000-0000-0000000e1111';
select affiliation, role from public.profiles
 where id = 'e1110000-0000-0000-0000-0000000e1111';
-- expect affiliate | member   (NOT advisor, NOT admin)

\echo '=== 9. MUST FAIL: and a member still cannot promote themselves ==='
set role authenticated;
set test.uid = 'e1110000-0000-0000-0000-0000000e1111';
update public.profiles set role = 'admin'
 where id = 'e1110000-0000-0000-0000-0000000e1111';

\echo '=== 10. MUST FAIL: nor assign themselves a school ==='
/* This is why onboarding records interest instead of writing school_id: the
   database refuses the direct write that Phase 3 as briefed called for. */
update public.profiles set school_id = (select id from public.universities limit 1)
 where id = 'e1110000-0000-0000-0000-0000000e1111';

reset role;
set test.uid = '';

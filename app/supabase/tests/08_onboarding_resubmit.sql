-- ============================================================================
-- Submitting onboarding twice.
--
-- The bug this suite exists for, reported by somebody trying to sign up:
--
--   "Your profile is saved, but the application to your chapter did not go
--    through. Try again from your profile."
--
-- Onboarding wrote the membership with an upsert. `ON CONFLICT DO UPDATE`
-- reads `excluded.legal_name`, and `legal_name` is on this table's SELECT
-- deny list: verification data a lead collects, which the member may write
-- but not read back. So the conflict path failed with `permission denied for
-- table club_memberships`.
--
-- The first submission always worked, because a plain INSERT never touches
-- SELECT. That is exactly why it survived every test until a human pressed
-- the button twice.
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
  ('f1110000-0000-0000-0000-0000000f1111', 'resubmit@example.com');
update public.profiles set
  full_name = 'Club Lead Test', display_name = 'Club Lead Test',
  lifting_experience = '1-2 years', major = 'Mechanical engineering',
  is_adult = true, affiliation = 'student', grad_year = 2028
 where id = 'f1110000-0000-0000-0000-0000000f1111';

set role authenticated;
set test.uid = 'f1110000-0000-0000-0000-0000000f1111';

\echo '=== 1. first submission: insert ==='
insert into public.club_memberships
  (user_id, club_id, legal_name, preferred_name, grad_year,
   group_chat_platform, group_chat_handle, found_via, claimed_lead)
select 'f1110000-0000-0000-0000-0000000f1111', c.id, 'Club Lead Test', null, 2028,
       'GroupMe', '@first', 'A friend', false
  from public.clubs c where c.name = 'Fitness and Bodybuilding Club';

select status, claimed_lead from public.club_memberships
 where user_id = 'f1110000-0000-0000-0000-0000000f1111';
-- expect pending | f

\echo '=== 2. MUST FAIL: the old upsert path, kept as the regression witness ==='
/* If this ever stops failing the deny list has been weakened. If the app ever
   goes back to an upsert, this is what it will hit. */
insert into public.club_memberships
  (user_id, club_id, legal_name, grad_year)
select 'f1110000-0000-0000-0000-0000000f1111', c.id, 'Club Lead Test', 2029
  from public.clubs c where c.name = 'Fitness and Bodybuilding Club'
on conflict (user_id, club_id) do update
  set legal_name = excluded.legal_name, grad_year = excluded.grad_year;

\echo '=== 3. the new path: look the row up first ==='
/* Only readable columns in the projection, which is what makes this work. */
select id is not null as found, status
  from public.club_memberships
 where user_id = 'f1110000-0000-0000-0000-0000000f1111'
   and club_id = (select id from public.clubs where name = 'Fitness and Bodybuilding Club');

\echo '=== 4. then update with literals: the second submission SUCCEEDS ==='
update public.club_memberships
   set legal_name = 'Club Lead Test', group_chat_handle = '@second',
       found_via = 'A friend', grad_year = 2029, claimed_lead = true
 where user_id = 'f1110000-0000-0000-0000-0000000f1111';

select grad_year, claimed_lead, status from public.club_memberships
 where user_id = 'f1110000-0000-0000-0000-0000000f1111';
-- expect 2029 | t | pending

\echo '=== 5. claimed_lead grants NOTHING: still pending, still a member ==='
select status, role, claimed_lead from public.club_memberships
 where user_id = 'f1110000-0000-0000-0000-0000000f1111';
-- expect pending | member | t

\echo '=== 6. MUST FAIL: and they still cannot approve themselves ==='
update public.club_memberships set status = 'active'
 where user_id = 'f1110000-0000-0000-0000-0000000f1111';

\echo '=== 7. MUST FAIL: privacy is intact, legal_name is still unreadable ==='
select legal_name from public.club_memberships
 where user_id = 'f1110000-0000-0000-0000-0000000f1111';

\echo '=== 8. an active membership is left alone by a re-submission ==='
reset role;
set test.uid = '';
update public.club_memberships set status = 'active'
 where user_id = 'f1110000-0000-0000-0000-0000000f1111';
set role authenticated;
set test.uid = 'f1110000-0000-0000-0000-0000000f1111';
select status from public.club_memberships
 where user_id = 'f1110000-0000-0000-0000-0000000f1111';
-- expect active: the action returns early rather than rewriting a roster row

reset role;
set test.uid = '';

-- ============================================================================
-- The business requirement, tested end to end:
--
--   "A hard delete must completely wipe the user from the app so they can sign
--    up again with the same email, but they must start from scratch (pending
--    approval)."
--
-- Three separate claims, and each can fail on its own:
--   1. the delete completes at all, with no foreign key refusing it
--   2. the email is free afterwards
--   3. what comes back is a fresh account with no standing anywhere
--
-- Suite 06 proves what SURVIVES a deletion. This proves what does not, and
-- that the door is open again afterwards.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
select public.reapply_column_privileges();

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== fixtures: somebody with a row in as many tables as possible ==='
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000a001', 'wipe@example.com');

update public.profiles set
  full_name = 'Wipe Me', display_name = 'Wipe Me', lifting_experience = '1-2 years',
  major = 'History', is_adult = true, affiliation = 'student', grad_year = 2028,
  status = 'removed'
 where id = 'a0000000-0000-0000-0000-00000000a001';

insert into public.club_memberships (user_id, club_id, status, role, legal_name, grad_year)
select 'a0000000-0000-0000-0000-00000000a001', c.id, 'active', 'member', 'Wipe Me', 2028
  from public.clubs c where c.name = 'Rutgers Bodybuilding';

insert into public.org_roles (user_id, role)
values ('a0000000-0000-0000-0000-00000000a001', 'coaching_advisor');

insert into public.questions (author_id, body, status)
values ('a0000000-0000-0000-0000-00000000a001', 'A question from somebody about to be deleted.', 'approved');

insert into public.answers (author_id, question_id, body)
select 'a0000000-0000-0000-0000-00000000a001', q.id, 'An answer body long enough to pass any check.'
  from public.questions q
 where q.body = 'A question from somebody about to be deleted.';

insert into public.competition_entries
  (profile_id, club_id, show_name, federation, date, division, "class", "placing", status, won_overall)
select 'a0000000-0000-0000-0000-00000000a001', c.id, 'Wipe Open', 'NPC', current_date - 10,
       'Classic Physique', 'C', '1st', 'approved', false
  from public.clubs c where c.name = 'Rutgers Bodybuilding';

insert into public.signup_interest (user_id, university_id, grad_year)
select 'a0000000-0000-0000-0000-00000000a001', u.id, 2028
  from public.universities u limit 1;

\echo '=== 1. rows exist across the schema before the delete ==='
select
  (select count(*) from public.profiles           where id = 'a0000000-0000-0000-0000-00000000a001') as profiles,
  (select count(*) from public.club_memberships   where user_id = 'a0000000-0000-0000-0000-00000000a001') as memberships,
  (select count(*) from public.org_roles          where user_id = 'a0000000-0000-0000-0000-00000000a001') as org_roles,
  (select count(*) from public.questions          where author_id = 'a0000000-0000-0000-0000-00000000a001') as questions,
  (select count(*) from public.answers            where author_id = 'a0000000-0000-0000-0000-00000000a001') as answers,
  (select count(*) from public.competition_entries where profile_id = 'a0000000-0000-0000-0000-00000000a001') as entries,
  (select count(*) from public.signup_interest    where user_id = 'a0000000-0000-0000-0000-00000000a001') as interest;

\echo '=== 2. THE DELETE: no foreign key may refuse it ==='
/* This is the claim "ensure no lingering rows block the deletion". If any FK
   were still RESTRICT or NO ACTION, this statement errors and the whole
   feature is impossible rather than merely broken. */
delete from auth.users where id = 'a0000000-0000-0000-0000-00000000a001';

\echo '=== 3. every table that must be empty, is ==='
select
  (select count(*) from public.profiles           where id = 'a0000000-0000-0000-0000-00000000a001') as profiles,
  (select count(*) from public.club_memberships   where user_id = 'a0000000-0000-0000-0000-00000000a001') as memberships,
  (select count(*) from public.org_roles          where user_id = 'a0000000-0000-0000-0000-00000000a001') as org_roles,
  (select count(*) from public.signup_interest    where user_id = 'a0000000-0000-0000-0000-00000000a001') as interest;
-- expect 0 | 0 | 0 | 0

\echo '=== 4. and the content that must survive, did, detached ==='
/* The snapshot is what makes this survivable rather than merely orphaned:
   the answer still reads as somebody's work. */
select
  (select count(*) from public.questions where author_id is null
     and body = 'A question from somebody about to be deleted.') as orphan_questions,
  (select count(*) from public.competition_entries where profile_id is null and show_name = 'Wipe Open') as orphan_entries,
  (select author_display from public.answers where author_id is null limit 1) as answer_still_named,
  (select athlete_display from public.competition_entries where show_name = 'Wipe Open') as entry_still_named;
-- expect 1 | 1 | Wipe Me | Wipe Me

\echo '=== 5. nothing anywhere still references the deleted id ==='
/* Walks every FK to profiles and auth.users rather than naming tables by
   hand, so a table added later is covered without anybody remembering to
   extend this test. */
do $$
declare
  r record;
  n bigint;
  offenders text := '';
begin
  for r in
    select con.conrelid::regclass::text as tbl,
           (select a.attname from pg_attribute a
             where a.attrelid = con.conrelid and a.attnum = con.conkey[1]) as col
      from pg_constraint con
     where con.contype = 'f'
       and con.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
       and array_length(con.conkey, 1) = 1
  loop
    execute format('select count(*) from %s where %I = %L', r.tbl, r.col,
                   'a0000000-0000-0000-0000-00000000a001') into n;
    if n > 0 then
      offenders := offenders || format('%s.%s=%s ', r.tbl, r.col, n);
    end if;
  end loop;

  if offenders <> '' then
    raise exception 'rows still reference the deleted user: %', offenders;
  end if;
  raise notice 'no table anywhere still references the deleted user';
end $$;

\echo '=== 6. THE REQUIREMENT: the same email can sign up again ==='
insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-00000000b002', 'wipe@example.com');

select count(*) as fresh_profile from public.profiles
 where id = 'b0000000-0000-0000-0000-00000000b002';
-- expect 1

\echo '=== 7. and they start from scratch: no membership, no role, not onboarded ==='
select
  (select count(*) from public.club_memberships where user_id = 'b0000000-0000-0000-0000-00000000b002') as memberships,
  (select count(*) from public.org_roles where user_id = 'b0000000-0000-0000-0000-00000000b002') as org_roles,
  public.is_onboarded('b0000000-0000-0000-0000-00000000b002'::uuid) as onboarded,
  (select role from public.profiles where id = 'b0000000-0000-0000-0000-00000000b002') as role;
-- expect 0 | 0 | f | member

\echo '=== 8. nothing was inherited from the deleted account ==='
select display_name, full_name, grad_year, affiliation, club_id, school_id
  from public.profiles where id = 'b0000000-0000-0000-0000-00000000b002';
-- expect all null or blank: a genuinely fresh row, not the old one revived

\echo '=== 9. the audit trail is the one thing that outlives them ==='
insert into public.admin_audit_log
  (actor_user_id, target_user_id, target_email, target_display, action)
values ('b0000000-0000-0000-0000-00000000b002', 'a0000000-0000-0000-0000-00000000a001',
        'wipe@example.com', 'Wipe Me', 'hard_delete_user');
select target_display, target_email from public.admin_audit_log
 where target_user_id = 'a0000000-0000-0000-0000-00000000a001';
-- expect the row, naming an account that no longer exists

reset role;
set test.uid = '';

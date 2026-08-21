-- ============================================================================
-- Repair: a column added after `restrict_columns()` ran was left unreadable.
--
-- Symptom: every signed-in member was bounced to the sign-in page. The profile
-- query failed with `42501 permission denied for table profiles`, the app
-- could not tell that from being signed out, and signing in again did nothing.
--
-- Cause, and it is a trap worth naming precisely:
--
--   `restrict_columns()` works by taking away table-level SELECT and handing
--   back an explicit column list. **A column added later gets no grant.**
--   Column privileges are per column, so `alter table ... add column` produces
--   a column that `authenticated` cannot read, and selecting it fails the
--   whole statement — reported against the table, not the column, which is
--   why the error says nothing about which column is at fault.
--
--   0015 called `restrict_columns('public.profiles', '{email}')`.
--   0016 then added `profiles.experience_phase`.
--
--   From that moment `authenticated` could read every column of `profiles`
--   except `email` (intended) and `experience_phase` (not). `getProfile()`
--   selects `experience_phase`, so every hub page failed for everybody.
--
-- The repair is to re-apply the grants. The interesting part is stopping this
-- from happening again, because "remember to re-run a function after adding a
-- column" is exactly the kind of instruction that gets forgotten:
--
--  1. The deny lists move into `protected_columns()`, one source of truth
--     rather than a list copied into each call site.
--  2. `reapply_column_privileges()` re-applies every one of them. Any
--     migration that adds a column to a protected table ends with a call to
--     it, and calling it when nothing changed is free.
--  3. `01_rls.sql` asserts that the set of unreadable columns is exactly the
--     deny list. That test fails loudly in CI the next time somebody adds a
--     column and forgets, which is the only part of this that actually
--     prevents a repeat.
-- ============================================================================

/* The canonical deny lists. Adding a column that must not be readable means
   adding it here, and nowhere else. */
create or replace function public.protected_columns()
returns table (tbl regclass, deny text[])
language sql stable
as $$
  select 'public.profiles'::regclass, array['email']
  union all
  select 'public.club_memberships'::regclass,
         array['legal_name', 'group_chat_handle', 'group_chat_platform',
               'found_via', 'student_id_photo_path', 'decision_note']
  union all
  select 'public.school_email_codes'::regclass, array['code_hash']
$$;

comment on function public.protected_columns() is
  'Every table with column-level privileges, and which columns are held back. One source of truth: restrict_columns is never called with a hand-written list.';

create or replace function public.reapply_column_privileges()
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  row record;
begin
  for row in select * from public.protected_columns() loop
    perform public.restrict_columns(row.tbl, row.deny);
  end loop;
end;
$$;

comment on function public.reapply_column_privileges() is
  'Call at the end of any migration that adds a column to a protected table. A column added after restrict_columns last ran has no grant and is unreadable, which fails the whole query it appears in.';

revoke execute on function public.reapply_column_privileges() from authenticated, anon;
revoke execute on function public.protected_columns() from authenticated, anon;

-- The repair itself.
select public.reapply_column_privileges();

-- Report what was actually fixed, so the operator applying this can see it
-- rather than taking it on faith.
do $$
declare
  still_denied text;
begin
  select string_agg(format('%s.%s', row.tbl, a.attname), ', ')
    into still_denied
    from public.protected_columns() row
    join pg_attribute a on a.attrelid = row.tbl and a.attnum > 0 and not a.attisdropped
   where not has_column_privilege('authenticated', row.tbl, a.attname, 'SELECT')
     and not (a.attname = any (row.deny));

  if still_denied is null then
    raise notice 'column privileges repaired: every column outside the deny lists is readable again';
  else
    raise warning 'column privileges still missing on: %', still_denied;
  end if;
end $$;

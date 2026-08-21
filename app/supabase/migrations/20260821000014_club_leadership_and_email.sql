-- ============================================================================
-- Club leadership as a real relation, and member emails in `profiles`.
--
-- Two decisions taken deliberately, both recorded here because a future reader
-- will otherwise assume they were accidents:
--
--  1. Leadership is scoped to the CLUB, via `club_leads.profile_id`. A lead of
--     one club at a school does not manage another club at the same school.
--
--     The account-approval queue is the one exception, and stays school-wide:
--     an applicant has a school (the signup trigger derives it from their
--     email domain) but no club yet, so a club-scoped approval gate would
--     leave every new applicant unreviewable by anyone but an admin. The
--     school is now derived FROM the clubs a person leads rather than from
--     their own `profiles.school_id`, which is what was null and broken.
--
--  2. `profiles.email` exists now, against the original schema's intent, and
--     is protected by a column-level REVOKE rather than by RLS. RLS is
--     row-level: with `profiles_read` allowing every approved member to select
--     a row, an `email` column would be readable by everyone the moment it
--     existed. `revoke select (email)` makes that structurally impossible, and
--     the SECURITY DEFINER functions below are the only way through.
-- ============================================================================

-- ── 1. leadership ───────────────────────────────────────────────────────────
create index if not exists club_leads_profile_idx on public.club_leads (profile_id)
  where profile_id is not null;

-- Best-effort backfill: match each seeded lead name to a profile at that
-- club's school. Anything ambiguous or unmatched is reported, never guessed —
-- linking the wrong person to a lead row hands them a roster.
do $$
declare
  unmatched text[] := '{}';
  row record;
  hit uuid;
begin
  for row in
    select l.id, l.club_id, l.name, c.school_id
      from public.club_leads l
      join public.clubs c on c.id = l.club_id
     where l.profile_id is null
  loop
    select p.id into hit
      from public.profiles p
     where lower(p.display_name) = lower(row.name)
       and (p.school_id = row.school_id or p.club_id = row.club_id)
     limit 2;

    if hit is null then
      unmatched := unmatched || row.name;
    else
      update public.club_leads set profile_id = hit where id = row.id;
    end if;
  end loop;

  if array_length(unmatched, 1) > 0 then
    raise notice 'club_leads: no profile matched for %, left unlinked (display name only)',
      array_to_string(unmatched, ', ');
  end if;
end $$;

-- The clubs the caller leads. SECURITY DEFINER so it can be called from
-- inside a policy on the tables it reads.
create or replace function public.my_led_clubs()
returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(l.club_id), '{}')
    from public.club_leads l
   where l.profile_id = auth.uid()
$$;

create or replace function public.is_club_lead()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(array_length(public.my_led_clubs(), 1), 0) > 0 $$;

/* Does the caller lead the club this member belongs to? */
create or replace function public.leads_club_of(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = target
       and p.club_id is not null
       and p.club_id = any (public.my_led_clubs())
  )
$$;

/* The schools of the clubs the caller leads — the approval queue's scope. */
create or replace function public.my_led_schools()
returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(distinct c.school_id), '{}')
    from public.clubs c
   where c.id = any (public.my_led_clubs())
$$;

/* Replaces the old body: school membership now comes from led clubs, not from
   the lead's own `profiles.school_id`, which may be null. */
create or replace function public.leads_school_of(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.school_of(target) is not null
     and public.school_of(target) = any (public.my_led_schools())
$$;

-- ── 2. profiles.email ───────────────────────────────────────────────────────
alter table public.profiles add column if not exists email text;

create unique index if not exists profiles_email_key
  on public.profiles (lower(email)) where email is not null;

/* Column-level privileges, not RLS. Postgres has no column-level RLS, and the
   existing row policy would otherwise hand this to every approved member. */
revoke select (email) on public.profiles from authenticated, anon;
revoke update (email) on public.profiles from authenticated, anon;

-- The signup trigger writes it, rather than a second competing trigger.
-- Restated in full: `create or replace` replaces the whole body.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  addr   text := lower(trim(new.email));
  dom    text;
  school uuid;
  staff  boolean;
  state  public.account_status := 'pending';
begin
  select exists (select 1 from public.allowed_emails where email = addr) into staff;

  if not staff then
    dom := split_part(addr, '@', 2);

    if dom ~ '^([a-z0-9-]+\.)*[a-z0-9-]+\.edu$' then
      select id into school from public.schools where domain = dom;
      if school is null then
        select id into school from public.schools
         where dom like '%.' || domain
         order by length(domain) desc limit 1;
      end if;

      if school is not null then
        state := 'approved';
      end if;
    end if;
  else
    state := 'approved';
  end if;

  insert into public.profiles (id, display_name, school_id, status, approved_at, email)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(addr, '@', 1)),
          school,
          state,
          case when state = 'approved' then now() end,
          addr);
  return new;
end;
$$;

/* An address change in auth propagates, so the two never drift. */
create or replace function public.sync_profile_email()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.profiles set email = lower(trim(new.email)) where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

update public.profiles p
   set email = lower(trim(u.email))
  from auth.users u
 where u.id = p.id
   and p.email is distinct from lower(trim(u.email));

-- ── 3. the roster read path ─────────────────────────────────────────────────
-- The only way an email reaches the app. SECURITY DEFINER, and it does its own
-- authorisation: the caller must be an admin or a lead of the club asked for.
create or replace function public.get_club_roster(target_club uuid)
returns table (
  id uuid, display_name text, email text, role public.user_role,
  division text, class_year text, home_region text,
  is_alumni boolean, alumni_since date, is_lead boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or target_club = any (public.my_led_clubs())) then
    raise exception 'Not a lead of that club.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id, p.display_name, p.email, p.role,
           p.division, p.class_year, p.home_region,
           p.is_alumni, p.alumni_since,
           exists (select 1 from public.club_leads l
                    where l.club_id = target_club and l.profile_id = p.id) as is_lead,
           p.created_at
      from public.profiles p
     where p.club_id = target_club
       and p.status = 'approved'
     order by p.display_name;
end;
$$;

/* The admin members list. Admin only — account management is not a moderator
   power, by decision. */
create or replace function public.get_admin_members()
returns table (
  id uuid, display_name text, email text, role public.user_role,
  status public.account_status, club_id uuid, club_name text,
  school_id uuid, school_name text, division text, home_region text,
  verified boolean, credentials public.credential[],
  is_alumni boolean, alumni_since date, deleted_at timestamptz, created_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id, p.display_name, p.email, p.role, p.status,
           p.club_id, c.name, p.school_id, s.name,
           p.division, p.home_region, p.verified, p.credentials,
           p.is_alumni, p.alumni_since, p.deleted_at, p.created_at
      from public.profiles p
      left join public.clubs c   on c.id = p.club_id
      left join public.schools s on s.id = p.school_id
     order by p.display_name;
end;
$$;

revoke execute on function public.get_club_roster(uuid) from anon;
revoke execute on function public.get_admin_members() from anon;
grant execute on function public.get_club_roster(uuid) to authenticated;
grant execute on function public.get_admin_members() to authenticated;

-- ── 4. soft delete on profiles and answers ──────────────────────────────────
-- `status = 'removed'` remains what gates access — one source of truth for
-- "can this account do anything". These two columns are the audit trail:
-- when, and by whom.
alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.answers
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists answers_live_idx on public.answers (question_id, created_at)
  where deleted_at is null;

/* Removing an answer is a moderator action — advisors keep content
   moderation, by decision. */
create or replace function public.guard_answer_removal()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.deleted_at is distinct from old.deleted_at and not public.is_moderator() then
    raise exception 'Only an advisor or admin can remove an answer.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_answer_removal_trg on public.answers;
create trigger guard_answer_removal_trg
  before update on public.answers
  for each row execute function public.guard_answer_removal();

/* Answers may now be updated by a moderator (to remove one), not only by
   their author. */
drop policy if exists answers_update on public.answers;
create policy answers_update on public.answers for update to authenticated
  using (author_id = auth.uid() or public.is_moderator())
  with check (author_id = auth.uid() or public.is_moderator());

create or replace view public.answer_feed as
select a.id, a.question_id, a.body, a.created_at, a.author_id,
       pr.display_name as author_name, pr.role as author_role,
       pr.verified as author_verified, pr.credentials as author_credentials
from public.answers a
join public.profiles pr on pr.id = a.author_id
join public.questions q on q.id = a.question_id
where public.is_approved()
  and a.deleted_at is null
  and q.deleted_at is null
  and (q.status = 'approved' or public.is_moderator() or a.author_id = auth.uid());

-- ── 5. the guard, repointed at club scope ───────────────────────────────────
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  reviewing boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.is_adult is distinct from old.is_adult and new.id <> auth.uid() then
    raise exception 'Only the member themselves can make the 18+ attestation.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Graduating: the member, the lead of their club, or an admin.
  if new.is_alumni is distinct from old.is_alumni
     and not (
       new.id = auth.uid()
       or public.is_admin()
       or public.leads_club_of(new.id)
     ) then
    raise exception 'Only the member, their club lead, or an admin can change alumni status.'
      using errcode = 'insufficient_privilege';
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Account management is admin-only, by decision — a moderator moderates
  -- content, not membership.
  if new.status is distinct from old.status or new.deleted_at is distinct from old.deleted_at then
    reviewing := public.leads_school_of(new.id)
             and new.id <> auth.uid()
             and old.status = 'pending'
             and new.status in ('approved', 'rejected')
             and new.deleted_at is not distinct from old.deleted_at
             and new.school_id is not distinct from old.school_id
             and new.role is not distinct from old.role
             and new.club_id is not distinct from old.club_id;

    if not reviewing then
      if public.my_role() = 'club_lead' then
        raise exception 'A club lead can only approve or decline a pending application at their school.'
          using errcode = 'insufficient_privilege';
      end if;
      raise exception 'Only an admin can approve, suspend or remove an account.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.verified is distinct from old.verified then
    raise exception 'Only an admin can mark a profile as NCBO vetted.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.credentials is distinct from old.credentials then
    raise exception 'Only an admin can change federation credentials.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a role.' using errcode = 'insufficient_privilege';
  end if;

  if new.school_id is distinct from old.school_id then
    raise exception 'Only an admin can reassign a school.' using errcode = 'insufficient_privilege';
  end if;

  -- A club lead may take one of their own members off the roster. That is a
  -- removal (club_id → null), never a reassignment.
  if new.club_id is distinct from old.club_id
     and not (public.leads_club_of(old.id) and new.club_id is null) then
    raise exception 'Only an admin can assign a club.' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- The row-level write gate. Club leads reach their own club's members; the
-- approval queue reaches their school's applicants.
drop policy if exists profiles_update on public.profiles;

create policy profiles_update on public.profiles for update to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.is_moderator()
    or public.leads_club_of(id)
    or public.leads_school_of(id)
  )
  with check (
    id = auth.uid()
    or public.is_admin()
    or public.is_moderator()
    or public.leads_club_of(id)
    or public.leads_school_of(id)
  );

-- ── 6. removed accounts leave every read path ───────────────────────────────
create or replace view public.member_directory
with (security_invoker = true) as
select
  p.id, p.display_name, p.role, p.division, p.home_region,
  p.verified, p.credentials, p.club_id, c.name as club_name,
  p.school_id, s.name as school_name, s.state as school_state,
  p.instagram_handle, p.tiktok_handle, p.is_alumni, p.alumni_since
from public.profiles p
left join public.clubs c   on c.id = p.club_id
left join public.schools s on s.id = p.school_id
where p.status = 'approved'
  and p.deleted_at is null;

grant select on public.member_directory to authenticated;

create or replace view public.club_directory
with (security_invoker = true) as
select
  c.id, c.name as club_name, c.status, c.instagram,
  s.id as school_id, s.name as school_name, s.state, s.domain,
  (select count(*) from public.profiles p
    where p.club_id = c.id and p.status = 'approved' and p.deleted_at is null) as member_count,
  coalesce(
    (select array_agg(l.name order by l.ordinal, l.name)
       from public.club_leads l where l.club_id = c.id),
    '{}'
  ) as leads
from public.clubs c
join public.schools s on s.id = c.school_id;

grant select on public.club_directory to authenticated;

-- ── 7. data repairs ─────────────────────────────────────────────────────────
-- A member with a club but no school. The club knows which school it belongs
-- to, so the row can repair itself.
update public.profiles p
   set school_id = c.school_id
  from public.clubs c
 where p.club_id = c.id
   and p.school_id is null;

-- Anyone whose role says club_lead but who leads nothing is invisible to the
-- new gate. Link them to the club they are a member of — the only club they
-- could plausibly lead — and say so.
do $$
declare
  linked int;
begin
  insert into public.club_leads (club_id, name, profile_id, ordinal)
  select p.club_id, p.display_name, p.id, 10
    from public.profiles p
   where p.role = 'club_lead'
     and p.club_id is not null
     and p.status = 'approved'
     and not exists (select 1 from public.club_leads l where l.profile_id = p.id)
  on conflict (club_id, name) do update set profile_id = excluded.profile_id;

  get diagnostics linked = row_count;
  if linked > 0 then
    raise notice 'club_leads: linked % club_lead account(s) to the club they belong to', linked;
  end if;
end $$;

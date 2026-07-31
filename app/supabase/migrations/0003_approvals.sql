-- ============================================================================
-- Account approval
--
-- Signup is now open to anyone; what varies is whether the account is live
-- immediately or waits for an admin.
--
--   .edu at a known school   → approved on the spot. The address already
--                              proves the affiliation better than a human
--                              scanning a queue can, so there is nothing for
--                              an admin to add.
--   on `allowed_emails`      → approved on the spot. Pre-vetted staff.
--   anything else            → pending. Advisors, exec, graduates, and .edu
--                              addresses at schools NCBO hasn't added yet.
--
-- Pending accounts can sign in and see their own status. They cannot read the
-- board, and that is enforced here, not in the app.
-- ============================================================================

create type public.account_status as enum ('pending', 'approved', 'suspended');

alter table public.profiles
  add column status       public.account_status not null default 'pending',
  add column approved_at  timestamptz,
  add column approved_by  uuid references public.profiles(id) on delete set null;

create index on public.profiles (status);

-- Anyone who exists before this migration was vetted by hand already.
update public.profiles set status = 'approved', approved_at = now();

create or replace function public.is_approved()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select status = 'approved' from public.profiles where id = auth.uid()), false)
$$;

-- ── signup ──────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
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

      -- A .edu we recognise is self-verifying. A .edu we don't recognise is a
      -- real student at a school with no club yet — worth a look, not a
      -- rejection.
      if school is not null then
        state := 'approved';
      end if;
    end if;
  else
    state := 'approved';
  end if;

  insert into public.profiles (id, display_name, school_id, status, approved_at)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(addr, '@', 1)),
          school,
          state,
          case when state = 'approved' then now() end);
  return new;
end;
$$;

-- ── privilege guard ─────────────────────────────────────────────────────────
-- Now covers `status` as well. Without this, "a member may edit their own
-- profile row" would let a pending account approve itself, which is the whole
-- gate.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a role.' using errcode = 'insufficient_privilege';
  end if;
  if new.status is distinct from old.status then
    raise exception 'Only an admin can approve or suspend an account.' using errcode = 'insufficient_privilege';
  end if;
  if new.club_id is distinct from old.club_id or new.school_id is distinct from old.school_id then
    raise exception 'Only an admin can reassign a club or school.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- ── policies: approved accounts only ────────────────────────────────────────
-- Reads now require an approved account. A pending user keeps exactly one
-- privilege: reading their own profile, so the app can tell them they're
-- waiting.
drop policy schools_read   on public.schools;
drop policy channels_read  on public.channels;
drop policy clubs_read     on public.clubs;
drop policy profiles_read  on public.profiles;
drop policy answers_read   on public.answers;

create policy schools_read  on public.schools  for select to authenticated using (public.is_approved());
create policy channels_read on public.channels for select to authenticated using (public.is_approved());
create policy clubs_read    on public.clubs    for select to authenticated using (public.is_approved());
create policy answers_read  on public.answers  for select to authenticated using (public.is_approved());
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_approved());

-- Writes require approval too — a pending account must not be able to post.
drop policy posts_insert     on public.posts;
drop policy questions_insert on public.questions;
drop policy answers_insert   on public.answers;

create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_approved());
create policy questions_insert on public.questions for insert to authenticated
  with check (author_id = auth.uid() and public.is_approved());
create policy answers_insert on public.answers for insert to authenticated
  with check (author_id = auth.uid() and public.is_moderator() and public.is_approved());

-- The feed views are SECURITY DEFINER — that's what lets them anonymise rows
-- the caller could not otherwise read. It also means they bypass every policy
-- above, so tightening RLS on the base tables did NOT keep pending accounts
-- off the board: they could still read all of it straight through the views.
-- Each view therefore has to check approval itself.
create or replace view public.post_feed as
select
  p.id, p.channel_id, p.parent_id, p.body, p.anonymous, p.created_at,
  case when p.anonymous then null else p.author_id end            as author_id,
  case when p.anonymous then 'Anonymous' else pr.display_name end as author_name,
  case when p.anonymous then null else pr.role end                as author_role,
  case when p.anonymous then null else s.name end                 as author_school
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join public.schools s on s.id = pr.school_id
where public.is_approved();

create or replace view public.question_feed as
select
  q.id, q.channel_id, q.body, q.anonymous, q.answered, q.created_at,
  case when q.anonymous then null else q.author_id end            as author_id,
  case when q.anonymous then 'Anonymous' else pr.display_name end as author_name,
  case when q.anonymous then null else s.name end                 as author_school,
  (select count(*) from public.answers a where a.question_id = q.id) as answer_count
from public.questions q
join public.profiles pr on pr.id = q.author_id
left join public.schools s on s.id = pr.school_id
where public.is_approved();

create or replace view public.answer_feed as
select a.id, a.question_id, a.body, a.created_at, a.author_id,
       pr.display_name as author_name, pr.role as author_role
from public.answers a
join public.profiles pr on pr.id = a.author_id
where public.is_approved();

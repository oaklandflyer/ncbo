-- ============================================================================
-- The club approval queue, and every roster repointed at membership.
--
-- 0015 built the model. This is the read and write surface over it, and the
-- audit 2.5 asks for: every query that lists club members now filters on an
-- active `club_memberships` row rather than on "any profile carrying a
-- club_id". Those are not the same set, and the difference is exactly the
-- people who should never have been on a roster — admins, exec, and the
-- coaching advisors.
--
-- The approval queue moves from the admin's desk to the club lead's, because
-- the person who can tell whether a name belongs at Pitt is at Pitt. An admin
-- keeps a read-only view of every queue for support, and is deliberately not
-- notified: being the fallback approver is what made the old queue back up
-- during recruiting season.
-- ============================================================================

-- ============================================================================
-- 1. Asking an applicant a question
--
-- The third action on the approval card, beside Approve and Deny. A lead who
-- half-recognises a name needs something between "yes" and "no", or they will
-- pick one of the two at random and the applicant will never know why.
-- ============================================================================
create table if not exists public.membership_notes (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.club_memberships(id) on delete cascade,
  author_id     uuid references public.profiles(id) on delete set null,
  body          text not null check (length(body) between 1 and 1000),
  -- A lead's private note about an applicant and a question addressed to that
  -- applicant are different things and must not share a column.
  to_applicant  boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists membership_notes_membership_idx
  on public.membership_notes (membership_id, created_at);

alter table public.membership_notes enable row level security;

drop policy if exists membership_notes_read   on public.membership_notes;
drop policy if exists membership_notes_insert on public.membership_notes;

create policy membership_notes_read on public.membership_notes for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.club_memberships m
                where m.id = membership_id and public.leads_club(m.club_id))
    or (to_applicant and exists (select 1 from public.club_memberships m
                                  where m.id = membership_id and m.user_id = auth.uid()))
  );

create policy membership_notes_insert on public.membership_notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.club_memberships m
                  where m.id = membership_id and public.leads_club(m.club_id))
      or exists (select 1 from public.club_memberships m
                  where m.id = membership_id and m.user_id = auth.uid())
    )
  );

grant select, insert on public.membership_notes to authenticated;

-- ============================================================================
-- 2. Vouches
--
-- Declared before the queue reads them. Referral fast-track lives in 4;
-- this is only the table and its policies.
-- ============================================================================
create table if not exists public.membership_vouches (
  membership_id uuid not null references public.club_memberships(id) on delete cascade,
  voucher_id    uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (membership_id, voucher_id)
);

alter table public.membership_vouches enable row level security;

drop policy if exists membership_vouches_read   on public.membership_vouches;
drop policy if exists membership_vouches_insert on public.membership_vouches;

create policy membership_vouches_read on public.membership_vouches for select to authenticated
  using (
    public.is_admin()
    or voucher_id = auth.uid()
    or exists (select 1 from public.club_memberships m
                where m.id = membership_id and public.leads_club(m.club_id))
  );

/* A voucher must be a verified, active member of the very club being applied
   to. Without that clause "three people vouched" would be three accounts made
   this morning, and the fast-track would be the easiest way in rather than
   the hardest.

   SECURITY DEFINER rather than an `exists` written inline in the policy, and
   this is not a style preference: a policy expression that reads
   `club_memberships` is itself filtered by `club_memberships`'s own policies,
   and an ordinary member cannot see a pending row. Inline, the check could
   never find the application it was being asked about, so every vouch was
   refused and the whole fast-track was dead. Same reason every other helper
   in this schema is SECURITY DEFINER, from `my_role()` onward. */
create or replace function public.can_vouch_for(target_membership uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.club_memberships target
      join public.club_memberships mine on mine.club_id = target.club_id
     where target.id = target_membership
       and target.status  = 'pending'
       and target.user_id <> auth.uid()
       and mine.user_id = auth.uid()
       and mine.status  = 'active'
       and mine.verified_at is not null
  )
$$;

revoke execute on function public.can_vouch_for(uuid) from anon;
grant execute on function public.can_vouch_for(uuid) to authenticated;

create policy membership_vouches_insert on public.membership_vouches for insert to authenticated
  with check (voucher_id = auth.uid() and public.can_vouch_for(membership_id));

grant select, insert on public.membership_vouches to authenticated;

-- ============================================================================
-- 3. The queue
--
-- SECURITY DEFINER, because it returns the six columns 0015 revoked at column
-- level: the legal name, the group-chat handle, how they found the club, the
-- student ID photo. Every field from 2.1 on one card, so a lead decides
-- without opening a second screen — and nobody but a lead of this club gets
-- to read them.
--
-- The authorisation is the first statement in the body and it is the whole
-- of 2.2's acceptance criterion: a lead at Pitt calling this with Purdue's
-- club id is refused, not filtered.
-- ============================================================================
create or replace function public.get_club_queue(target_club uuid)
returns table (
  membership_id       uuid,
  user_id             uuid,
  display_name        text,
  legal_name          text,
  preferred_name      text,
  grad_year           int,
  group_chat_platform text,
  group_chat_handle   text,
  found_via           text,
  referred_by_name    text,
  student_id_photo_path text,
  vouch_count         int,
  applied_at          timestamptz,
  hours_waiting       numeric,
  escalation_level    int
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.leads_club(target_club)) then
    raise exception 'Not a lead of that club.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      m.id, m.user_id, p.display_name,
      m.legal_name, m.preferred_name, m.grad_year,
      m.group_chat_platform, m.group_chat_handle, m.found_via,
      r.display_name,
      m.student_id_photo_path,
      (select count(*)::int from public.membership_vouches v where v.membership_id = m.id),
      m.created_at,
      round(extract(epoch from (now() - m.created_at)) / 3600.0, 1),
      m.escalation_level
      from public.club_memberships m
      join public.profiles p on p.id = m.user_id
      left join public.profiles r on r.id = m.referred_by_user_id
     where m.club_id = target_club
       and m.status  = 'pending'
     order by m.created_at;
end;
$$;

-- ============================================================================
-- 4. Deciding
--
-- One function rather than a bare UPDATE, so that approving cannot be done
-- without also writing who approved and by which method. Those were nullable
-- columns on a table a lead can write to; a lead who approved somebody with a
-- hand-rolled request would otherwise leave no record of having done it.
-- ============================================================================
create or replace function public.decide_membership(
  membership uuid,
  decision   text,
  note       text default null,
  method     public.verification_method default 'club_lead'
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  club uuid;
  current_status public.membership_status;
begin
  select m.club_id, m.status into club, current_status
    from public.club_memberships m where m.id = membership;

  if club is null then
    raise exception 'No such application.' using errcode = 'no_data_found';
  end if;

  if not (public.is_admin() or public.leads_club(club)) then
    raise exception 'Not a lead of that club.' using errcode = 'insufficient_privilege';
  end if;

  if current_status <> 'pending' then
    raise exception 'That application has already been decided.' using errcode = 'check_violation';
  end if;

  if decision not in ('approve', 'deny') then
    raise exception 'A decision is approve or deny.' using errcode = 'check_violation';
  end if;

  update public.club_memberships m
     set status              = case when decision = 'approve' then 'active' else 'denied' end::public.membership_status,
         -- Approving IS the verification: the lead saying "yes, I know this
         -- person" is the whole of what verified means here.
         verified_at         = case when decision = 'approve' then now() end,
         verified_by_user_id = case when decision = 'approve' then auth.uid() end,
         verification_method = case when decision = 'approve' then method end,
         decided_at          = now(),
         decided_by_user_id  = auth.uid(),
         decision_note       = coalesce(note, m.decision_note)
   where m.id = membership;
end;
$$;

-- ============================================================================
-- 5. Referral fast-track
--
-- Three already-verified members of the same chapter vouching for somebody is
-- a stronger signal than one lead skimming a list, and it costs the lead
-- nothing. They are told it happened rather than asked to confirm it.
-- ============================================================================

/* Three vouches auto-approves. A trigger rather than a scheduled sweep, so
   the applicant is let in at the moment the third vouch lands instead of
   whenever a job next runs. */
create or replace function public.apply_referral_fast_track()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  vouches int;
  club    uuid;
begin
  select count(*) into vouches from public.membership_vouches v
   where v.membership_id = new.membership_id;

  if vouches < 3 then
    return new;
  end if;

  select m.club_id into club from public.club_memberships m where m.id = new.membership_id;

  update public.club_memberships m
     set status              = 'active',
         verified_at         = now(),
         verification_method = 'referral',
         decided_at          = now()
   where m.id = new.membership_id
     and m.status = 'pending';

  -- The lead is told, not asked. An auto-approval nobody can see is how a
  -- chapter ends up with members its lead has never heard of.
  insert into public.membership_notes (membership_id, author_id, body, to_applicant)
  values (new.membership_id, null,
          'Auto-approved: three verified members of this chapter vouched for this applicant.',
          false);

  return new;
end;
$$;

drop trigger if exists apply_referral_fast_track_trg on public.membership_vouches;
create trigger apply_referral_fast_track_trg
  after insert on public.membership_vouches
  for each row execute function public.apply_referral_fast_track();

-- ============================================================================
-- 6. Escalation, and the single-approver warning
--
-- Lead turnover in May and December is the failure this exists for: a chapter
-- whose only approver has graduated has a queue nobody can act on, and the
-- first anyone hears of it is a recruiting season with no new members.
-- ============================================================================
create or replace function public.club_approver_count(target_club uuid)
returns int
language sql stable security definer set search_path = public, pg_temp
as $$
  select (
    select count(distinct who) from (
      select m.user_id as who from public.club_memberships m
       where m.club_id = target_club and m.status = 'active'
         and m.role in ('club_lead', 'co_lead')
      union
      select l.profile_id from public.club_leads l
       where l.club_id = target_club and l.profile_id is not null
    ) as approvers
  )::int
$$;

comment on function public.club_approver_count(uuid) is
  'How many people can act on this club''s queue. One is a warning: the lead''s view says so, because a club that drops to zero freezes every new signup.';

/* Bumps anything pending past 72 hours. Level 1 is the co-lead, level 2 is
   the Club Relations exec role. Idempotent, so it can be called on every
   queue render as well as by a scheduler, and will not re-notify. */
create or replace function public.escalate_stale_applications()
returns int
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  touched int;
begin
  update public.club_memberships m
     set escalation_level = case when now() - m.created_at > interval '144 hours' then 2 else 1 end,
         escalated_at     = now()
   where m.status = 'pending'
     and now() - m.created_at > interval '72 hours'
     and m.escalation_level < case when now() - m.created_at > interval '144 hours' then 2 else 1 end;

  get diagnostics touched = row_count;
  return touched;
end;
$$;

grant execute on function public.escalate_stale_applications() to authenticated;

-- ============================================================================
-- 7. The daily digest
--
-- One row per club per day, not one push per application. A lead who is
-- pinged for every signup during recruiting week turns notifications off, and
-- then hears about nothing at all.
--
-- No mail provider in this pass, by instruction. This table is the queue a
-- sender would drain; `sent_at` is what it would stamp.
-- ============================================================================
create table if not exists public.lead_digests (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  digest_on    date not null default current_date,
  pending      int  not null default 0,
  escalated    int  not null default 0,
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (club_id, digest_on)
);

alter table public.lead_digests enable row level security;

drop policy if exists lead_digests_read on public.lead_digests;
create policy lead_digests_read on public.lead_digests for select to authenticated
  using (public.is_admin() or public.leads_club(club_id));

grant select on public.lead_digests to authenticated;

create or replace function public.build_lead_digests()
returns int
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  built int;
begin
  insert into public.lead_digests (club_id, digest_on, pending, escalated)
  select m.club_id, current_date,
         count(*)::int,
         count(*) filter (where m.escalation_level > 0)::int
    from public.club_memberships m
   where m.status = 'pending'
   group by m.club_id
  on conflict (club_id, digest_on) do update
    set pending = excluded.pending, escalated = excluded.escalated;

  get diagnostics built = row_count;
  return built;
end;
$$;

-- ============================================================================
-- 8. Co-leads, on memberships
--
-- 0014's `set_club_lead` wrote to `club_leads`, which was the leadership
-- relation at the time. Leadership is a membership role now, so this writes
-- there and keeps `club_leads` in step for the named list the public site reads.
-- ============================================================================
create or replace function public.set_club_role(target uuid, target_club uuid, new_role public.membership_role)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  target_name text;
begin
  if not (public.is_admin() or public.leads_club(target_club)) then
    raise exception 'You do not lead that club.' using errcode = 'insufficient_privilege';
  end if;

  -- Only an admin appoints a club lead; a lead names co-leads. Same rule as
  -- the membership guard, restated because this path is SECURITY DEFINER and
  -- would otherwise sail past it.
  if new_role = 'club_lead' and not public.is_admin() then
    raise exception 'Only an admin can appoint a club lead.' using errcode = 'insufficient_privilege';
  end if;

  -- Nobody steps themselves down: a club that loses its last approver has no
  -- way back without an admin.
  if new_role = 'member' and target = auth.uid() and not public.is_admin() then
    raise exception 'Ask another lead or an admin to step you down.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.club_memberships m
     set role = new_role
   where m.user_id = target and m.club_id = target_club and m.status = 'active';

  if not found then
    raise exception 'That member is not on this club''s roster.' using errcode = 'no_data_found';
  end if;

  select p.display_name into target_name from public.profiles p where p.id = target;

  if new_role in ('club_lead', 'co_lead') then
    insert into public.club_leads (club_id, name, profile_id, ordinal)
    values (target_club, coalesce(target_name, 'Lead'), target,
            case when new_role = 'club_lead' then 0 else 5 end)
    on conflict (club_id, name) do update set profile_id = excluded.profile_id;
  else
    delete from public.club_leads where profile_id = target and club_id = target_club;
  end if;
end;
$$;

revoke execute on function public.set_club_role(uuid, uuid, public.membership_role) from anon;
grant execute on function public.set_club_role(uuid, uuid, public.membership_role) to authenticated;

-- ============================================================================
-- 9. The roster audit
--
-- Every query in the schema that lists club members, repointed from "any
-- profile carrying a club_id" to "an active club_memberships row". This is
-- 2.5, and it is the half of it that cannot be done in the app: a view is
-- what the Network tab, the club page and the admin table all read, so a view
-- that counts the wrong people is wrong on every screen at once.
--
-- What changes in practice: an admin, an exec board member or a coaching
-- advisor holds an `org_roles` row and no membership, so they fall out of
-- every roster and every headcount here. If one of them is genuinely a
-- student at a chapter, they have a membership like anybody else and appear
-- as a member — their org role is not what puts them there and never was.
-- ============================================================================

/* The club a person is actually on the roster of. One place to change, and
   it is what the three views below all agree on. */
create or replace view public.active_memberships
with (security_invoker = true) as
select
  m.id as membership_id,
  m.user_id,
  m.club_id,
  m.university_id,
  m.role,
  m.grad_year,
  m.verified_at,
  m.verification_method,
  (m.verified_at is not null) as is_verified,
  public.dues_current(m.id)   as dues_current,
  m.created_at
from public.club_memberships m
where m.status = 'active';

grant select on public.active_memberships to authenticated;

-- ── the member directory ────────────────────────────────────────────────────
-- Still every live account, because the Network tab is a people directory and
-- not a roster: somebody at a school with no chapter belongs in it. What
-- changes is where the club comes from. `club_name` is null unless there is an
-- active membership behind it, which is what makes "Independent" in the
-- profile popup a fact rather than a guess.
-- Dropped and recreated rather than replaced: `create or replace view` cannot
-- rename or reorder columns, and this projection gains `school_short_name` in
-- the middle of the list.
drop view if exists public.member_directory;

create view public.member_directory
with (security_invoker = true) as
select
  p.id, p.display_name, p.role, p.division, p.home_region,
  p.verified, p.credentials,
  am.club_id,
  c.name  as club_name,
  am.university_id as school_id,
  u.name  as school_name,
  coalesce(u.short_name, u.name) as school_short_name,
  u.state as school_state,
  p.instagram_handle, p.tiktok_handle,
  p.is_alumni, p.alumni_since,
  am.is_verified as member_verified,
  am.role        as club_role,
  am.grad_year
from public.profiles p
left join public.active_memberships am on am.user_id = p.id
left join public.clubs c        on c.id = am.club_id
left join public.universities u on u.id = am.university_id
where p.status = 'approved'
  and p.deleted_at is null;

grant select on public.member_directory to authenticated;

-- ── the club directory ──────────────────────────────────────────────────────
-- `member_count` was a correlated count over `profiles.club_id`, which is the
-- single most load-bearing wrong number in the app: it is what the Network
-- tab prints beside each chapter. It counts active memberships now.
drop view if exists public.club_directory;

create view public.club_directory
with (security_invoker = true) as
select
  c.id,
  c.name as club_name,
  c.status,
  c.active,
  c.founded_on,
  c.instagram,
  u.id    as school_id,
  u.id    as university_id,
  u.name  as school_name,
  coalesce(u.short_name, u.name) as short_name,
  u.state,
  u.domain,
  (select count(*) from public.club_memberships m
    where m.club_id = c.id and m.status = 'active') as member_count,
  (select count(*) from public.club_memberships m
    where m.club_id = c.id and m.status = 'pending') as pending_count,
  public.club_approver_count(c.id) as approver_count,
  coalesce(
    (select array_agg(l.name order by l.ordinal, l.name)
       from public.club_leads l where l.club_id = c.id),
    '{}'
  ) as leads
from public.clubs c
join public.universities u on u.id = c.university_id;

grant select on public.club_directory to authenticated;

-- ── the lead's roster ───────────────────────────────────────────────────────
-- Was `profiles.club_id = target and status = 'approved'`. Both halves change:
-- the membership is what puts somebody on the roster, and the verified and
-- dues flags are reported separately, because a lead chasing dues needs to
-- see who is behind without it looking like a verification problem.
-- Dropped first: `create or replace` cannot widen a function's RETURNS TABLE,
-- and this one gains columns.
drop function if exists public.get_club_roster(uuid);

create function public.get_club_roster(target_club uuid)
returns table (
  id uuid, display_name text, email text, role public.user_role,
  division text, class_year text, home_region text,
  is_alumni boolean, alumni_since date, is_lead boolean, created_at timestamptz,
  membership_id uuid, club_role public.membership_role, grad_year int,
  is_verified boolean, verification_method public.verification_method,
  dues_current boolean
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.leads_club(target_club)) then
    raise exception 'Not a lead of that club.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id, p.display_name, p.email, p.role,
           p.division, p.class_year, p.home_region,
           p.is_alumni, p.alumni_since,
           (m.role in ('club_lead', 'co_lead')) as is_lead,
           p.created_at,
           m.id, m.role, m.grad_year,
           (m.verified_at is not null),
           m.verification_method,
           public.dues_current(m.id)
      from public.club_memberships m
      join public.profiles p on p.id = m.user_id
     where m.club_id = target_club
       and m.status  = 'active'
       and p.deleted_at is null
     order by p.display_name;
end;
$$;

revoke execute on function public.get_club_roster(uuid) from anon;
grant execute on function public.get_club_roster(uuid) to authenticated;

-- ── the admin members table ─────────────────────────────────────────────────
-- Admin-only, and the one place an org-role holder SHOULD be visible with
-- their org role showing: it is the account-management screen, not a roster.
-- Dropped first: `create or replace` cannot widen a function's RETURNS TABLE,
-- and this one gains columns.
drop function if exists public.get_admin_members();

create function public.get_admin_members()
returns table (
  id uuid, display_name text, email text, role public.user_role,
  status public.account_status, club_id uuid, club_name text,
  school_id uuid, school_name text, division text, home_region text,
  verified boolean, credentials public.credential[],
  is_alumni boolean, alumni_since date, deleted_at timestamptz, created_at timestamptz,
  org_roles public.org_role[], membership_status public.membership_status
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id, p.display_name, p.email, p.role, p.status,
           m.club_id, c.name, m.university_id, u.name,
           p.division, p.home_region, p.verified, p.credentials,
           p.is_alumni, p.alumni_since, p.deleted_at, p.created_at,
           coalesce((select array_agg(o.role order by o.role)
                       from public.org_roles o where o.user_id = p.id), '{}'),
           m.status
      from public.profiles p
      left join public.club_memberships m
             on m.user_id = p.id and m.status in ('active', 'pending', 'alumni')
      left join public.clubs c        on c.id = m.club_id
      left join public.universities u on u.id = m.university_id
     order by p.display_name;
end;
$$;

revoke execute on function public.get_admin_members() from anon;
grant execute on function public.get_admin_members() to authenticated;

-- ============================================================================
-- 10. experience_phase
--
-- The column only. Part 3 builds the onboarding question and the three Home
-- layouts that read it; this exists now because the profile popup in 2.3 has
-- to show it, and because retro-fitting a column the popup already claims to
-- render is how a screen ends up with a field nobody can fill in.
--
-- Text with a check rather than an enum: this vocabulary is the one most
-- likely to be rewritten once real members answer it, and 0005 and 0012 each
-- cost a whole migration to add one enum value.
-- ============================================================================
alter table public.profiles
  add column if not exists experience_phase text
    check (experience_phase is null or experience_phase in
      ('new_to_lifting', 'new_to_bodybuilding', 'competing'));

comment on column public.profiles.experience_phase is
  'Which of the three personas the member says they are. Editable by them, drives the Home layout, shown on the profile popup.';

-- ============================================================================
-- 10. The profile popup's read
--
-- 2.3 lists what the popup shows and, more usefully, what it must not: no
-- email, no phone, no dues status, and never the group-chat handle, which is
-- verification data a lead collected and not a social handle to publish.
--
-- Enforced by projection rather than by a rule in the component. A React
-- component that "doesn't render" a field still shipped it to the browser;
-- this way the fields the popup must not show never leave Postgres, and the
-- one component in 2.3 cannot be made to leak them by a later edit.
-- ============================================================================
create or replace function public.get_public_profile(target uuid)
returns table (
  id uuid,
  display_name text,
  role public.user_role,
  club_id uuid,
  club_name text,
  university_name text,
  university_short_name text,
  grad_year int,
  is_verified boolean,
  club_role public.membership_role,
  org_roles public.org_role[],
  experience_phase text,
  division text,
  home_region text,
  instagram_handle text,
  tiktok_handle text,
  is_alumni boolean,
  vetted_coach boolean,
  credentials public.credential[]
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_approved() then
    raise exception 'Sign in to view a profile.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id, p.display_name, p.role,
           am.club_id, c.name, u.name, coalesce(u.short_name, u.name),
           am.grad_year,
           coalesce(am.is_verified, false),
           am.role,
           coalesce((select array_agg(o.role order by o.role)
                       from public.org_roles o where o.user_id = p.id), '{}'),
           p.experience_phase,
           p.division, p.home_region,
           p.instagram_handle, p.tiktok_handle,
           p.is_alumni,
           p.verified, p.credentials
      from public.profiles p
      left join public.active_memberships am on am.user_id = p.id
      left join public.clubs c        on c.id = am.club_id
      left join public.universities u on u.id = am.university_id
     where p.id = target
       and p.status = 'approved'
       and p.deleted_at is null;
end;
$$;

revoke execute on function public.get_public_profile(uuid) from anon;
grant execute on function public.get_public_profile(uuid) to authenticated;

-- ============================================================================
-- 12. Finding somebody to vouch for
--
-- The vouch policy authorises the right people, but authorisation is not
-- discovery: an ordinary member cannot SELECT a pending row at their own club,
-- by design, because who applied and was turned down is between them and their
-- lead. Without this, the referral fast-track is a path nobody can walk —
-- there is no way to learn the id of the application you are being asked to
-- vouch for.
--
-- So a narrow reader: pending applicants at a chapter the caller is verified
-- at, carrying a name and a count and nothing else. None of the six columns a
-- lead sees on the approval card appear here.
-- ============================================================================
create or replace function public.get_vouchable_applications()
returns table (
  membership_id uuid,
  display_name  text,
  club_id       uuid,
  club_name     text,
  vouch_count   int,
  i_have_vouched boolean,
  applied_at    timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  return query
    select m.id, p.display_name, m.club_id, c.name,
           (select count(*)::int from public.membership_vouches v where v.membership_id = m.id),
           exists (select 1 from public.membership_vouches v
                    where v.membership_id = m.id and v.voucher_id = auth.uid()),
           m.created_at
      from public.club_memberships m
      join public.profiles p on p.id = m.user_id
      join public.clubs    c on c.id = m.club_id
     where m.status = 'pending'
       and m.user_id <> auth.uid()
       and exists (
         select 1 from public.club_memberships mine
          where mine.user_id = auth.uid()
            and mine.club_id = m.club_id
            and mine.status  = 'active'
            and mine.verified_at is not null
       )
     order by m.created_at;
end;
$$;

revoke execute on function public.get_vouchable_applications() from anon;
grant execute on function public.get_vouchable_applications() to authenticated;

-- ============================================================================
-- 13. is_onboarded, by id
--
-- 0004's `is_onboarded(public.profiles)` takes a whole row, and a whole-row
-- reference requires SELECT on every column of the table — including `email`,
-- which `restrict_columns()` now holds back. So the composite form is callable
-- only by something that can already read everything, which is nobody the
-- policy layer is written for.
--
-- This overload takes an id and reads the row itself. The composite version
-- stays: it is `immutable` and can be used in an index or a generated column,
-- which this one cannot.
-- ============================================================================
create or replace function public.is_onboarded(target uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select public.is_onboarded(p) from public.profiles p where p.id = target), false)
$$;

revoke execute on function public.is_onboarded(uuid) from anon;
grant execute on function public.is_onboarded(uuid) to authenticated;

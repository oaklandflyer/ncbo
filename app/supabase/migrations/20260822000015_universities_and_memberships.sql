-- ============================================================================
-- Universities, clubs at 1:1, and membership as its own relation.
--
-- This migration takes apart the single idea the schema has carried since
-- 0001: that a person's login proves their affiliation, and that both live on
-- `profiles`. Two facts were folded into one column and they are not the same
-- fact.
--
--   Login identity   — this account exists and may sign in. Any address.
--   Student eligibility — this person is a real student in this chapter,
--                      vouched for by somebody who would know.
--
-- After this migration `profiles.status` answers only the first. The second
-- lives on `club_memberships`, is granted by a club lead, and is what gates
-- roster membership, chapter-private posting, dues rate, and competition
-- registration. Browsing is open to anyone with an account, on purpose: a
-- signup wall in front of the calendar costs more members than it protects.
--
-- Three structural decisions worth stating, because a later reader will
-- otherwise assume they were accidents:
--
--  1. **A university has exactly one club.** `clubs.university_id` carries a
--     unique index. This is not a stylistic preference — the signup flow in
--     2.1 resolves a university to *the* club, and a second club at the same
--     school would make that resolution ambiguous with no way for the user to
--     break the tie.
--
--  2. **Verified and dues-paid are two flags, never one.** A verified member
--     whose dues lapse loses gated access without re-verifying; re-verifying
--     someone every August because they hadn't paid yet would be busywork for
--     the lead and an insult to the member. `club_memberships.verified_at`
--     and `membership_dues` therefore expire independently.
--
--  3. **Org roles attach to the user, club roles to the membership.** An
--     admin or a coaching advisor is not a member of any chapter unless they
--     are separately a student in one. This is what keeps them out of every
--     roster and headcount, and it only works because the two live in
--     different tables.
--
-- `profiles.role`, `profiles.club_id` and `profiles.school_id` all survive as
-- derived mirrors, kept in step by trigger. Every policy and guard written
-- across 0001-0014 reads them, and rewriting all of that in the same pass as
-- the model change would leave nothing safe to review.
-- ============================================================================

-- ============================================================================
-- 1. schools becomes universities
--
-- Renamed in place rather than rebuilt beside it. Fourteen migrations' worth
-- of functions, views and policies name this table; a rename carries the
-- views, the indexes, the foreign keys and the policies with it, where a new
-- table plus a backfill would carry none of them.
--
-- `domain` stays, demoted. It is no longer identity — nothing resolves a
-- person to a school by their email address any more. It is a hint used by
-- exactly one optional path, the one-time school-email code, and it is
-- allowed to be null for the hundred-odd schools seeded below.
-- ============================================================================
do $$
begin
  if to_regclass('public.universities') is null then
    alter table public.schools rename to universities;
  end if;
end $$;

alter table public.universities
  add column if not exists short_name text,
  add column if not exists active     boolean not null default true;

comment on table public.universities is
  'Every school a student might pick at signup, whether or not NCBO has a chapter there.';
comment on column public.universities.domain is
  'Email-domain hint for the optional school-email verification code. Never a login identity, and null for most rows.';
comment on column public.universities.short_name is
  'What a chapter is called in conversation: "Pitt", not "University of Pittsburgh".';

-- The domain was `not null unique` when it was identity. It is neither now.
do $$
begin
  alter table public.universities alter column domain drop not null;
exception when others then
  raise notice 'universities.domain already nullable';
end $$;

-- Blank domains would collide on the unique index; there is one null per row
-- and nulls do not collide.
update public.universities set domain = null where btrim(coalesce(domain, '')) = '';

do $$
begin
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'universities'
                and policyname = 'schools_read') then
    alter policy schools_read on public.universities rename to universities_read;
  end if;
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'universities'
                and policyname = 'schools_write') then
    alter policy schools_write on public.universities rename to universities_write;
  end if;
end $$;

-- ── the compatibility view ──────────────────────────────────────────────────
-- `handle_new_user()`, `my_led_schools()` and friends name `public.schools` in
-- plpgsql, which resolves at call time, so they would break on the rename. A
-- simple auto-updatable view costs nothing and keeps them all working.
-- `security_invoker` so RLS on `universities` is still what decides.
--
-- New app code reads `universities` directly. This exists for the SQL that
-- predates it, and can go once none is left.
create or replace view public.schools
with (security_invoker = true) as
  select id, name, domain, state, created_at from public.universities;

grant select, insert, update, delete on public.schools to authenticated;
grant select on public.schools to anon;

-- ── short names ─────────────────────────────────────────────────────────────
-- Chapter names read as "Pitt" and "Penn State" everywhere in the app, so the
-- short name is what the UI shows and the legal name is what the lead checks
-- against a student record.
update public.universities u set short_name = v.short_name
  from (values
    ('pitt.edu',    'Pitt'),
    ('psu.edu',     'Penn State'),
    ('purdue.edu',  'Purdue'),
    ('fsu.edu',     'FSU'),
    ('uiowa.edu',   'Iowa'),
    ('sru.edu',     'Slippery Rock'),
    ('rutgers.edu', 'Rutgers'),
    ('baylor.edu',  'Baylor'),
    ('arizona.edu', 'Arizona')
  ) as v(domain, short_name)
 where u.domain = v.domain
   and u.short_name is distinct from v.short_name;

create index if not exists universities_name_idx   on public.universities (name);
create index if not exists universities_active_idx on public.universities (active) where active;

-- ============================================================================
-- 2. One club per university
--
-- 0011 said explicitly that no unique constraint was added "because one school
-- having two clubs is a thing that could legitimately happen later". That call
-- is reversed here, deliberately. Signup now asks for a university and
-- resolves it to a club with no tie-break available to the user, so a second
-- club at one school is not a richer model, it is an unanswerable question at
-- the moment somebody joins.
-- ============================================================================
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'clubs'
                and column_name = 'school_id' and is_generated = 'NEVER') then
    alter table public.clubs rename column school_id to university_id;
  end if;
end $$;

-- `my_led_schools()` and the seed blocks in 0011 read `clubs.school_id` by
-- name. A generated mirror keeps every one of them working without a second
-- writable column that could drift from the first.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'clubs'
                    and column_name = 'school_id') then
    alter table public.clubs
      add column school_id uuid generated always as (university_id) stored;
  end if;
end $$;

alter table public.clubs
  add column if not exists founded_on date,
  add column if not exists active     boolean not null default true;

-- `status` is the ladder (Active > Forming > Pipeline) and stays the thing the
-- public site reads. `active` is the narrower question of whether this club
-- takes signups at all, which a folded chapter answers differently from a
-- pipeline school that has never taken one.
update public.clubs set active = (status <> 'Pipeline') where active is distinct from (status <> 'Pipeline');

-- Fold any duplicate club into the oldest one at that university before the
-- unique index goes on. A no-op against the seeded data, which has always been
-- one club per school; it exists so this migration cannot fail halfway on a
-- database that drifted.
do $$
declare
  dup record;
  folded int := 0;
begin
  for dup in
    select c.id, c.university_id,
           first_value(c.id) over (partition by c.university_id order by c.created_at, c.id) as keeper
      from public.clubs c
  loop
    if dup.id <> dup.keeper then
      update public.club_leads set club_id = dup.keeper where club_id = dup.id;
      update public.profiles   set club_id = dup.keeper where club_id = dup.id;
      delete from public.clubs where id = dup.id;
      folded := folded + 1;
    end if;
  end loop;

  if folded > 0 then
    raise notice 'clubs: folded % duplicate club(s) into the oldest at their university', folded;
  end if;
end $$;

create unique index if not exists clubs_university_key on public.clubs (university_id);

comment on index public.clubs_university_key is
  'A university has exactly one club. Signup resolves a university to a club with no tie-break available, so a second row here is an unanswerable question.';

-- ============================================================================
-- 3. The vocabularies
--
-- Created fresh rather than extended, so every value is usable in this same
-- transaction. `alter type ... add value` is what 0005 and 0012 had to spend a
-- whole migration on; a new type has no such restriction.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type public.membership_status as enum ('pending', 'active', 'denied', 'lapsed', 'alumni');
  end if;

  if not exists (select 1 from pg_type where typname = 'membership_role') then
    create type public.membership_role as enum ('member', 'club_lead', 'co_lead');
  end if;

  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type public.org_role as enum ('admin', 'exec_board', 'coaching_advisor', 'board_of_directors');
  end if;

  -- Recorded so the organisation can see which path people actually take.
  -- The whole premise of 2.4 is that lead vouching carries the load and the
  -- school-email code is a nicety; that is a claim, and this column is how it
  -- gets checked against reality.
  if not exists (select 1 from pg_type where typname = 'verification_method') then
    create type public.verification_method as enum
      ('club_lead', 'referral', 'school_email', 'student_id', 'legacy_import');
  end if;
end $$;

-- ============================================================================
-- 4. club_memberships
--
-- The join between a person and a chapter, and the only place the answer to
-- "is this a real student here" is written down.
-- ============================================================================
create table if not exists public.club_memberships (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id)  on delete cascade,
  club_id             uuid not null references public.clubs(id)     on delete cascade,

  -- Denormalised from the club so the one-per-university index below can
  -- exist at all: an index expression cannot reach into another table. Kept in
  -- step by trigger, never written by hand.
  university_id       uuid references public.universities(id) on delete set null,

  status              public.membership_status not null default 'pending',
  role                public.membership_role   not null default 'member',

  -- ── the verified flag ────────────────────────────────────────────────────
  -- Set by a club lead. Expires at grad_year, which moves the row to 'alumni'
  -- rather than deleting it: a graduate is a former member, not a stranger.
  verified_at         timestamptz,
  verified_by_user_id uuid references public.profiles(id) on delete set null,
  verification_method public.verification_method,
  grad_year           int check (grad_year is null or grad_year between 1950 and 2100),

  -- ── what signup collects, for the lead to recognise them by (2.1) ────────
  legal_name          text check (legal_name is null or length(legal_name) between 1 and 120),
  preferred_name      text check (preferred_name is null or length(preferred_name) <= 60),
  group_chat_platform text check (group_chat_platform is null
                                  or group_chat_platform in ('GroupMe', 'Discord', 'Instagram')),
  group_chat_handle   text check (group_chat_handle is null or length(group_chat_handle) <= 120),
  found_via           text check (found_via is null or length(found_via) <= 120),
  referred_by_user_id uuid references public.profiles(id) on delete set null,
  student_id_photo_path text,

  -- ── the decision ─────────────────────────────────────────────────────────
  decided_at          timestamptz,
  decided_by_user_id  uuid references public.profiles(id) on delete set null,
  decision_note       text check (decision_note is null or length(decision_note) <= 500),

  -- 72 hours pending escalates to the co-lead, then to Club Relations. The
  -- level is stored rather than recomputed so an escalation notifies once.
  escalation_level    int not null default 0 check (escalation_level between 0 and 2),
  escalated_at        timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One row per person per club. Re-applying after a denial updates this row
  -- back to 'pending' rather than stacking a second application, which is
  -- also what keeps the queue from showing the same person twice.
  unique (user_id, club_id)
);

comment on table public.club_memberships is
  'A person''s affiliation with one chapter. Separate from profiles.status, which only says whether the account may sign in.';
comment on column public.club_memberships.group_chat_handle is
  'Verification data for club leads only. Column-level REVOKE below keeps it off the wire for everyone else, including the member''s own clubmates.';
comment on column public.club_memberships.verified_at is
  'When a lead vouched for this person. Independent of dues: see membership_dues.';

create index if not exists club_memberships_user_idx   on public.club_memberships (user_id);
create index if not exists club_memberships_club_idx   on public.club_memberships (club_id, status);
create index if not exists club_memberships_queue_idx  on public.club_memberships (club_id, created_at)
  where status = 'pending';
create index if not exists club_memberships_active_idx on public.club_memberships (club_id)
  where status = 'active';
create index if not exists club_memberships_referrer_idx on public.club_memberships (referred_by_user_id)
  where referred_by_user_id is not null;

-- The acceptance criterion from 2.1, as an index. `unique (user_id, club_id)`
-- above already implies it while clubs are 1:1 with universities; this states
-- it directly so the rule survives any future drift in that relationship.
-- A denied application is excluded, so being turned away once does not lock
-- somebody out of the school they actually attend.
create unique index if not exists club_memberships_one_per_university
  on public.club_memberships (user_id, university_id)
  where status <> 'denied' and university_id is not null;

-- ── keep university_id and updated_at honest ────────────────────────────────
create or replace function public.stamp_membership()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  select c.university_id into new.university_id from public.clubs c where c.id = new.club_id;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stamp_membership_trg on public.club_memberships;
create trigger stamp_membership_trg
  before insert or update on public.club_memberships
  for each row execute function public.stamp_membership();

-- ============================================================================
-- 5. org_roles
--
-- Attached to the user, never to a membership. This table is the whole of
-- 2.5: an admin, an exec board member or a coaching advisor holds a row here
-- and, unless they are separately a student somewhere, no membership at all —
-- which is what keeps them out of every roster and every headcount.
-- ============================================================================
create table if not exists public.org_roles (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.org_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null,
  primary key (user_id, role)
);

comment on table public.org_roles is
  'Organisation-level roles. Holding one is never club membership: rosters and headcounts read club_memberships and nothing else.';

create index if not exists org_roles_role_idx on public.org_roles (role);

-- ============================================================================
-- 6. Dues
--
-- Its own table with its own expiry, for the reason in the header: a verified
-- member whose dues lapse loses gated access without re-verifying.
--
-- No payment integration in this pass, by instruction. `provider` and
-- `provider_ref` are the seam a provider would attach to, and
-- `public.record_dues_payment()` is the one entry point a webhook would call.
-- Nothing calls it yet except a lead marking someone paid by hand.
-- ============================================================================
create table if not exists public.membership_dues (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.club_memberships(id) on delete cascade,
  term          text not null check (length(term) between 1 and 40),   -- 'Fall 2026'
  paid_at       timestamptz,
  expires_on    date not null,
  amount_cents  int check (amount_cents is null or amount_cents >= 0),
  provider      text check (provider is null or provider in ('manual', 'stripe')),
  provider_ref  text,
  recorded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (membership_id, term)
);

comment on table public.membership_dues is
  'One row per membership per term. Expiry is the term''s, not the verification''s: the two flags are deliberately independent.';

create index if not exists membership_dues_current_idx
  on public.membership_dues (membership_id, expires_on desc);

-- ============================================================================
-- 7. Interest from schools with no chapter
--
-- A student at a school NCBO has not reached yet finishes signup, sees an
-- honest message, and lands here. They get an account and the open surfaces;
-- what they do not get is a membership, because there is nothing to be a
-- member of. Blocking them at the form instead would throw away the single
-- clearest signal the organisation has about where to expand next.
-- ============================================================================
create table if not exists public.signup_interest (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete cascade,
  university_id   uuid references public.universities(id) on delete set null,
  grad_year       int check (grad_year is null or grad_year between 1950 and 2100),
  note            text check (note is null or length(note) <= 500),
  contacted_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_id, university_id)
);

create index if not exists signup_interest_university_idx
  on public.signup_interest (university_id, created_at desc);

-- ============================================================================
-- 8. The predicates
--
-- SECURITY DEFINER with a pinned search_path throughout, like every helper
-- since 0001: these are read from inside policies on the very tables they
-- query, which would otherwise recurse through RLS.
-- ============================================================================

/* The clubs the caller leads, from memberships. `club_leads` rows survive as
   the *named* leadership list, including people who have not signed up yet
   and therefore cannot have a membership; both are unioned so nobody loses
   access on the day this migration lands. */
create or replace function public.my_led_clubs()
returns uuid[]
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct club_id), '{}')
    from (
      select m.club_id
        from public.club_memberships m
       where m.user_id = auth.uid()
         and m.status  = 'active'
         and m.role in ('club_lead', 'co_lead')
      union
      select l.club_id
        from public.club_leads l
       where l.profile_id = auth.uid()
    ) as led
$$;

create or replace function public.leads_club(target_club uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select target_club is not null and target_club = any (public.my_led_clubs()) $$;

comment on function public.leads_club(uuid) is
  'Does the caller lead this specific club? The club-scoping predicate behind every queue and roster read.';

/* Does the caller hold this organisation role? Never consulted by a roster:
   an org role is not membership, which is the whole of 2.5. */
create or replace function public.has_org_role(r public.org_role)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.org_roles o where o.user_id = auth.uid() and o.role = r) $$;

create or replace function public.my_org_roles()
returns public.org_role[]
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(array_agg(o.role), '{}') from public.org_roles o where o.user_id = auth.uid()
$$;

/* An active member of a specific club. Distinct from verified: every active
   membership is verified today, but 'lapsed' and 'alumni' are active-shaped
   states that are not on the roster. */
create or replace function public.is_active_member_of(target_club uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.club_memberships m
     where m.user_id = auth.uid() and m.club_id = target_club and m.status = 'active'
  )
$$;

create or replace function public.is_verified_member_of(target_club uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.club_memberships m
     where m.user_id = auth.uid()
       and m.club_id = target_club
       and m.status  = 'active'
       and m.verified_at is not null
  )
$$;

/* Dues, asked separately on purpose. A membership with no dues row at all is
   not current — the default is "hasn't paid", never "assume paid". */
create or replace function public.dues_current(membership uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.membership_dues d
     where d.membership_id = membership
       and d.paid_at is not null
       and d.expires_on >= current_date
  )
$$;

-- ============================================================================
-- 9. The derived mirrors
--
-- `profiles.role`, `profiles.club_id` and `profiles.school_id` are no longer
-- written by anyone. They are computed from memberships and org roles and
-- pushed onto the row by trigger, so that every policy and guard written
-- across 0001-0014 keeps reading a value that is true.
--
-- The role ladder collapses two vocabularies into the one `user_role` enum
-- the old policies understand:
--
--   any org admin                     → 'admin'
--   advisor, exec, board of directors → 'advisor'   (the moderator surface)
--   club_lead or co_lead of a club    → 'club_lead'
--   anyone else                       → 'member'
-- ============================================================================
create or replace function public.derived_club(target uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select m.club_id from public.club_memberships m
   where m.user_id = target and m.status = 'active'
   order by m.verified_at nulls last, m.created_at
   limit 1
$$;

create or replace function public.derived_university(target uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select m.university_id from public.club_memberships m
      where m.user_id = target and m.status in ('active', 'alumni', 'lapsed')
      order by (m.status = 'active') desc, m.created_at
      limit 1),
    (select i.university_id from public.signup_interest i
      where i.user_id = target order by i.created_at limit 1)
  )
$$;

create or replace function public.derived_role(target uuid)
returns public.user_role
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when exists (select 1 from public.org_roles o
                  where o.user_id = target and o.role = 'admin') then 'admin'
    when exists (select 1 from public.org_roles o
                  where o.user_id = target
                    and o.role in ('coaching_advisor', 'exec_board', 'board_of_directors')) then 'advisor'
    when exists (select 1 from public.club_memberships m
                  where m.user_id = target and m.status = 'active'
                    and m.role in ('club_lead', 'co_lead')) then 'club_lead'
    when exists (select 1 from public.club_leads l where l.profile_id = target) then 'club_lead'
    else 'member'
  end::public.user_role
$$;

/* Push the three derived values onto the profile row. Owned by the migration
   role and SECURITY DEFINER, so it is not subject to RLS; `guard_profile_
   privileges` still fires and still permits it, because the guard now allows
   any write whose values are exactly the derived ones. That check is what
   makes this safe without a bypass flag somebody could set. */
-- ── the guard learns about the mirror ───────────────────────────────────────
-- `sync_profile_mirror()` below writes role, club_id and school_id onto a
-- profile row, and `guard_profile_privileges` refuses exactly those three
-- columns to everyone but an admin. A club lead approving an applicant would
-- therefore be refused by the guard on the sync, which is how the approval
-- path fails: the lead does not yet lead that person's club, because granting
-- the membership is the thing that would make them do so.
--
-- The escape is a comparison rather than a bypass flag. A write is the mirror
-- sync if nothing but those three columns changed AND each of them now equals
-- exactly what the model derives. Nobody gains anything by forging it: the
-- only values it will accept are the ones their memberships already imply.
-- `to_jsonb(new) - cols` is what makes "nothing else changed" exact, instead
-- of a list of columns that a later migration would forget to extend.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  reviewing boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  if to_jsonb(new) - '{role,club_id,school_id}'::text[]
     = to_jsonb(old) - '{role,club_id,school_id}'::text[]
     and new.role      is not distinct from public.derived_role(new.id)
     and new.club_id   is not distinct from public.derived_club(new.id)
     and new.school_id is not distinct from public.derived_university(new.id) then
    return new;
  end if;

  if new.is_adult is distinct from old.is_adult and new.id <> auth.uid() then
    raise exception 'Only the member themselves can make the 18+ attestation.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.is_alumni is distinct from old.is_alumni
     and not (new.id = auth.uid() or public.is_admin() or public.leads_club_of(new.id)) then
    raise exception 'Only the member, their club lead, or an admin can change alumni status.'
      using errcode = 'insufficient_privilege';
  end if;

  if public.is_admin() then
    return new;
  end if;

  reviewing := public.leads_school_of(new.id)
           and new.id <> auth.uid()
           and old.status = 'pending'
           and new.status in ('approved', 'rejected')
           and new.deleted_at is not distinct from old.deleted_at
           and new.school_id is not distinct from old.school_id
           and new.role is not distinct from old.role
           and new.club_id is not distinct from old.club_id
           and new.display_name is not distinct from old.display_name
           and new.division is not distinct from old.division
           and new.class_year is not distinct from old.class_year
           and new.home_region is not distinct from old.home_region
           and new.is_alumni is not distinct from old.is_alumni;

  if public.my_role() = 'club_lead'
     and new.id <> auth.uid()
     and not public.leads_club_of(new.id)
     and not reviewing then
    raise exception 'A club lead can only manage members of their own club.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status or new.deleted_at is distinct from old.deleted_at then
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

  if new.club_id is distinct from old.club_id
     and not (public.leads_club_of(old.id) and new.club_id is null) then
    raise exception 'Only an admin can assign a club.' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create or replace function public.sync_profile_mirror(target uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if target is null then
    return;
  end if;

  update public.profiles p
     set role      = public.derived_role(target),
         club_id   = public.derived_club(target),
         school_id = public.derived_university(target)
   where p.id = target
     and (p.role      is distinct from public.derived_role(target)
       or p.club_id   is distinct from public.derived_club(target)
       or p.school_id is distinct from public.derived_university(target));
end;
$$;

create or replace function public.sync_profile_mirror_trg()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_profile_mirror(old.user_id);
    return old;
  end if;

  perform public.sync_profile_mirror(new.user_id);
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.sync_profile_mirror(old.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_mirror_membership_trg on public.club_memberships;
create trigger sync_mirror_membership_trg
  after insert or update or delete on public.club_memberships
  for each row execute function public.sync_profile_mirror_trg();

drop trigger if exists sync_mirror_org_role_trg on public.org_roles;
create trigger sync_mirror_org_role_trg
  after insert or update or delete on public.org_roles
  for each row execute function public.sync_profile_mirror_trg();

-- ── my_club(), repointed ────────────────────────────────────────────────────
-- Was `profiles.club_id`, which is now the mirror rather than the fact. Reads
-- the membership directly so it cannot lag a sync.
create or replace function public.my_club()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select public.derived_club(auth.uid()) $$;

-- ============================================================================
-- 10. The membership guard
--
-- `club_memberships_update` decides who may write to a row at all. This
-- decides which columns and which transitions, and it is where the club
-- scoping in 2.2 is actually enforced: a lead at Pitt reaching a Purdue row
-- is refused here even if they hand-crafted the request.
-- ============================================================================
create or replace function public.guard_membership_privileges()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  lead_here boolean;
  is_self   boolean;
begin
  -- A trusted server-side context: a migration, or the SQL editor. Ordinary
  -- requests always carry a uid.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  lead_here := public.leads_club(new.club_id) and public.leads_club(old.club_id);
  is_self   := new.user_id = auth.uid();

  -- Nobody moves a membership between people or between clubs. Reassigning
  -- either is how a lead at one chapter would reach another chapter's row.
  if new.user_id is distinct from old.user_id or new.club_id is distinct from old.club_id then
    raise exception 'A membership cannot be moved between people or clubs.'
      using errcode = 'insufficient_privilege';
  end if;

  if lead_here then
    -- Only an admin appoints a club_lead. A lead may name a co-lead, which is
    -- what 2.2 asks for, and cannot promote anyone to their own seat.
    if new.role is distinct from old.role and new.role = 'club_lead' then
      raise exception 'Only an admin can appoint a club lead.' using errcode = 'insufficient_privilege';
    end if;

    -- The vouch is the lead's own act and is recorded in their own name.
    if new.verified_by_user_id is distinct from old.verified_by_user_id
       and new.verified_by_user_id is distinct from auth.uid() then
      raise exception 'A verification is recorded in the name of whoever made it.'
        using errcode = 'insufficient_privilege';
    end if;

    return new;
  end if;

  if is_self then
    -- The applicant may correct what they typed, while it is still pending.
    if new.status is distinct from old.status then
      raise exception 'A club lead decides on an application, not the applicant.'
        using errcode = 'insufficient_privilege';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Only a club lead or an admin can change a club role.'
        using errcode = 'insufficient_privilege';
    end if;
    if new.verified_at         is distinct from old.verified_at
       or new.verified_by_user_id is distinct from old.verified_by_user_id
       or new.verification_method is distinct from old.verification_method then
      raise exception 'Nobody verifies themselves.' using errcode = 'insufficient_privilege';
    end if;
    if new.decided_at is distinct from old.decided_at
       or new.decided_by_user_id is distinct from old.decided_by_user_id then
      raise exception 'The decision record is not the applicant''s to write.'
        using errcode = 'insufficient_privilege';
    end if;
    if old.status <> 'pending'
       and (new.legal_name        is distinct from old.legal_name
         or new.group_chat_handle is distinct from old.group_chat_handle) then
      raise exception 'Verification details are fixed once a decision has been made.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  raise exception 'You do not lead that club.' using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists guard_membership_privileges_trg on public.club_memberships;
create trigger guard_membership_privileges_trg
  before update on public.club_memberships
  for each row execute function public.guard_membership_privileges();

/* Applications arrive pending, unverified, and as an ordinary member, whoever
   submits them. Enforced on INSERT rather than left to the policy's WITH
   CHECK so that an admin-side insert is held to the same shape. */
create or replace function public.guard_membership_insert()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.is_admin() or public.leads_club(new.club_id) then
    return new;
  end if;

  if new.user_id <> auth.uid() then
    raise exception 'You can only apply for yourself.' using errcode = 'insufficient_privilege';
  end if;

  new.status              := 'pending';
  new.role                := 'member';
  new.verified_at         := null;
  new.verified_by_user_id := null;
  new.verification_method := null;
  new.decided_at          := null;
  new.decided_by_user_id  := null;
  new.escalation_level    := 0;
  return new;
end;
$$;

drop trigger if exists guard_membership_insert_trg on public.club_memberships;
create trigger guard_membership_insert_trg
  before insert on public.club_memberships
  for each row execute function public.guard_membership_insert();

-- ============================================================================
-- 11. Row-level security
-- ============================================================================
alter table public.club_memberships enable row level security;
alter table public.org_roles        enable row level security;
alter table public.membership_dues  enable row level security;
alter table public.signup_interest  enable row level security;

-- ── club_memberships ────────────────────────────────────────────────────────
drop policy if exists club_memberships_read   on public.club_memberships;
drop policy if exists club_memberships_insert on public.club_memberships;
drop policy if exists club_memberships_update on public.club_memberships;
drop policy if exists club_memberships_delete on public.club_memberships;

/* Four readers, narrowing outward:
     · the member, always, so they can see where their own application stands
     · a lead of that club, which is the queue
     · an admin, for support
     · any live account, but only rows that are already public roster facts

   A pending application is deliberately NOT in that last clause. Who applied
   and was turned down is between them and their lead. */
create policy club_memberships_read on public.club_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.leads_club(club_id)
    or (public.is_approved() and status in ('active', 'alumni'))
  );

create policy club_memberships_insert on public.club_memberships for insert to authenticated
  with check (
    (user_id = auth.uid() and public.is_approved())
    or public.is_admin()
    or public.leads_club(club_id)
  );

create policy club_memberships_update on public.club_memberships for update to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.leads_club(club_id))
  with check (user_id = auth.uid() or public.is_admin() or public.leads_club(club_id));

-- Removing a membership erases the record of a decision. Statuses exist for
-- every legitimate ending: denied, lapsed, alumni.
create policy club_memberships_delete on public.club_memberships for delete to authenticated
  using (public.is_admin());

/* ── the columns a clubmate must not read ────────────────────────────────────
   The read policy above lets any live account see active memberships, because
   a roster is public within the organisation. These six columns are not
   roster facts — they are what a lead uses to decide whether somebody is
   real, and 2.3 says explicitly that the group-chat handle is verification
   data for leads only.

   Column privileges rather than a policy, for the reason 0014 gave about
   `profiles.email`: RLS is row-level, so the moment a row is readable every
   column on it is. Leads reach these through `get_club_queue()`, which is
   SECURITY DEFINER and does its own authorisation.

   The mechanism is in `restrict_columns()` below, and it is NOT the
   `revoke select (col)` that 0014 used. See the note there. */
revoke update (university_id, verified_at, verified_by_user_id, verification_method)
  on public.club_memberships from anon;

-- ── org_roles ───────────────────────────────────────────────────────────────
drop policy if exists org_roles_read  on public.org_roles;
drop policy if exists org_roles_write on public.org_roles;

-- Readable: 2.3 puts exec and coaching-advisor badges on the profile popup,
-- so who holds which org role is public within the organisation.
create policy org_roles_read on public.org_roles for select to authenticated
  using (public.is_approved());

create policy org_roles_write on public.org_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── membership_dues ─────────────────────────────────────────────────────────
drop policy if exists membership_dues_read  on public.membership_dues;
drop policy if exists membership_dues_write on public.membership_dues;

/* Your own dues, or the dues of somebody in a club you lead. Deliberately not
   readable by clubmates: 2.3 lists dues status among the things the profile
   popup must never show, and the cheapest way to keep it off a screen is to
   keep it off the wire. */
create policy membership_dues_read on public.membership_dues for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.club_memberships m
       where m.id = membership_id
         and (m.user_id = auth.uid() or public.leads_club(m.club_id))
    )
  );

create policy membership_dues_write on public.membership_dues for all to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.club_memberships m
                where m.id = membership_id and public.leads_club(m.club_id))
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.club_memberships m
                where m.id = membership_id and public.leads_club(m.club_id))
  );

-- ── signup_interest ─────────────────────────────────────────────────────────
drop policy if exists signup_interest_insert on public.signup_interest;
drop policy if exists signup_interest_read   on public.signup_interest;

create policy signup_interest_insert on public.signup_interest for insert to authenticated
  with check (user_id = auth.uid());

-- Where NCBO should expand next is an organisation question, not a member one.
create policy signup_interest_read on public.signup_interest for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_org_role('exec_board')
    or public.has_org_role('board_of_directors')
  );

grant select, insert, update on public.club_memberships to authenticated;
grant delete on public.club_memberships to authenticated;
grant select on public.org_roles to authenticated;
grant select, insert, update, delete on public.org_roles to authenticated;
grant select, insert, update, delete on public.membership_dues to authenticated;
grant select, insert on public.signup_interest to authenticated;

-- ============================================================================
-- 11a. Column privileges that actually hold
--
-- 0014 wrote `revoke select (email) on public.profiles from authenticated` and
-- recorded, correctly, that RLS could not do this job. The mechanism it
-- reached for does not do it either: in PostgreSQL a column-level REVOKE
-- against a role that holds table-level SELECT is a no-op, and Supabase grants
-- table-level SELECT on every table in `public` to `authenticated`. So
-- `profiles.email` has been readable by any signed-in member since 0014
-- landed, and the test that was meant to catch it passed for an unrelated
-- reason: RLS returned the member zero rows, so nothing was printed and the
-- absent column was never noticed.
--
-- The mechanism that does hold is the other way round: take away the
-- table-level grant, then hand back an explicit column list. Done here through
-- a helper that computes the list by subtraction, so a column added by a
-- future migration is readable by default and only the named secrets are held
-- back. A denylist that has to be maintained is a denylist that will be
-- forgotten; this one only has to name what is actually sensitive.
-- ============================================================================
create or replace function public.restrict_columns(tbl regclass, deny text[])
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  allowed text;
begin
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into allowed
    from pg_attribute a
   where a.attrelid = tbl
     and a.attnum > 0
     and not a.attisdropped
     and not (a.attname = any (deny));

  execute format('revoke select on %s from authenticated, anon', tbl);
  if allowed is not null then
    execute format('grant select (%s) on %s to authenticated', allowed, tbl);
  end if;
end;
$$;

revoke execute on function public.restrict_columns(regclass, text[]) from authenticated, anon;

comment on function public.restrict_columns(regclass, text[]) is
  'Grants SELECT on every column of a table except the named ones. A column-level REVOKE cannot do this: it is a no-op against the table-level grant Supabase issues.';

-- The six from 2.1 that are verification data, not roster facts.
select public.restrict_columns('public.club_memberships',
  array['legal_name', 'group_chat_handle', 'group_chat_platform',
        'found_via', 'student_id_photo_path', 'decision_note']);

-- And the one 0014 meant to protect and did not.
select public.restrict_columns('public.profiles', array['email']);

-- ============================================================================
-- 12. The dues seam
--
-- No payment provider in this pass, by instruction. This is the single
-- function a provider's webhook would call, so that when one is added there
-- is one place to change and not a dozen call sites. A lead marking somebody
-- paid by hand goes through the same door, with provider = 'manual'.
-- ============================================================================
create or replace function public.record_dues_payment(
  p_membership   uuid,
  p_term         text,
  p_expires      date,
  p_amount_cents int  default null,
  p_provider     text default 'manual',
  p_provider_ref text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  club uuid;
  row_id uuid;
begin
  select m.club_id into club from public.club_memberships m where m.id = p_membership;
  if club is null then
    raise exception 'No such membership.' using errcode = 'no_data_found';
  end if;

  if not (public.is_admin() or public.leads_club(club)) then
    raise exception 'Only a club lead or an admin can record dues.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Every parameter is prefixed. Unprefixed, `term` was ambiguous between the
  -- parameter and the column in `on conflict (membership_id, term)`, and
  -- plpgsql resolves that by refusing at run time rather than at creation, so
  -- the function installed cleanly and failed on first use.
  insert into public.membership_dues
    (membership_id, term, paid_at, expires_on, amount_cents, provider, provider_ref, recorded_by)
  values
    (p_membership, p_term, now(), p_expires, p_amount_cents, p_provider, p_provider_ref, auth.uid())
  on conflict (membership_id, term) do update
    set paid_at      = excluded.paid_at,
        expires_on   = excluded.expires_on,
        amount_cents = excluded.amount_cents,
        provider     = excluded.provider,
        provider_ref = excluded.provider_ref,
        recorded_by  = excluded.recorded_by
  returning id into row_id;

  return row_id;
end;
$$;

revoke execute on function public.record_dues_payment(uuid, text, date, int, text, text) from anon;
grant execute on function public.record_dues_payment(uuid, text, date, int, text, text) to authenticated;

-- ============================================================================
-- 13. Signup, reopened
--
-- 0001 required a .edu address and raised otherwise, aborting the signup
-- transaction. 0002 and 0003 softened that to an allowlist and a queue, but
-- the premise survived intact: your email address is what proves you are a
-- student.
--
-- It does not, and the reason is not theoretical. Students do not read the
-- inbox their school gave them and will not maintain a password on it, so a
-- school address is a barrier to the people it was meant to admit and no
-- barrier at all to anyone who can guess a format. Verification moves to a
-- human who knows the person — their club lead — and the address goes back to
-- being what it always was, a way to send somebody a link.
--
-- So: any address may sign up, and the account is live immediately. Live
-- means the open surfaces only. Every gated surface asks about a membership,
-- and this trigger creates none.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  addr text := lower(trim(new.email));
begin
  insert into public.profiles (id, display_name, status, approved_at, email)
  values (new.id,
          nullif(new.raw_user_meta_data ->> 'display_name', ''),
          'approved',
          now(),
          addr)
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Provisions a live account for any address. Chapter membership is a separate record, granted by a club lead.';

-- Accounts that were waiting on the old queue are live now, because the thing
-- they were waiting for is no longer an account-level question. Whether they
-- get into a chapter is decided below, by a lead, on a membership row.
update public.profiles set status = 'approved', approved_at = coalesce(approved_at, now())
 where status = 'pending';

-- ============================================================================
-- 14. Backfill
--
-- Order matters: org roles first, so that a mirror sync triggered by the
-- membership inserts below already knows who is an admin and does not demote
-- them for the length of one statement.
-- ============================================================================

-- ── org roles ───────────────────────────────────────────────────────────────
insert into public.org_roles (user_id, role)
select p.id, 'admin'::public.org_role from public.profiles p where p.role = 'admin'
on conflict do nothing;

insert into public.org_roles (user_id, role)
select p.id, 'coaching_advisor'::public.org_role from public.profiles p where p.role = 'advisor'
on conflict do nothing;

-- ── memberships ─────────────────────────────────────────────────────────────
-- Only `member` and `club_lead` accounts become memberships. An advisor or an
-- admin does NOT, even if they carry a `club_id` today: that column has been
-- writable by admins for fourteen migrations and there is no way to tell an
-- advisor who genuinely trains at Pitt from one who was assigned there to see
-- the page. Guessing would seed exactly the rosters 2.5 exists to clear, so
-- the affiliation has to be re-established by a lead, deliberately. Any
-- account this affects is named in the notice below.
insert into public.club_memberships
  (user_id, club_id, status, role, verified_at, verification_method, grad_year, legal_name, created_at)
select
  p.id,
  p.club_id,
  case
    when p.is_alumni          then 'alumni'::public.membership_status
    when p.status = 'approved' then 'active'::public.membership_status
    else 'pending'::public.membership_status
  end,
  case when exists (select 1 from public.club_leads l where l.profile_id = p.id and l.club_id = p.club_id)
         or p.role = 'club_lead'
       then 'club_lead'::public.membership_role
       else 'member'::public.membership_role
  end,
  case when p.status = 'approved' then coalesce(p.approved_at, p.created_at) end,
  case when p.status = 'approved' then 'legacy_import'::public.verification_method end,
  nullif(regexp_replace(coalesce(p.class_year, ''), '\D', '', 'g'), '')::int,
  p.full_name,
  p.created_at
  from public.profiles p
 where p.club_id is not null
   and p.role in ('member', 'club_lead')
   and p.status in ('approved', 'pending')
   and p.deleted_at is null
on conflict (user_id, club_id) do nothing;

do $$
declare
  orphans text[];
begin
  select coalesce(array_agg(coalesce(p.display_name, p.id::text)), '{}') into orphans
    from public.profiles p
   where p.role in ('advisor', 'admin')
     and p.club_id is not null;

  if array_length(orphans, 1) > 0 then
    raise notice 'org-role holders left off every roster (re-add through the club queue if they are genuinely students): %',
      array_to_string(orphans, ', ');
  end if;
end $$;

-- A pending applicant with no club yet, but a school that has one, becomes a
-- pending application at that club: the queue in 2.2 is where they now wait.
insert into public.club_memberships (user_id, club_id, status, role, legal_name, created_at)
select p.id, c.id, 'pending', 'member', p.full_name, p.created_at
  from public.profiles p
  join public.clubs c on c.university_id = p.school_id
 where p.club_id is null
   and p.school_id is not null
   and p.role = 'member'
   and p.deleted_at is null
   and not exists (select 1 from public.club_memberships m where m.user_id = p.id)
on conflict (user_id, club_id) do nothing;

-- ── the mirrors, brought into line ──────────────────────────────────────────
-- Every profile, once, so that an account whose club_id or role no longer
-- matches the model it is derived from is corrected here rather than at some
-- unrelated moment months from now.
do $$
declare
  target uuid;
begin
  for target in select id from public.profiles loop
    perform public.sync_profile_mirror(target);
  end loop;
end $$;

-- ============================================================================
-- 15. The university list
--
-- Wider than NCBO's footprint on purpose. A student at a school with no
-- chapter has to be able to find their own school in the picker and land in an
-- honest "no chapter yet" state; the alternative is a free-text box, which
-- would give the organisation four spellings of Ohio State and no way to
-- count them.
--
-- `on conflict (domain)` so the nine schools already here keep their ids,
-- their clubs and their members, and gain a short name.
-- ============================================================================
insert into public.universities (name, domain, state, short_name, active) values
  ('University of Pittsburgh',                    'pitt.edu',        'PA', 'Pitt',             true),
  ('Pennsylvania State University',               'psu.edu',         'PA', 'Penn State',       true),
  ('Purdue University',                           'purdue.edu',      'IN', 'Purdue',           true),
  ('Florida State University',                    'fsu.edu',         'FL', 'FSU',              true),
  ('University of Iowa',                          'uiowa.edu',       'IA', 'Iowa',             true),
  ('Slippery Rock University',                    'sru.edu',         'PA', 'Slippery Rock',    true),
  ('Rutgers University',                          'rutgers.edu',     'NJ', 'Rutgers',          true),
  ('Baylor University',                           'baylor.edu',      'TX', 'Baylor',           true),
  ('University of Arizona',                       'arizona.edu',     'AZ', 'Arizona',          true),
  ('Arizona State University',                    'asu.edu',         'AZ', 'Arizona State',    true),
  ('Auburn University',                           'auburn.edu',      'AL', 'Auburn',           true),
  ('Boston College',                              'bc.edu',          'MA', 'Boston College',   true),
  ('Boston University',                           'bu.edu',          'MA', 'BU',               true),
  ('Bowling Green State University',              'bgsu.edu',        'OH', 'Bowling Green',    true),
  ('Brigham Young University',                    'byu.edu',         'UT', 'BYU',              true),
  ('Brown University',                            'brown.edu',       'RI', 'Brown',            true),
  ('Bucknell University',                         'bucknell.edu',    'PA', 'Bucknell',         true),
  ('California Polytechnic State University',     'calpoly.edu',     'CA', 'Cal Poly',         true),
  ('Carnegie Mellon University',                  'cmu.edu',         'PA', 'Carnegie Mellon',  true),
  ('Case Western Reserve University',             'case.edu',        'OH', 'Case Western',     true),
  ('Clemson University',                          'clemson.edu',     'SC', 'Clemson',          true),
  ('Colorado State University',                   'colostate.edu',   'CO', 'Colorado State',   true),
  ('Columbia University',                         'columbia.edu',    'NY', 'Columbia',         true),
  ('Cornell University',                          'cornell.edu',     'NY', 'Cornell',          true),
  ('Dartmouth College',                           'dartmouth.edu',   'NH', 'Dartmouth',        true),
  ('DePaul University',                           'depaul.edu',      'IL', 'DePaul',           true),
  ('Drexel University',                           'drexel.edu',      'PA', 'Drexel',           true),
  ('Duke University',                             'duke.edu',        'NC', 'Duke',             true),
  ('Duquesne University',                         'duq.edu',         'PA', 'Duquesne',         true),
  ('East Carolina University',                    'ecu.edu',         'NC', 'East Carolina',    true),
  ('Emory University',                            'emory.edu',       'GA', 'Emory',            true),
  ('Florida Atlantic University',                 'fau.edu',         'FL', 'FAU',              true),
  ('Florida International University',            'fiu.edu',         'FL', 'FIU',              true),
  ('George Mason University',                     'gmu.edu',         'VA', 'George Mason',     true),
  ('Georgetown University',                       'georgetown.edu',  'DC', 'Georgetown',       true),
  ('Georgia Institute of Technology',             'gatech.edu',      'GA', 'Georgia Tech',     true),
  ('Georgia State University',                    'gsu.edu',         'GA', 'Georgia State',    true),
  ('Harvard University',                          'harvard.edu',     'MA', 'Harvard',          true),
  ('Indiana University',                          'iu.edu',          'IN', 'Indiana',          true),
  ('Iowa State University',                       'iastate.edu',     'IA', 'Iowa State',       true),
  ('James Madison University',                    'jmu.edu',         'VA', 'James Madison',    true),
  ('Johns Hopkins University',                    'jhu.edu',         'MD', 'Johns Hopkins',    true),
  ('Kansas State University',                     'ksu.edu',         'KS', 'Kansas State',     true),
  ('Kent State University',                       'kent.edu',        'OH', 'Kent State',       true),
  ('Lehigh University',                           'lehigh.edu',      'PA', 'Lehigh',           true),
  ('Louisiana State University',                  'lsu.edu',         'LA', 'LSU',              true),
  ('Loyola University Chicago',                   'luc.edu',         'IL', 'Loyola Chicago',   true),
  ('Marquette University',                        'marquette.edu',   'WI', 'Marquette',        true),
  ('Massachusetts Institute of Technology',       'mit.edu',         'MA', 'MIT',              true),
  ('Miami University',                            'miamioh.edu',     'OH', 'Miami (OH)',       true),
  ('Michigan State University',                   'msu.edu',         'MI', 'Michigan State',   true),
  ('Mississippi State University',                'msstate.edu',     'MS', 'Mississippi State',true),
  ('New York University',                         'nyu.edu',         'NY', 'NYU',              true),
  ('North Carolina State University',             'ncsu.edu',        'NC', 'NC State',         true),
  ('Northeastern University',                     'northeastern.edu','MA', 'Northeastern',     true),
  ('Northern Illinois University',                'niu.edu',         'IL', 'Northern Illinois',true),
  ('Northwestern University',                     'northwestern.edu','IL', 'Northwestern',     true),
  ('Ohio State University',                       'osu.edu',         'OH', 'Ohio State',       true),
  ('Ohio University',                             'ohio.edu',        'OH', 'Ohio',             true),
  ('Oklahoma State University',                   'okstate.edu',     'OK', 'Oklahoma State',   true),
  ('Old Dominion University',                     'odu.edu',         'VA', 'Old Dominion',     true),
  ('Oregon State University',                     'oregonstate.edu', 'OR', 'Oregon State',     true),
  ('Princeton University',                        'princeton.edu',   'NJ', 'Princeton',        true),
  ('Rensselaer Polytechnic Institute',            'rpi.edu',         'NY', 'RPI',              true),
  ('Rochester Institute of Technology',           'rit.edu',         'NY', 'RIT',              true),
  ('Saint Joseph''s University',                  'sju.edu',         'PA', 'Saint Joseph''s',  true),
  ('San Diego State University',                  'sdsu.edu',        'CA', 'San Diego State',  true),
  ('Seton Hall University',                       'shu.edu',         'NJ', 'Seton Hall',       true),
  ('Southern Methodist University',               'smu.edu',         'TX', 'SMU',              true),
  ('Stanford University',                         'stanford.edu',    'CA', 'Stanford',         true),
  ('Stony Brook University',                      'stonybrook.edu',  'NY', 'Stony Brook',      true),
  ('Syracuse University',                         'syr.edu',         'NY', 'Syracuse',         true),
  ('Temple University',                           'temple.edu',      'PA', 'Temple',           true),
  ('Texas A&M University',                        'tamu.edu',        'TX', 'Texas A&M',        true),
  ('Texas Christian University',                  'tcu.edu',         'TX', 'TCU',              true),
  ('Texas Tech University',                       'ttu.edu',         'TX', 'Texas Tech',       true),
  ('Towson University',                           'towson.edu',      'MD', 'Towson',           true),
  ('Tulane University',                           'tulane.edu',      'LA', 'Tulane',           true),
  ('University of Alabama',                       'ua.edu',          'AL', 'Alabama',          true),
  ('University of Arkansas',                      'uark.edu',        'AR', 'Arkansas',         true),
  ('University of California, Berkeley',          'berkeley.edu',    'CA', 'Berkeley',         true),
  ('University of California, Davis',             'ucdavis.edu',     'CA', 'UC Davis',         true),
  ('University of California, Irvine',            'uci.edu',         'CA', 'UC Irvine',        true),
  ('University of California, Los Angeles',       'ucla.edu',        'CA', 'UCLA',             true),
  ('University of California, San Diego',         'ucsd.edu',        'CA', 'UC San Diego',     true),
  ('University of California, Santa Barbara',     'ucsb.edu',        'CA', 'UC Santa Barbara', true),
  ('University of Central Florida',               'ucf.edu',         'FL', 'UCF',              true),
  ('University of Cincinnati',                    'uc.edu',          'OH', 'Cincinnati',       true),
  ('University of Colorado Boulder',              'colorado.edu',    'CO', 'Colorado',         true),
  ('University of Connecticut',                   'uconn.edu',       'CT', 'UConn',            true),
  ('University of Delaware',                      'udel.edu',        'DE', 'Delaware',         true),
  ('University of Florida',                       'ufl.edu',         'FL', 'Florida',          true),
  ('University of Georgia',                       'uga.edu',         'GA', 'Georgia',          true),
  ('University of Houston',                       'uh.edu',          'TX', 'Houston',          true),
  ('University of Illinois Chicago',              'uic.edu',         'IL', 'UIC',              true),
  ('University of Illinois Urbana-Champaign',     'illinois.edu',    'IL', 'Illinois',         true),
  ('University of Kansas',                        'ku.edu',          'KS', 'Kansas',           true),
  ('University of Kentucky',                      'uky.edu',         'KY', 'Kentucky',         true),
  ('University of Louisville',                    'louisville.edu',  'KY', 'Louisville',       true),
  ('University of Maryland',                      'umd.edu',         'MD', 'Maryland',         true),
  ('University of Massachusetts Amherst',         'umass.edu',       'MA', 'UMass',            true),
  ('University of Miami',                         'miami.edu',       'FL', 'Miami',            true),
  ('University of Michigan',                      'umich.edu',       'MI', 'Michigan',         true),
  ('University of Minnesota',                     'umn.edu',         'MN', 'Minnesota',        true),
  ('University of Mississippi',                   'olemiss.edu',     'MS', 'Ole Miss',         true),
  ('University of Missouri',                      'missouri.edu',    'MO', 'Missouri',         true),
  ('University of Nebraska-Lincoln',              'unl.edu',         'NE', 'Nebraska',         true),
  ('University of Nevada, Las Vegas',             'unlv.edu',        'NV', 'UNLV',             true),
  ('University of New Hampshire',                 'unh.edu',         'NH', 'New Hampshire',    true),
  ('University of North Carolina at Chapel Hill', 'unc.edu',         'NC', 'UNC',              true),
  ('University of Notre Dame',                    'nd.edu',          'IN', 'Notre Dame',       true),
  ('University of Oklahoma',                      'ou.edu',          'OK', 'Oklahoma',         true),
  ('University of Oregon',                        'uoregon.edu',     'OR', 'Oregon',           true),
  ('University of Rhode Island',                  'uri.edu',         'RI', 'Rhode Island',     true),
  ('University of South Carolina',                'sc.edu',          'SC', 'South Carolina',   true),
  ('University of South Florida',                 'usf.edu',         'FL', 'USF',              true),
  ('University of Southern California',           'usc.edu',         'CA', 'USC',              true),
  ('University of Tennessee',                     'utk.edu',         'TN', 'Tennessee',        true),
  ('University of Texas at Austin',               'utexas.edu',      'TX', 'Texas',            true),
  ('University of Utah',                          'utah.edu',        'UT', 'Utah',             true),
  ('University of Vermont',                       'uvm.edu',         'VT', 'Vermont',          true),
  ('University of Virginia',                      'virginia.edu',    'VA', 'Virginia',         true),
  ('University of Washington',                    'uw.edu',          'WA', 'Washington',       true),
  ('University of Wisconsin-Madison',             'wisc.edu',        'WI', 'Wisconsin',        true),
  ('Vanderbilt University',                       'vanderbilt.edu',  'TN', 'Vanderbilt',       true),
  ('Villanova University',                        'villanova.edu',   'PA', 'Villanova',        true),
  ('Virginia Commonwealth University',            'vcu.edu',         'VA', 'VCU',              true),
  ('Virginia Tech',                               'vt.edu',          'VA', 'Virginia Tech',    true),
  ('Wake Forest University',                      'wfu.edu',         'NC', 'Wake Forest',      true),
  ('Washington State University',                 'wsu.edu',         'WA', 'Washington State', true),
  ('West Chester University',                     'wcupa.edu',       'PA', 'West Chester',     true),
  ('West Virginia University',                    'wvu.edu',         'WV', 'West Virginia',    true),
  ('Western Michigan University',                 'wmich.edu',       'MI', 'Western Michigan', true),
  ('Yale University',                             'yale.edu',        'CT', 'Yale',             true)
on conflict (domain) do update
  set short_name = coalesce(public.universities.short_name, excluded.short_name),
      state      = coalesce(public.universities.state, excluded.state),
      active     = true;

-- A university with no chapter is still a valid choice at signup. This is the
-- read the picker uses: every active school, with its club if it has one.
create or replace view public.university_picker
with (security_invoker = true) as
select
  u.id,
  u.name,
  coalesce(u.short_name, u.name) as short_name,
  u.state,
  c.id     as club_id,
  c.name   as club_name,
  c.status as club_status,
  (c.id is not null and coalesce(c.active, false)) as has_chapter
from public.universities u
left join public.clubs c on c.university_id = u.id
where u.active;

grant select on public.university_picker to authenticated, anon;

comment on view public.university_picker is
  'What the signup dropdown reads. One row per university, with its single club or nulls: the 1:1 relation is what makes this a left join and not a nested list.';

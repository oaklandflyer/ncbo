-- ============================================================================
-- NCBO member app — initial schema
--
-- Roles: member · club_lead · advisor · admin
--
-- Two rules shape everything below:
--
--  1. Permissions are enforced in the database (row-level security), not in
--     the UI. Hiding a button is not access control — anyone can call the API
--     directly with their own session token. Every table has RLS enabled and
--     no table is readable or writable except through an explicit policy.
--
--  2. Identity is private by default. Email addresses are never copied into
--     `profiles`; they stay in `auth.users`, which clients cannot read. A
--     member's own email is available from their session. Anonymous posts go
--     out through views that null the author before it ever leaves Postgres.
-- ============================================================================

-- ── roles ───────────────────────────────────────────────────────────────────
create type public.user_role as enum ('member', 'club_lead', 'advisor', 'admin');

-- ── schools ─────────────────────────────────────────────────────────────────
-- `domain` is what ties a signup to a school: alex@pitt.edu resolves to Pitt.
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  domain      text not null unique,          -- 'pitt.edu'
  state       text,
  created_at  timestamptz not null default now()
);

-- ── clubs ───────────────────────────────────────────────────────────────────
create table public.clubs (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  status      text not null default 'Forming' check (status in ('Active', 'Forming')),
  instagram   text,
  created_at  timestamptz not null default now()
);
create index on public.clubs (school_id);

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per auth user. No email column, on purpose — see header note 2.
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default 'Member',
  school_id     uuid references public.schools(id) on delete set null,
  club_id       uuid references public.clubs(id) on delete set null,
  role          public.user_role not null default 'member',
  division      text,
  home_region   text,
  created_at    timestamptz not null default now()
);
create index on public.profiles (club_id);
create index on public.profiles (role);

-- ── channels ────────────────────────────────────────────────────────────────
create table public.channels (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

-- ── posts (channel discussion, one level of replies) ────────────────────────
create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.channels(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  parent_id   uuid references public.posts(id) on delete cascade,
  body        text not null check (length(body) between 1 and 240),
  anonymous   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on public.posts (channel_id, created_at desc);
create index on public.posts (parent_id);

-- ── questions + answers (the Q&A board) ─────────────────────────────────────
-- Only advisors and admins may answer; that's enforced by policy below.
create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid references public.channels(id) on delete set null,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (length(body) between 1 and 1000),
  anonymous   boolean not null default false,
  answered    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on public.questions (created_at desc);

create table public.answers (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (length(body) between 1 and 4000),
  created_at   timestamptz not null default now()
);
create index on public.answers (question_id, created_at);

-- ============================================================================
-- Helper predicates. SECURITY DEFINER + a pinned search_path so they can read
-- `profiles` from inside a policy on `profiles` without recursing through RLS.
-- ============================================================================
create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_moderator()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.my_role() in ('advisor', 'admin'), false) $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.my_role() = 'admin', false) $$;

create or replace function public.my_club()
returns uuid
language sql stable security definer set search_path = public
as $$ select club_id from public.profiles where id = auth.uid() $$;

-- ============================================================================
-- Signup: require a .edu address, then provision the profile.
--
-- Raising here aborts the signup transaction, so a non-.edu address never
-- becomes a user. The client checks the domain too, but only so the error is
-- friendly — this is the check that counts.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  addr   text := lower(new.email);
  dom    text;
  school uuid;
begin
  if addr !~ '^[^@]+@([a-z0-9-]+\.)*[a-z0-9-]+\.edu$' then
    raise exception 'NCBO membership requires a .edu school email address.'
      using errcode = 'check_violation';
  end if;

  dom := split_part(addr, '@', 2);

  -- Exact match first, then parent domain, so cs.pitt.edu resolves to pitt.edu.
  select id into school from public.schools where domain = dom;
  if school is null then
    select id into school from public.schools
     where dom like '%.' || domain
     order by length(domain) desc limit 1;
  end if;

  insert into public.profiles (id, display_name, school_id)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(addr, '@', 1)),
          school);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Role escalation guard.
--
-- The profiles UPDATE policy lets a member edit their own row. Without this
-- trigger, "edit your own row" would include setting role = 'admin'. Only an
-- admin may change a role, or move someone between clubs/schools.
-- ============================================================================
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- No auth.uid() means this is a trusted server-side context: a migration,
  -- the Supabase SQL editor, or the service-role key. That is how the first
  -- admin gets created — there is no admin yet to authorise it. Ordinary
  -- requests can't reach here unauthenticated: the profiles UPDATE policy
  -- already requires `id = auth.uid() or is_admin()`, both false for anon.
  if auth.uid() is null then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a role.' using errcode = 'insufficient_privilege';
  end if;
  if new.club_id is distinct from old.club_id or new.school_id is distinct from old.school_id then
    raise exception 'Only an admin can reassign a club or school.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger guard_profile_privileges_trg
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ============================================================================
-- Row-level security
-- ============================================================================
alter table public.schools   enable row level security;
alter table public.clubs     enable row level security;
alter table public.profiles  enable row level security;
alter table public.channels  enable row level security;
alter table public.posts     enable row level security;
alter table public.questions enable row level security;
alter table public.answers   enable row level security;

-- schools / channels — reference data: everyone signed in reads, admin writes.
create policy schools_read   on public.schools  for select to authenticated using (true);
create policy schools_write  on public.schools  for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy channels_read  on public.channels for select to authenticated using (true);
create policy channels_write on public.channels for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- clubs — readable by all members; a club lead edits their own club, admin any.
create policy clubs_read on public.clubs for select to authenticated using (true);
create policy clubs_update on public.clubs for update to authenticated
  using (public.is_admin() or (public.my_role() = 'club_lead' and id = public.my_club()))
  with check (public.is_admin() or (public.my_role() = 'club_lead' and id = public.my_club()));
create policy clubs_insert on public.clubs for insert to authenticated with check (public.is_admin());
create policy clubs_delete on public.clubs for delete to authenticated using (public.is_admin());

-- profiles — the member directory. Readable (no emails live here); you may
-- edit your own row, subject to the privilege guard above. Admins edit anyone.
create policy profiles_read   on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_admin());

-- posts — base table is deliberately NOT broadly readable. Members read the
-- feed through public.post_feed, which strips the author from anonymous rows
-- before it leaves the database. Direct reads are limited to your own posts
-- and to moderators, who need identity to moderate.
create policy posts_read_own on public.posts for select to authenticated
  using (author_id = auth.uid() or public.is_moderator());
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid());
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator());

-- questions — same shape as posts.
create policy questions_read_own on public.questions for select to authenticated
  using (author_id = auth.uid() or public.is_moderator());
create policy questions_insert on public.questions for insert to authenticated
  with check (author_id = auth.uid());
create policy questions_update on public.questions for update to authenticated
  using (author_id = auth.uid() or public.is_moderator())
  with check (author_id = auth.uid() or public.is_moderator());
create policy questions_delete on public.questions for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator());

-- answers — this is the advisor/exec surface. Members read them (via the view)
-- but cannot write one; the WITH CHECK is what enforces that.
create policy answers_read on public.answers for select to authenticated using (true);
create policy answers_insert on public.answers for insert to authenticated
  with check (author_id = auth.uid() and public.is_moderator());
create policy answers_update on public.answers for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy answers_delete on public.answers for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ============================================================================
-- Read views — the anonymity boundary.
--
-- These are SECURITY DEFINER views (the default): they bypass RLS on the base
-- table and expose a projection that nulls the author of an anonymous row.
-- That is why the base-table SELECT policies above are narrow — if members
-- could read `posts` directly, anonymity would be cosmetic.
-- ============================================================================
create view public.post_feed as
select
  p.id, p.channel_id, p.parent_id, p.body, p.anonymous, p.created_at,
  case when p.anonymous then null else p.author_id end                        as author_id,
  case when p.anonymous then 'Anonymous' else pr.display_name end             as author_name,
  case when p.anonymous then null else pr.role end                            as author_role,
  case when p.anonymous then null else s.name end                             as author_school
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join public.schools s on s.id = pr.school_id;

create view public.question_feed as
select
  q.id, q.channel_id, q.body, q.anonymous, q.answered, q.created_at,
  case when q.anonymous then null else q.author_id end            as author_id,
  case when q.anonymous then 'Anonymous' else pr.display_name end as author_name,
  case when q.anonymous then null else s.name end                 as author_school,
  (select count(*) from public.answers a where a.question_id = q.id) as answer_count
from public.questions q
join public.profiles pr on pr.id = q.author_id
left join public.schools s on s.id = pr.school_id;

-- Answers are never anonymous: the whole point is knowing an advisor said it.
create view public.answer_feed as
select a.id, a.question_id, a.body, a.created_at, a.author_id,
       pr.display_name as author_name, pr.role as author_role
from public.answers a
join public.profiles pr on pr.id = a.author_id;

grant select on public.post_feed, public.question_feed, public.answer_feed to authenticated;

-- ============================================================================
-- Seed: channels and the founding schools/clubs, matching the public site.
-- ============================================================================
insert into public.channels (slug, name, description, sort) values
  ('general',    'General',         'Anything network-wide.', 1),
  ('prep',       'Prep & Training', 'Programming, peak week, and everything before stage.', 2),
  ('nutrition',  'Nutrition',       'Dining halls, budgets, cutting and filling.', 3),
  ('posing',     'Posing',          'Mandatories, routines, stage presence.', 4),
  ('club-leads', 'Club Leads',      'Running a club: roster, school paperwork, recruiting.', 5),
  ('meets',      'Meets',           'Travel, logistics, and meet-day questions.', 6);

insert into public.schools (name, domain, state) values
  ('University of Pittsburgh',  'pitt.edu',   'PA'),
  ('Penn State University',     'psu.edu',    'PA'),
  ('Slippery Rock University',  'sru.edu',    'PA'),
  ('Purdue University',         'purdue.edu', 'IN'),
  ('University of Iowa',        'uiowa.edu',  'IA'),
  ('Florida State University',  'fsu.edu',    'FL');

insert into public.clubs (school_id, name, status)
select id,
       case domain
         when 'pitt.edu'   then 'Fitness & Bodybuilding Club'
         when 'psu.edu'    then 'Bodybuilding & Fitness Club'
         when 'sru.edu'    then 'Bodybuilding & Fitness Club'
         else 'Bodybuilding Club'
       end,
       case when domain in ('pitt.edu', 'psu.edu', 'purdue.edu') then 'Active' else 'Forming' end
from public.schools;

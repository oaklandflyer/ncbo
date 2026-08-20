-- ============================================================================
-- V1: the official club roster, soft delete for questions, and a widened
-- read policy on the board.
--
-- Idempotent throughout — every insert is an upsert on a natural key, every
-- column is `if not exists`, every policy is dropped before it is created.
-- ============================================================================

-- ============================================================================
-- 1. The board's read policy
--
-- The narrow policy (`questions_read_own`: author or moderator) was never what
-- made the board work — members read through `question_feed`, a SECURITY
-- DEFINER view that bypasses RLS and nulls the author of anonymous rows before
-- they leave Postgres. That still holds.
--
-- Widening the base table anyway, as asked, with one carve-out: anonymous
-- questions stay out of it. The base table carries `author_id`, so exposing
-- approved anonymous rows here would handto every member exactly the identity
-- the anonymous toggle exists to withhold. Members still see those questions
-- through the view, authorless, as they always have.
-- ============================================================================
drop policy if exists questions_read_own on public.questions;
drop policy if exists questions_read     on public.questions;

create policy questions_read on public.questions for select to authenticated
  using (
    -- your own, at any status, so "Your questions" shows a pending row
    author_id = auth.uid()
    -- moderators work the queue
    or public.is_moderator()
    -- and the shared board: approved, and not somebody's anonymous post
    or (public.is_approved() and status = 'approved' and not anonymous)
  );

-- ============================================================================
-- 2. Soft delete
--
-- `answers.question_id` and `question_votes.question_id` are both ON DELETE
-- CASCADE, so a hard delete takes every answer and vote with it and leaves no
-- record of what was removed. A moderator removing a question is a moderation
-- decision, not a data-retention event: the row stops being readable, and it
-- is still there to look at if the decision is questioned.
--
-- True DELETE is left in place (the existing `questions_delete` policy) for
-- the rare case, and the app does not offer it.
-- ============================================================================
alter table public.questions
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists questions_live_idx on public.questions (created_at desc)
  where deleted_at is null;

-- Only a moderator may set or clear it — same shape as the status guard, and
-- restated in full because `create or replace` replaces the whole body.
create or replace function public.guard_question_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.status is distinct from old.status and not public.is_moderator() then
    raise exception 'Only an advisor or admin can approve or reject a question.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.deleted_at is distinct from old.deleted_at and not public.is_moderator() then
    raise exception 'Only an advisor or admin can remove a question.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_question_status_trg on public.questions;
create trigger guard_question_status_trg
  before update on public.questions
  for each row execute function public.guard_question_status();

-- ── the read paths drop removed questions ───────────────────────────────────
drop view if exists public.question_feed;

create view public.question_feed as
select
  q.id, q.channel_id, q.body, q.anonymous, q.answered, q.status, q.created_at,
  case when q.anonymous then null else q.author_id end            as author_id,
  case when q.anonymous then 'Anonymous' else pr.display_name end as author_name,
  case when q.anonymous then null else s.name end                 as author_school,
  (select count(*) from public.answers a where a.question_id = q.id)        as answer_count,
  (select count(*) from public.question_votes v where v.question_id = q.id) as helpful_count,
  exists (
    select 1 from public.question_votes v
     where v.question_id = q.id and v.user_id = auth.uid()
  ) as voted_by_me
from public.questions q
join public.profiles pr on pr.id = q.author_id
left join public.schools s on s.id = pr.school_id
where public.is_approved()
  and q.deleted_at is null
  and (q.status = 'approved' or public.is_moderator());

grant select on public.question_feed to authenticated;

create or replace view public.answer_feed as
select a.id, a.question_id, a.body, a.created_at, a.author_id,
       pr.display_name as author_name, pr.role as author_role,
       pr.verified as author_verified, pr.credentials as author_credentials
from public.answers a
join public.profiles pr on pr.id = a.author_id
join public.questions q on q.id = a.question_id
where public.is_approved()
  and q.deleted_at is null
  and (q.status = 'approved' or public.is_moderator() or a.author_id = auth.uid());

-- ============================================================================
-- 3. The club roster
--
-- A reconcile, not a seed: six clubs already exist under working names, and a
-- blind insert would double them. Schools key on `domain`, which is already
-- unique. Clubs key on `school_id` — no unique constraint is added for it,
-- because one school having two clubs is a thing that could legitimately
-- happen later; the upsert below matches on school and renames in place.
-- ============================================================================

-- Pipelines are schools NCBO is talking to, not clubs that exist. Represented
-- as a third status rather than an `is_pipeline` flag: status already answers
-- "how real is this club", and two columns answering it would eventually
-- disagree. Active > Forming > Pipeline is one ladder.
do $$
begin
  alter table public.clubs drop constraint if exists clubs_status_check;
  alter table public.clubs
    add constraint clubs_status_check
    check (status in ('Active', 'Forming', 'Pipeline'));
end $$;

insert into public.schools (name, domain, state) values
  ('University of Pittsburgh',        'pitt.edu',     'PA'),
  ('Purdue University',               'purdue.edu',   'IN'),
  ('Florida State University',        'fsu.edu',      'FL'),
  ('Pennsylvania State University',   'psu.edu',      'PA'),
  ('University of Iowa',              'uiowa.edu',    'IA'),
  ('Rutgers University',              'rutgers.edu',  'NJ'),
  ('Slippery Rock University',        'sru.edu',      'PA'),
  ('Baylor University',               'baylor.edu',   'TX'),
  ('University of Arizona',           'arizona.edu',  'AZ')
on conflict (domain) do update
  set name  = excluded.name,
      state = excluded.state;

-- One club per school, matched on school. `update … else insert` rather than
-- `on conflict`, since there is no unique key on school_id to conflict on.
do $$
declare
  row record;
begin
  for row in
    select * from (values
      ('pitt.edu',    'Fitness and Bodybuilding Club',                 'Active'),
      ('purdue.edu',  'Purdue Bodybuilding Club',                      'Active'),
      ('fsu.edu',     'FSU Bodybuilding and Fitness (BBAF) Club',      'Active'),
      ('psu.edu',     'Bodybuilding & Fitness Club at Penn State',     'Active'),
      ('uiowa.edu',   'Bodybuilding Club at UIowa',                    'Active'),
      ('rutgers.edu', 'Rutgers Bodybuilding',                          'Active'),
      ('sru.edu',     'Bodybuilding & Fitness Club at Slippery Rock',  'Active'),
      ('baylor.edu',  'Baylor Bodybuilding Club',                      'Pipeline'),
      ('arizona.edu', 'Arizona Bodybuilding Club',                     'Pipeline')
    ) as r(domain, club_name, club_status)
  loop
    update public.clubs c
       set name = row.club_name, status = row.club_status
      from public.schools s
     where s.domain = row.domain and c.school_id = s.id;

    if not found then
      insert into public.clubs (school_id, name, status)
      select s.id, row.club_name, row.club_status
        from public.schools s
       where s.domain = row.domain;
    end if;
  end loop;
end $$;

-- ============================================================================
-- 4. Club leads
--
-- A table, not a text array on `clubs`: these are people who will have
-- accounts. `profile_id` is null until the person signs up, and then the row
-- links rather than being retyped — which an array could never do.
-- ============================================================================
create table if not exists public.club_leads (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null check (length(name) between 1 and 120),
  profile_id uuid references public.profiles(id) on delete set null,
  ordinal    int  not null default 0,
  created_at timestamptz not null default now(),
  -- One person named once per club. This is also what makes the seed below
  -- re-runnable without duplicating anybody.
  unique (club_id, name)
);

create index if not exists club_leads_club_idx on public.club_leads (club_id, ordinal);

alter table public.club_leads enable row level security;

drop policy if exists club_leads_read  on public.club_leads;
drop policy if exists club_leads_write on public.club_leads;

-- Who runs a club is roster information, readable by any approved member.
create policy club_leads_read on public.club_leads for select to authenticated
  using (public.is_approved());

-- Admins maintain the roster. A club lead editing their own club's lead list
-- is a reasonable future step; it is not V1, and the narrower policy is the
-- one that is safe to widen later.
create policy club_leads_write on public.club_leads for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.club_leads (club_id, name, ordinal)
select c.id, lead.name, lead.ordinal
  from (values
    ('pitt.edu',    'Rachel Hare',     0),
    ('pitt.edu',    'Luke Rudolph',    1),
    ('purdue.edu',  'Vincent Panzica', 0),
    ('purdue.edu',  'Altan Sahin',     1),
    ('fsu.edu',     'Eli Korta',       0),
    ('fsu.edu',     'David',           1),
    ('psu.edu',     'Isabel Ward',     0),
    ('uiowa.edu',   'Alex Swanson',    0),
    ('uiowa.edu',   'Sam Lampert',     1),
    ('rutgers.edu', 'Andrew Cho',      0),
    ('sru.edu',     'Sean Hanley',     0)
  ) as lead(domain, name, ordinal)
  join public.schools s on s.domain = lead.domain
  join public.clubs   c on c.school_id = s.id
on conflict (club_id, name) do update
  set ordinal = excluded.ordinal;

-- ============================================================================
-- 5. The club directory
--
-- The Network tab groups by whoever has signed up, so a club with no members
-- does not exist as far as the app is concerned. This view is the roster
-- itself, with headcount as a property — including zero.
-- ============================================================================
create or replace view public.club_directory
with (security_invoker = true) as
select
  c.id,
  c.name        as club_name,
  c.status,
  c.instagram,
  s.id          as school_id,
  s.name        as school_name,
  s.state,
  s.domain,
  (select count(*) from public.profiles p
    where p.club_id = c.id and p.status = 'approved') as member_count,
  coalesce(
    (select array_agg(l.name order by l.ordinal, l.name)
       from public.club_leads l where l.club_id = c.id),
    '{}'
  ) as leads
from public.clubs c
join public.schools s on s.id = c.school_id;

grant select on public.club_directory to authenticated;

-- ============================================================================
-- 6. Apostrophes
--
-- The division seed in 0009 wrote straight quotes ("Men's Open"); display copy
-- everywhere else uses curly. One convention, applied to the data that is
-- rendered as prose.
-- ============================================================================
update public.profiles
   set division = replace(division, '''', '’')
 where division like '%''%';

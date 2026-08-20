-- ============================================================================
-- Social handles, question votes, and the resource vault.
--
-- All three are text and foreign keys — no blobs, no storage bucket. A
-- resource is a URL to somebody else's host; the free tier stores the link,
-- not the video.
--
-- Guarded throughout so the file can be applied twice without erroring or
-- half-applying, the same as 0008 and 0009.
-- ============================================================================

-- ── 1. social handles ───────────────────────────────────────────────────────
-- Handles, not URLs: storing "https://instagram.com/…" invites a link to
-- anywhere, and the app builds the href itself so a profile can never point
-- members at an arbitrary site. The check constraint is what enforces that —
-- letters, digits, dot and underscore are the whole alphabet both platforms
-- allow, and a leading @ is stripped by the form before it gets here.
alter table public.profiles
  add column if not exists instagram_handle text,
  add column if not exists tiktok_handle    text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_instagram_handle_shape'
  ) then
    alter table public.profiles
      add constraint profiles_instagram_handle_shape
      check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_tiktok_handle_shape'
  ) then
    alter table public.profiles
      add constraint profiles_tiktok_handle_shape
      check (tiktok_handle is null or tiktok_handle ~ '^[A-Za-z0-9._]{1,24}$');
  end if;
end $$;

-- The UPDATE policy a member edits their own row through already exists, from
-- 20260818000007:
--
--   profiles_update … using (id = auth.uid() or is_admin() or leads_school_of(id))
--
-- and `guard_profile_privileges()` lists the columns that stay out of a
-- member's hands (role, status, school, club, verified, credentials). The two
-- handles are deliberately not on that list: they are the member's own claim
-- about their own accounts, so no policy change is needed here.

-- ── 2. question votes ───────────────────────────────────────────────────────
-- The composite primary key is the double-vote guard: one row per member per
-- question, enforced by Postgres rather than by the button being disabled.
create table if not exists public.question_votes (
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id     uuid not null references public.profiles(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, user_id)
);

create index if not exists question_votes_question_idx on public.question_votes (question_id);

alter table public.question_votes enable row level security;

drop policy if exists question_votes_read   on public.question_votes;
drop policy if exists question_votes_insert on public.question_votes;
drop policy if exists question_votes_delete on public.question_votes;

-- Counts are public to the board, so the rows behind them are readable. There
-- is nothing here to anonymise: a vote says "this helped", which is not the
-- kind of thing the anonymous toggle exists to protect.
create policy question_votes_read on public.question_votes for select to authenticated
  using (public.is_approved());

-- `user_id = auth.uid()` in the CHECK is what stops voting on someone else's
-- behalf; the primary key stops voting twice on your own.
create policy question_votes_insert on public.question_votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());

create policy question_votes_delete on public.question_votes for delete to authenticated
  using (user_id = auth.uid());

-- ── the feed carries the count ──────────────────────────────────────────────
-- Counted in the view rather than kept as a column on `questions`: a stored
-- tally needs a trigger to stay honest, and at this size the subquery is
-- cheaper than the bug where the two disagree.
--
-- `voted_by_me` works because the view is SECURITY DEFINER and auth.uid() is
-- still the caller — it saves the board a second round trip per render.
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
  and (q.status = 'approved' or public.is_moderator());

grant select on public.question_feed to authenticated;

-- ── 3. the resource vault ───────────────────────────────────────────────────
-- `external_url` is the whole storage strategy: NCBO links to a video on
-- YouTube or a PDF on someone else's host and stores the address. Nothing
-- here is a file, so nothing here grows the database.
--
-- https only, and only the shapes we mean to render — a `javascript:` or
-- `data:` URL in an href is a script we would be executing on a member's
-- behalf, and the check is what makes that unrepresentable rather than
-- something the form has to remember to catch.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'resource_type') then
    create type public.resource_type as enum ('youtube', 'pdf', 'article', 'spreadsheet', 'webinar');
  end if;
end $$;

create table if not exists public.resources (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(title) between 1 and 160),
  description  text check (description is null or length(description) <= 500),
  category     text not null default 'General',
  type         public.resource_type not null default 'article',
  external_url text not null check (external_url ~ '^https://[^\s]+$'),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists resources_category_idx on public.resources (category, created_at desc);

alter table public.resources enable row level security;

drop policy if exists resources_read  on public.resources;
drop policy if exists resources_write on public.resources;

create policy resources_read on public.resources for select to authenticated
  using (public.is_approved());

-- One policy for all three writes: the vault is a curated shelf, and the
-- curation is the point. `is_moderator()` is advisor + admin.
create policy resources_write on public.resources for all to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- ============================================================================
-- Demo data, so the vault and the vote counts are not empty on first look.
--
-- Idempotent by title: nothing is inserted twice, and an edited row is left
-- alone on a re-run.
-- ============================================================================
insert into public.resources (title, description, category, type, external_url)
select * from (values
  ('First Show Checklist',
   'What to have packed, tanned and rehearsed the week before you step on stage.',
   'Competing', 'article'::public.resource_type,
   'https://www.thencbo.org/faqs.html'),
  ('Posing Fundamentals — Mandatories',
   'The mandatory poses, walked through one at a time.',
   'Posing', 'youtube'::public.resource_type,
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  ('Dining Hall Macros',
   'Hitting your numbers on a meal plan you do not control.',
   'Nutrition', 'article'::public.resource_type,
   'https://www.thencbo.org/faqs.html'),
  ('Starting a Club — Advisor Packet',
   'The paperwork most schools ask for, and who signs it.',
   'Club Leads', 'pdf'::public.resource_type,
   'https://www.thencbo.org/start-a-club.html')
) as seed(title, description, category, type, external_url)
where not exists (
  select 1 from public.resources r where r.title = seed.title
);

-- A couple of votes, so "most helpful" has something to sort by. Each member
-- votes for the oldest question they did not write.
insert into public.question_votes (question_id, user_id)
select q.id, p.id
  from public.profiles p
  cross join lateral (
    select id from public.questions
     where author_id <> p.id and status = 'approved'
     order by created_at
     limit 1
  ) q
 where p.status = 'approved'
on conflict do nothing;

-- ── the directory carries the handles ───────────────────────────────────────
-- Appended to the projection rather than rebuilt: `create or replace view` can
-- add columns at the end, and the directory's existing shape is unchanged.
create or replace view public.member_directory
with (security_invoker = true) as
select
  p.id,
  p.display_name,
  p.role,
  p.division,
  p.home_region,
  p.verified,
  p.credentials,
  p.club_id,
  c.name   as club_name,
  p.school_id,
  s.name   as school_name,
  s.state  as school_state,
  p.instagram_handle,
  p.tiktok_handle
from public.profiles p
left join public.clubs c   on c.id = p.club_id
left join public.schools s on s.id = p.school_id
where p.status = 'approved';

grant select on public.member_directory to authenticated;

-- A handle or two on the demo profiles, so the icon links have something to
-- render. Only where the member has not set their own.
update public.profiles
   set instagram_handle = 'ncbo.official'
 where role = 'admin' and instagram_handle is null;

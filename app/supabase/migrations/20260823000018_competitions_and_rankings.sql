-- ============================================================================
-- The competition calendar, results, and national rankings.
--
-- This is the only thing NCBO uniquely owns. Every other surface in the app
-- is a better or worse version of something a group chat already does; a
-- ranking across nine chapters is a thing no chapter can build for itself,
-- and it is the reason a stranger at Iowa opens the app on a day when nobody
-- else is online.
--
-- Four decisions, stated because a reader will otherwise assume they were
-- arbitrary:
--
--  1. **The calendar is open to any signed-in account.** It is the surface
--     most likely to bring somebody in, and gating it behind a membership
--     they do not have yet is exactly backwards. Registering for a show is
--     gated; looking at when shows are is not.
--
--  2. **Results are self-reported, then confirmed.** A member enters their
--     own placement and a club lead or the exec board confirms it. Waiting
--     for a central admin to transcribe every result means the rankings are
--     always a month stale, and stale rankings are worse than none: people
--     check once, see last season, and stop checking.
--
--  3. **An unconfirmed result scores nothing.** It shows on the member's own
--     profile as pending and is worth zero points until somebody confirms it.
--     That is what stops the leaderboard being a self-service exercise.
--
--  4. **A chapter's score is its best five, not its total.** Summing every
--     member would make the ranking a headcount, and Pitt would win it by
--     existing. Best-five means a chapter of nine that competes well beats a
--     chapter of ninety that does not, which is the thing worth measuring.
-- ============================================================================

-- ── federations ─────────────────────────────────────────────────────────────
-- Reference data, and real: these are the bodies that actually sanction the
-- shows collegiate lifters enter. A free-text field here would give us six
-- spellings of "OCB" and no way to group a season.
create table if not exists public.federations (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  drug_tested boolean,
  sort       int not null default 0
);

insert into public.federations (code, name, drug_tested, sort) values
  ('OCB',   'Organization of Competitive Bodybuilders', true,  1),
  ('WNBF',  'World Natural Bodybuilding Federation',    true,  2),
  ('INBF',  'International Natural Bodybuilding Federation', true, 3),
  ('NANBF', 'North American Natural Bodybuilding Federation', true, 4),
  ('NPC',   'National Physique Committee',              false, 5),
  ('IFBB',  'International Federation of Bodybuilding and Fitness', false, 6),
  ('OTHER', 'Another federation',                       null,  99)
on conflict (code) do update set name = excluded.name, sort = excluded.sort;

-- ── competitions ────────────────────────────────────────────────────────────
create table if not exists public.competitions (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(name) between 2 and 160),
  federation_id  uuid references public.federations(id) on delete set null,

  -- Local, regional, national. The multiplier in `placement_points()` reads
  -- this: placing at a national show is a different achievement from placing
  -- at a local one, and a ranking that pretends otherwise is not measuring
  -- anything.
  level          text not null default 'local'
                 check (level in ('local', 'regional', 'national')),

  starts_on      date not null,
  ends_on        date,
  city           text,
  state          text,
  info_url       text check (info_url is null or info_url ~ '^https://'),

  -- A show NCBO is organised around, as opposed to one members happen to
  -- enter. Both belong on the calendar; only one gets promoted on Home.
  ncbo_sanctioned boolean not null default false,

  notes          text check (notes is null or length(notes) <= 1000),
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),

  check (ends_on is null or ends_on >= starts_on)
);

create index if not exists competitions_date_idx on public.competitions (starts_on);
create index if not exists competitions_upcoming_idx on public.competitions (starts_on)
  where ncbo_sanctioned;

comment on table public.competitions is
  'The calendar. Readable by any signed-in account, on purpose: it is the surface most likely to bring somebody in.';

-- ── entries and results ─────────────────────────────────────────────────────
create table if not exists public.competition_entries (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,

  /* The chapter this result counts for, captured at entry time rather than
     read live. A member who graduates or transfers should not silently move
     last season's points to another chapter, and a member with no chapter
     still has a result worth recording — it just scores for nobody. */
  club_id        uuid references public.clubs(id) on delete set null,

  division       text check (division is null or length(division) <= 60),
  placement      int  check (placement is null or placement between 1 and 99),
  class_size     int  check (class_size is null or class_size between 1 and 200),
  is_overall     boolean not null default false,

  status         text not null default 'pending'
                 check (status in ('pending', 'confirmed', 'disputed')),
  confirmed_by   uuid references public.profiles(id) on delete set null,
  confirmed_at   timestamptz,

  notes          text check (notes is null or length(notes) <= 500),
  created_at     timestamptz not null default now(),

  unique (competition_id, user_id, division)
);

create index if not exists competition_entries_user_idx on public.competition_entries (user_id);
create index if not exists competition_entries_comp_idx on public.competition_entries (competition_id, status);
create index if not exists competition_entries_club_idx on public.competition_entries (club_id, status)
  where status = 'confirmed';

comment on column public.competition_entries.club_id is
  'The chapter this result scores for, fixed at entry time. Reading it live would move last season''s points when somebody transfers or graduates.';

-- ── scoring ─────────────────────────────────────────────────────────────────
/*
 * Placement points.
 *
 * The curve is steep at the top and flat at the bottom on purpose: the gap
 * between first and second is a real gap, and the gap between eighth and
 * ninth is noise. Everybody who steps on stage scores something, because
 * stepping on stage at all is the thing the organisation is trying to
 * produce more of.
 *
 * Class size is a multiplier rather than a gate. Winning a class of three is
 * a win and scores like one; winning a class of twenty scores more. Capped so
 * one enormous class cannot decide a season.
 */
create or replace function public.placement_points(
  placement int,
  level text,
  class_size int default null,
  is_overall boolean default false
)
returns numeric
language sql immutable
as $$
  select round(
    -- `case placement when 1 ...` would send a NULL placement to the ELSE
    -- branch, scoring "competed, placement unrecorded" the same as seventh.
    -- A CASE never matches NULL, so the null test has to come first and be
    -- explicit; coalesce around the outside cannot see it.
    case
      when placement is null then 20   -- competed, placement not recorded
      when placement = 1 then 100
      when placement = 2 then 85
      when placement = 3 then 72
      when placement = 4 then 61
      when placement = 5 then 52
      when placement = 6 then 44
      else 30
    end
    * case level when 'national' then 1.6 when 'regional' then 1.25 else 1.0 end
    -- An unknown class size is worth no bonus and no penalty, so it must
    -- multiply by exactly 1. A class of 40 or more caps out at 1.5.
    * least(1 + coalesce(class_size, 0) / 40.0, 1.5)
    -- An overall title is the whole show, not one class.
    * case when is_overall then 1.35 else 1.0 end
  , 1)
$$;

comment on function public.placement_points(int, text, int, boolean) is
  'The whole scoring model, in one place, so a change to it is one diff and one review.';

/* A season is the calendar year of the show. Simple, and it matches how
   people already talk about it ("my 2026 season"). */
create or replace function public.competition_season(d date)
returns int
language sql immutable
as $$ select extract(year from d)::int $$;

-- ── the scored results view ─────────────────────────────────────────────────
-- One row per confirmed result, with its points. Everything below reads this,
-- so the definition of "counts" lives in exactly one place.
create or replace view public.scored_results
with (security_invoker = true) as
select
  e.id,
  e.user_id,
  e.club_id,
  e.competition_id,
  c.name as competition_name,
  c.level,
  c.starts_on,
  public.competition_season(c.starts_on) as season,
  f.code as federation,
  e.division,
  e.placement,
  e.class_size,
  e.is_overall,
  public.placement_points(e.placement, c.level, e.class_size, e.is_overall) as points
from public.competition_entries e
join public.competitions c on c.id = e.competition_id
left join public.federations f on f.id = c.federation_id
where e.status = 'confirmed';

grant select on public.scored_results to authenticated;

-- ── national rankings ───────────────────────────────────────────────────────
-- Individuals, across every chapter. The join to `active_memberships` is what
-- keeps 2.5 true here: somebody's chapter on a leaderboard comes from a
-- membership, so an org-role holder appears unaffiliated rather than under a
-- club they are not a member of.
create or replace view public.national_rankings
with (security_invoker = true) as
select
  r.season,
  r.user_id,
  p.display_name,
  am.club_id,
  cl.name as club_name,
  coalesce(u.short_name, u.name) as chapter,
  count(*)::int      as shows,
  sum(r.points)      as points,
  min(r.placement) filter (where r.placement is not null) as best_placement,
  rank() over (partition by r.season order by sum(r.points) desc) as rank
from public.scored_results r
join public.profiles p on p.id = r.user_id
left join public.active_memberships am on am.user_id = r.user_id
left join public.clubs cl on cl.id = am.club_id
left join public.universities u on u.id = am.university_id
where p.status = 'approved' and p.deleted_at is null
group by r.season, r.user_id, p.display_name, am.club_id, cl.name, u.short_name, u.name;

grant select on public.national_rankings to authenticated;

-- ── chapter rankings ────────────────────────────────────────────────────────
/*
 * Best five, not the total. A chapter of ninety would otherwise win by
 * existing, which measures recruitment and calls it competitiveness.
 *
 * `club_id` comes off the entry, not off the member's current membership, so
 * a graduating senior's results stay with the chapter they competed for.
 */
create or replace view public.chapter_rankings
with (security_invoker = true) as
with per_member as (
  select r.season, r.club_id, r.user_id, sum(r.points) as member_points,
         count(*)::int as member_shows
    from public.scored_results r
   where r.club_id is not null
   group by r.season, r.club_id, r.user_id
),
ranked as (
  select *, row_number() over (partition by season, club_id order by member_points desc) as seat
    from per_member
)
select
  ranked.season,
  ranked.club_id,
  c.name as club_name,
  coalesce(u.short_name, u.name) as chapter,
  count(*) filter (where seat <= 5)::int as scoring_members,
  count(*)::int                          as competing_members,
  sum(member_shows)::int                 as shows,
  sum(member_points) filter (where seat <= 5) as points,
  rank() over (
    partition by ranked.season
    order by sum(member_points) filter (where seat <= 5) desc
  ) as rank
from ranked
join public.clubs c on c.id = ranked.club_id
join public.universities u on u.id = c.university_id
group by ranked.season, ranked.club_id, c.name, u.short_name, u.name;

grant select on public.chapter_rankings to authenticated;

-- ============================================================================
-- Row-level security
-- ============================================================================
alter table public.federations         enable row level security;
alter table public.competitions        enable row level security;
alter table public.competition_entries enable row level security;

drop policy if exists federations_read  on public.federations;
drop policy if exists federations_write on public.federations;

create policy federations_read on public.federations for select to authenticated using (true);
create policy federations_write on public.federations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists competitions_read   on public.competitions;
drop policy if exists competitions_write  on public.competitions;
drop policy if exists competitions_delete on public.competitions;

/* Open to any signed-in account, membership or not. See decision 1 in the
   header: this is the surface that brings people in. */
create policy competitions_read on public.competitions for select to authenticated
  using (public.is_approved());

/* Who may put a show on the calendar: admins, the exec board, and club leads.
   A lead adding the local show their members are entering is the common case
   and should not need a ticket to an admin. */
create policy competitions_write on public.competitions for insert to authenticated
  with check (
    public.is_admin()
    or public.has_org_role('exec_board')
    or public.is_club_lead()
  );

create policy competitions_update on public.competitions for update to authenticated
  using (public.is_admin() or public.has_org_role('exec_board') or created_by = auth.uid())
  with check (public.is_admin() or public.has_org_role('exec_board') or created_by = auth.uid());

create policy competitions_delete on public.competitions for delete to authenticated
  using (public.is_admin());

drop policy if exists competition_entries_read   on public.competition_entries;
drop policy if exists competition_entries_insert on public.competition_entries;
drop policy if exists competition_entries_update on public.competition_entries;
drop policy if exists competition_entries_delete on public.competition_entries;

/* Confirmed results are public within the organisation — they are what the
   rankings are made of. A pending one is visible to its owner and to whoever
   can confirm it, so an unconfirmed claim never appears on a leaderboard or
   on somebody else's screen. */
create policy competition_entries_read on public.competition_entries for select to authenticated
  using (
    (status = 'confirmed' and public.is_approved())
    or user_id = auth.uid()
    or public.is_admin()
    or public.has_org_role('exec_board')
    or public.leads_club(club_id)
  );

create policy competition_entries_insert on public.competition_entries for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());

create policy competition_entries_update on public.competition_entries for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_org_role('exec_board')
    or public.leads_club(club_id)
  )
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_org_role('exec_board')
    or public.leads_club(club_id)
  );

create policy competition_entries_delete on public.competition_entries for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

grant select, insert, update, delete on public.competition_entries to authenticated;
grant select, insert, update on public.competitions to authenticated;
grant select on public.federations to authenticated;

-- ── the guard: you do not confirm your own result ───────────────────────────
create or replace function public.guard_competition_entry()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- The chapter is stamped from the entrant's own active membership, never
    -- from the request. Otherwise anyone could score for any chapter.
    new.club_id      := public.derived_club(new.user_id);
    new.status       := 'pending';
    new.confirmed_by := null;
    new.confirmed_at := null;
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'A result cannot be moved to another person.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Decision 3 in the header, enforced. Self-confirmation would make the
  -- leaderboard a self-service exercise.
  if new.status is distinct from old.status then
    if new.user_id = auth.uid() and not public.is_admin() then
      raise exception 'Somebody else confirms a result: your club lead or the exec board.'
        using errcode = 'insufficient_privilege';
    end if;

    if not (public.is_admin()
            or public.has_org_role('exec_board')
            or public.leads_club(old.club_id)) then
      raise exception 'Only a club lead or the exec board can confirm a result.'
        using errcode = 'insufficient_privilege';
    end if;

    new.confirmed_by := case when new.status = 'confirmed' then auth.uid() end;
    new.confirmed_at := case when new.status = 'confirmed' then now() end;
  end if;

  -- Once confirmed, the numbers are fixed: editing a placement after somebody
  -- vouched for it would make the confirmation meaningless.
  if old.status = 'confirmed'
     and new.status = 'confirmed'
     and (new.placement  is distinct from old.placement
       or new.division   is distinct from old.division
       or new.class_size is distinct from old.class_size
       or new.is_overall is distinct from old.is_overall)
     and not (public.is_admin() or public.has_org_role('exec_board')) then
    raise exception 'A confirmed result is fixed. Ask a lead to reopen it.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_competition_entry_trg on public.competition_entries;
create trigger guard_competition_entry_trg
  before insert or update on public.competition_entries
  for each row execute function public.guard_competition_entry();

-- Stamp the creator, so `competitions_update` has something to check.
create or replace function public.stamp_competition()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists stamp_competition_trg on public.competitions;
create trigger stamp_competition_trg
  before insert on public.competitions
  for each row execute function public.stamp_competition();

-- ── one member's competition history, for the profile popup ─────────────────
-- 2.3 lists competition history among what the popup shows. Confirmed results
-- only: a pending claim is not history yet.
create or replace function public.get_competition_history(target uuid)
returns table (
  competition_name text,
  starts_on date,
  level text,
  federation text,
  division text,
  placement int,
  is_overall boolean,
  points numeric
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_approved() then
    raise exception 'Sign in to view a profile.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select r.competition_name, r.starts_on, r.level, r.federation,
           r.division, r.placement, r.is_overall, r.points
      from public.scored_results r
     where r.user_id = target
     order by r.starts_on desc
     limit 20;
end;
$$;

revoke execute on function public.get_competition_history(uuid) from anon;
grant execute on function public.get_competition_history(uuid) to authenticated;

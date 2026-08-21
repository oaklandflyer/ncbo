-- ============================================================================
-- The dependents of the reshape, and answer-level voting.
--
-- 0022 changed the shape of a result. Everything that read the old shape is
-- rewritten here, and the columns the new shape supersedes are dropped rather
-- than left lying beside their replacements — two columns answering the same
-- question is how this schema produced its last two outages.
-- ============================================================================

-- ── 1. drop what read the old shape ─────────────────────────────────────────
-- Views must go before the columns they name. Rebuilt below against `placing`.
drop view if exists public.national_rankings;
drop view if exists public.chapter_rankings;
drop view if exists public.scored_results;
drop function if exists public.get_competition_history(uuid);
drop function if exists public.placement_points(int, text, int, boolean);

alter table public.competition_entries
  drop column if exists placement,
  drop column if exists class_size,
  drop column if exists is_overall;

-- ── 2. scoring, restated ────────────────────────────────────────────────────
-- 1st = 10 down to 5th = 2, an overall title adds 5, and DNP scores nothing.
--
-- This replaces the curve 0018 used (100/85/72…, scaled by show level and class
-- size). That model tried to weigh how hard a placing was to get; this one
-- weighs only the placing. The trade is deliberate: the old numbers could not
-- be explained to a member in one sentence, and a leaderboard nobody can do the
-- arithmetic for is one nobody trusts.
--
-- DNP scoring zero is the one part worth arguing with. Stepping on stage is the
-- thing the organisation wants more of, and this model does not reward it
-- directly — the Chapter Cup does instead, where every approved entry is worth
-- 5 stage points to the club whatever the placing.
create or replace function public.entry_points(p_placing text, p_won_overall boolean default false)
returns int
language sql immutable
as $$
  select case p_placing
           when '1st' then 10
           when '2nd' then 8
           when '3rd' then 6
           when '4th' then 4
           when '5th' then 2
           else 0
         end
       + case when p_won_overall then 5 else 0 end
$$;

comment on function public.entry_points(text, boolean) is
  'The whole individual scoring model. One function, so changing it is one diff and one review.';

-- ── 3. the guard, rewritten for the new columns ─────────────────────────────
create or replace function public.guard_competition_entry()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    /* The chapter is stamped from the athlete's own active membership, never
       from the request, or anyone could score for any club. */
    new.club_id          := public.derived_club(new.profile_id);
    new.status           := 'pending';
    new.rejection_reason := null;
    new.confirmed_by     := null;
    new.confirmed_at     := null;
    return new;
  end if;

  if new.profile_id is distinct from old.profile_id then
    raise exception 'A result cannot be moved to another person.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    -- Nobody verifies their own result. Without this the leaderboard is
    -- self-service and means nothing.
    if new.profile_id = auth.uid() and not public.is_admin() then
      raise exception 'Somebody else verifies a result: your club lead or an admin.'
        using errcode = 'insufficient_privilege';
    end if;

    if not (public.is_admin() or public.leads_club(old.club_id)) then
      raise exception 'Only a club lead or an admin can verify a result.'
        using errcode = 'insufficient_privilege';
    end if;

    new.confirmed_by := case when new.status = 'approved' then auth.uid() end;
    new.confirmed_at := case when new.status = 'approved' then now() end;
  end if;

  -- Once approved the numbers are fixed: editing a placing after somebody
  -- vouched for it would make the verification meaningless.
  if old.status = 'approved' and new.status = 'approved'
     and (new.placing     is distinct from old.placing
       or new.division    is distinct from old.division
       or new.show_name   is distinct from old.show_name
       or new.won_overall is distinct from old.won_overall)
     and not public.is_admin() then
    raise exception 'An approved result is fixed. Ask a lead to reopen it.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ── 4. row-level security, per the spec ─────────────────────────────────────
drop policy if exists competition_entries_read   on public.competition_entries;
drop policy if exists competition_entries_insert on public.competition_entries;
drop policy if exists competition_entries_update on public.competition_entries;
drop policy if exists competition_entries_delete on public.competition_entries;

/* Approved results are what the leaderboards are made of, so any live account
   reads them. A pending or returned one is visible to the athlete and to
   whoever can decide it, and to nobody else: who logged a result and had it
   turned down is between them and their lead. */
create policy competition_entries_read on public.competition_entries for select to authenticated
  using (
    (status = 'approved' and public.is_approved())
    or profile_id = auth.uid()
    or public.is_admin()
    or public.leads_club(club_id)
  );

create policy competition_entries_insert on public.competition_entries for insert to authenticated
  with check (profile_id = auth.uid() and public.is_approved());

create policy competition_entries_update on public.competition_entries for update to authenticated
  using (profile_id = auth.uid() or public.is_admin() or public.leads_club(club_id))
  with check (profile_id = auth.uid() or public.is_admin() or public.leads_club(club_id));

create policy competition_entries_delete on public.competition_entries for delete to authenticated
  using (profile_id = auth.uid() and status = 'pending');

-- ── 5. answer votes ─────────────────────────────────────────────────────────
-- `question_votes` marks a question as worth asking. The Chapter Cup wants the
-- other thing: who answered well. Those are different acts by different people
-- and one table cannot hold both, so this is its own.
create table if not exists public.answer_votes (
  answer_id  uuid not null references public.answers(id)  on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);

create index if not exists answer_votes_answer_idx on public.answer_votes (answer_id);

comment on table public.answer_votes is
  'One upvote per member per answer. The primary key is the "one vote" rule; the insert policy is the "not your own" rule.';

alter table public.answer_votes enable row level security;

drop policy if exists answer_votes_read   on public.answer_votes;
drop policy if exists answer_votes_insert on public.answer_votes;
drop policy if exists answer_votes_delete on public.answer_votes;

create policy answer_votes_read on public.answer_votes for select to authenticated
  using (public.is_approved());

/* No self-votes, and only on an answer that survived moderation. Both are in
   the policy rather than the UI because both are worth points. */
create policy answer_votes_insert on public.answer_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_approved()
    and exists (
      select 1 from public.answers a
       join public.questions q on q.id = a.question_id
      where a.id = answer_id
        and a.author_id <> auth.uid()
        and a.deleted_at is null
        and q.status = 'approved'
    )
  );

create policy answer_votes_delete on public.answer_votes for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.answer_votes to authenticated;

-- ── 6. the read surfaces, rebuilt ───────────────────────────────────────────
create or replace view public.scored_results
with (security_invoker = true) as
select
  e.id,
  e.profile_id,
  e.club_id,
  e.competition_id,
  e.show_name,
  e.federation,
  e.date,
  extract(year from e.date)::int as season,
  e.division,
  e.class,
  e."placing",
  e.won_overall,
  public.entry_points(e."placing", e.won_overall) as points
from public.competition_entries e
where e.status = 'approved';

grant select on public.scored_results to authenticated;

/* One athlete's history, for the profile popup. Approved only: a pending claim
   is not history yet. */
create or replace function public.get_competition_history(target uuid)
returns table (
  show_name text, date date, federation text, division text,
  "class" text, "placing" text, won_overall boolean, points int
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_approved() then
    raise exception 'Sign in to view a profile.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select r.show_name, r.date, r.federation, r.division,
           r."class", r."placing", r.won_overall, r.points
      from public.scored_results r
     where r.profile_id = target
     order by r.date desc
     limit 20;
end;
$$;

revoke execute on function public.get_competition_history(uuid) from anon;
grant execute on function public.get_competition_history(uuid) to authenticated;

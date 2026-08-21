-- ============================================================================
-- Competition entries, reshaped: the show lives on the entry.
--
-- 0018 modelled a result as a row pointing at a `competitions` record, which
-- is the normalised answer and the wrong one for how this is actually used. A
-- member logging a result has a show name, a federation and a date in front of
-- them; requiring that show to exist on the calendar first turns "log my
-- result" into "ask a lead to add my show, wait, then log my result", and the
-- result never gets logged.
--
-- So the show is denormalised onto the entry. `competition_id` survives as a
-- nullable link, so a result entered against a show that IS on the calendar
-- still joins to it and the calendar keeps working; a result entered against
-- one that is not simply carries its own name.
--
-- The rest of this migration is the vocabulary catching up:
--
--   user_id   → profile_id   (what every other table in this schema calls it)
--   placement → placing      (int → '1st'…'5th'/'DNP', because 'DNP' is a real
--                             outcome that an integer cannot express, and
--                             every federation prints placings this way)
--   confirmed → approved     (matching the entry queue's own language)
--   disputed  → returned     (and returning one now has to say why)
--
-- Nothing is dropped without being carried across first.
-- ============================================================================

-- ── 1. the new columns ──────────────────────────────────────────────────────
alter table public.competition_entries
  add column if not exists show_name        text,
  add column if not exists federation       text,
  add column if not exists date             date,
  add column if not exists "class"          text,
  /* `placing` is a reserved word in PostgreSQL — it is part of the
     `overlay(string placing string from int)` syntax — so every bare use of it
     has to be quoted. Qualified uses (`e.placing`) are fine unquoted, which is
     why this is easy to miss until a migration will not parse. */
  add column if not exists "placing"        text,
  add column if not exists won_overall      boolean not null default false,
  add column if not exists rejection_reason text,
  add column if not exists share_token      uuid not null default gen_random_uuid();

create unique index if not exists competition_entries_share_token_key
  on public.competition_entries (share_token);

comment on column public.competition_entries.share_token is
  'Opaque public handle for the share card. Not the row id: a share link is given to strangers, and an id is a key to everything else keyed by id.';
comment on column public.competition_entries.rejection_reason is
  'Why a lead sent this back, shown to the athlete on /entries/[id]. Required: "no" without a reason is a support ticket waiting to happen.';

-- ── 2. profile_id ───────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'competition_entries'
                and column_name = 'user_id') then
    alter table public.competition_entries rename column user_id to profile_id;
  end if;
end $$;

-- ── 3. carry the old shape across ───────────────────────────────────────────
-- Show details come off the linked competition. Anything already entered keeps
-- its meaning; nothing is invented for rows that never had it.
update public.competition_entries e
   set show_name  = coalesce(e.show_name, c.name),
       date       = coalesce(e.date, c.starts_on),
       federation = coalesce(e.federation, f.code)
  from public.competitions c
  left join public.federations f on f.id = c.federation_id
 where c.id = e.competition_id
   and (e.show_name is null or e.date is null or e.federation is null);

update public.competition_entries
   set "placing" = case
         when "placing" is not null then "placing"
         when placement = 1 then '1st'
         when placement = 2 then '2nd'
         when placement = 3 then '3rd'
         when placement = 4 then '4th'
         when placement = 5 then '5th'
         when placement is null then 'DNP'
         else 'DNP'
       end
 where "placing" is null;

update public.competition_entries
   set won_overall = is_overall
 where won_overall is distinct from is_overall;

-- `confirmed` and `disputed` were the same two decisions under other names.
alter table public.competition_entries drop constraint if exists competition_entries_status_check;
update public.competition_entries set status = 'approved' where status = 'confirmed';
update public.competition_entries set status = 'returned' where status = 'disputed';

-- ── 4. the constraints the new shape needs ──────────────────────────────────
-- Applied after the backfill, so existing rows are already legal by the time
-- they are checked. A NOT NULL added before its backfill fails on row one.
update public.competition_entries set show_name  = 'Unnamed show' where show_name is null;
update public.competition_entries set federation = 'OTHER'        where federation is null;
update public.competition_entries set date       = current_date   where date is null;
update public.competition_entries set division   = 'Unspecified'  where division is null;

alter table public.competition_entries
  alter column show_name  set not null,
  alter column federation set not null,
  alter column date       set not null,
  alter column division   set not null,
  alter column "placing"  set not null;

alter table public.competition_entries
  add constraint competition_entries_status_check
  check (status in ('pending', 'approved', 'returned'));

alter table public.competition_entries
  add constraint competition_entries_placing_check
  check ("placing" in ('1st', '2nd', '3rd', '4th', '5th', 'DNP'));

/* A rejection that does not say why is not a decision, it is a shrug. The
   check is here rather than in the action so it holds for every path in. */
alter table public.competition_entries
  add constraint competition_entries_rejection_reason_check
  check (status <> 'returned' or coalesce(btrim(rejection_reason), '') <> '');

-- The old key was (competition_id, user_id, division), which cannot hold once
-- competition_id is optional. One result per person per show per division,
-- matched on the show's name and date instead.
alter table public.competition_entries
  drop constraint if exists competition_entries_competition_id_user_id_division_key;

create unique index if not exists competition_entries_one_per_show
  on public.competition_entries (profile_id, lower(show_name), date, coalesce(division, ''));

-- `competition_id` becomes the optional link it now is.
alter table public.competition_entries alter column competition_id drop not null;

-- ── 5. handlers and pit crew ────────────────────────────────────────────────
-- Nobody preps alone, and the people backstage carry real load on show day.
-- Recording them is the point of `handler_points` in the Chapter Cup: it is
-- the one part of a leaderboard that rewards turning up for somebody else.
create table if not exists public.competition_handlers (
  entry_id            uuid not null references public.competition_entries(id) on delete cascade,
  handler_profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (entry_id, handler_profile_id)
);

create index if not exists competition_handlers_profile_idx
  on public.competition_handlers (handler_profile_id);

comment on table public.competition_handlers is
  'Who handled or crewed for an athlete at a show. Scored only when the entry itself is approved, so tagging cannot manufacture points.';

alter table public.competition_handlers enable row level security;

drop policy if exists competition_handlers_read   on public.competition_handlers;
drop policy if exists competition_handlers_insert on public.competition_handlers;
drop policy if exists competition_handlers_delete on public.competition_handlers;

create policy competition_handlers_read on public.competition_handlers for select to authenticated
  using (public.is_approved());

/* The athlete tags their own crew, at submission. Deliberately not "anyone can
   tag anyone": a handler row is worth points to the handler's club, so letting
   a third party write them would make the Chapter Cup self-serve. */
create policy competition_handlers_insert on public.competition_handlers for insert to authenticated
  with check (
    exists (select 1 from public.competition_entries e
             where e.id = entry_id and e.profile_id = auth.uid())
    or public.is_admin()
  );

create policy competition_handlers_delete on public.competition_handlers for delete to authenticated
  using (
    exists (select 1 from public.competition_entries e
             where e.id = entry_id and e.profile_id = auth.uid() and e.status = 'pending')
    or public.is_admin()
  );

grant select, insert, delete on public.competition_handlers to authenticated;

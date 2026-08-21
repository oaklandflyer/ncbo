-- ============================================================================
-- Making a hard delete survivable for everything that is not the person.
--
-- Today `auth.users` cascades to `profiles`, and `profiles` cascades to
-- thirteen more tables. Deleting one athlete therefore deletes their verified
-- competition results, and the Chapter Cup is scored from those results, so a
-- chapter silently loses points it earned months ago because somebody left.
-- That is the wrong trade: the person has a right to leave, and the chapter
-- has not done anything wrong.
--
-- So content that others depend on switches to ON DELETE SET NULL and keeps a
-- snapshot of the author's name, taken BEFORE the FK changes so nothing is
-- lost in the gap. Content that is only meaningful as an act by that person
-- (a membership, a vote, an org role) stays CASCADE, because an anonymous vote
-- is not a record, it is a number nobody can audit.
--
--   CASCADE, unchanged   club_memberships, answer_votes, question_votes,
--                        org_roles, school_email_codes, signup_interest,
--                        membership_vouches, posts
--   SET NULL, new        answers, questions, competition_entries,
--                        competition_handlers
--
-- Prompt named `qa_answers`; the table is `answers`. `questions` is not on the
-- prompt's list and is here anyway: a question whose author is deleted takes
-- its whole answer thread with it, which loses other people's work.
-- ============================================================================

-- ── snapshots, taken before anything can cascade ────────────────────────────
alter table public.answers
  add column if not exists author_display text;
alter table public.questions
  add column if not exists author_display text;
alter table public.competition_entries
  add column if not exists athlete_display text;
alter table public.competition_handlers
  add column if not exists handler_display text,
  /* The handler's club, snapshotted for the same reason the name is. Handler
     points are scored against the handler's OWN club through their membership,
     and a membership is CASCADE, so without this the club loses the points the
     moment the handler's account goes. */
  add column if not exists handler_club_id uuid references public.clubs(id) on delete set null;

comment on column public.answers.author_display is
  'The author name as it stood, so an answer still reads as somebody''s work after the account is gone. Written on insert; never updated to follow a rename, because it is a record of who wrote it.';
comment on column public.competition_entries.athlete_display is
  'The athlete name as it stood. A verified result is the chapter''s record as much as the athlete''s, and it has to survive them leaving.';
comment on column public.competition_handlers.handler_club_id is
  'The handler''s club at the time they crewed. Handler points are scored through a membership, and memberships cascade on delete, so the Chapter Cup reads this instead.';

/*
 * DRY RUN. What the backfill will touch:
 *
 *   -- select
 *   --   (select count(*) from public.answers              where author_display  is null) as answers,
 *   --   (select count(*) from public.questions            where author_display  is null) as questions,
 *   --   (select count(*) from public.competition_entries  where athlete_display is null) as entries,
 *   --   (select count(*) from public.competition_handlers where handler_display is null) as handlers;
 *
 *   -- rows that will stay null because the author is ALREADY gone. These are
 *   -- unrecoverable and worth knowing about before, not after:
 *   -- select 'answers' as t, count(*) from public.answers a
 *   --   left join public.profiles p on p.id = a.author_id where p.id is null
 *   -- union all select 'entries', count(*) from public.competition_entries e
 *   --   left join public.profiles p on p.id = e.profile_id where p.id is null;
 */
update public.answers a
   set author_display = p.display_name
  from public.profiles p
 where p.id = a.author_id and a.author_display is null;

update public.questions q
   set author_display = p.display_name
  from public.profiles p
 where p.id = q.author_id and q.author_display is null;

update public.competition_entries e
   set athlete_display = p.display_name
  from public.profiles p
 where p.id = e.profile_id and e.athlete_display is null;

update public.competition_handlers h
   set handler_display = p.display_name
  from public.profiles p
 where p.id = h.handler_profile_id and h.handler_display is null;

update public.competition_handlers h
   set handler_club_id = am.club_id
  from public.active_memberships am
 where am.user_id = h.handler_profile_id and h.handler_club_id is null;

-- ── the handler table needs a key that is not the handler ───────────────────
/*
 * `competition_handlers` was keyed on (entry_id, handler_profile_id), so the
 * handler column cannot be nulled: `column "handler_profile_id" is in a
 * primary key`. ON DELETE SET NULL is simply impossible against that shape,
 * which is the kind of thing you find out by running the migration rather
 * than by reading the FK list.
 *
 * A surrogate key, and the old pair becomes a unique index. Nulls do not
 * collide in a unique index, which is the behaviour wanted here: two handlers
 * on one entry who have both since deleted their accounts are two rows, and
 * the chapter keeps both sets of points.
 */
alter table public.competition_handlers
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.competition_handlers drop constraint if exists competition_handlers_pkey;
alter table public.competition_handlers add primary key (id);

create unique index if not exists competition_handlers_entry_handler_key
  on public.competition_handlers (entry_id, handler_profile_id);

-- ── the columns have to be nullable before the FK can null them ─────────────
alter table public.answers              alter column author_id          drop not null;
alter table public.questions            alter column author_id          drop not null;
alter table public.competition_entries  alter column profile_id         drop not null;
alter table public.competition_handlers alter column handler_profile_id drop not null;

-- ── the foreign keys ────────────────────────────────────────────────────────
alter table public.answers drop constraint if exists answers_author_id_fkey;
alter table public.answers
  add constraint answers_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;

alter table public.questions drop constraint if exists questions_author_id_fkey;
alter table public.questions
  add constraint questions_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;

alter table public.competition_entries drop constraint if exists competition_entries_user_id_fkey;
alter table public.competition_entries drop constraint if exists competition_entries_profile_id_fkey;
alter table public.competition_entries
  add constraint competition_entries_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

alter table public.competition_handlers drop constraint if exists competition_handlers_handler_profile_id_fkey;
alter table public.competition_handlers
  add constraint competition_handlers_handler_profile_id_fkey
  foreign key (handler_profile_id) references public.profiles(id) on delete set null;

-- ── keep the snapshot filled from here on ───────────────────────────────────
/* On insert only. A snapshot that follows a rename is not a snapshot, and the
   whole point is that it still reads correctly when the row it named is gone. */
create or replace function public.stamp_author_display()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'answers' or tg_table_name = 'questions' then
    if new.author_display is null and new.author_id is not null then
      select p.display_name into new.author_display
        from public.profiles p where p.id = new.author_id;
    end if;
  elsif tg_table_name = 'competition_entries' then
    if new.athlete_display is null and new.profile_id is not null then
      select p.display_name into new.athlete_display
        from public.profiles p where p.id = new.profile_id;
    end if;
  elsif tg_table_name = 'competition_handlers' then
    if new.handler_display is null and new.handler_profile_id is not null then
      select p.display_name into new.handler_display
        from public.profiles p where p.id = new.handler_profile_id;
    end if;
    if new.handler_club_id is null and new.handler_profile_id is not null then
      select am.club_id into new.handler_club_id
        from public.active_memberships am where am.user_id = new.handler_profile_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_author_display_trg on public.answers;
create trigger stamp_author_display_trg before insert on public.answers
  for each row execute function public.stamp_author_display();

drop trigger if exists stamp_author_display_trg on public.questions;
create trigger stamp_author_display_trg before insert on public.questions
  for each row execute function public.stamp_author_display();

drop trigger if exists stamp_author_display_trg on public.competition_entries;
create trigger stamp_author_display_trg before insert on public.competition_entries
  for each row execute function public.stamp_author_display();

drop trigger if exists stamp_author_display_trg on public.competition_handlers;
create trigger stamp_author_display_trg before insert on public.competition_handlers
  for each row execute function public.stamp_author_display();

-- ── the Chapter Cup reads the snapshot, or none of the above worked ─────────
/*
 * This is the half that actually protects the points, and it is easy to miss.
 *
 * The handler component scored through a live membership:
 *
 *   join public.active_memberships am on am.user_id = h.handler_profile_id
 *
 * Memberships are CASCADE and stay CASCADE, so the moment a handler's account
 * goes, that join finds nothing and the club silently loses 2 points per
 * result they crewed. Changing the FK to SET NULL keeps the ROW and loses the
 * POINTS, which is a worse failure than before: the evidence is still on
 * screen and the score is wrong.
 *
 * So it scores against `handler_club_id`, the snapshot, falling back to the
 * live membership for rows written before this migration existed.
 *
 * The stage component already scored off `e.club_id`, which is on the entry
 * itself, so it needed nothing.
 */
drop function if exists public.get_chapter_cup_standings();
create function public.get_chapter_cup_standings()
returns table (
  club_id        uuid,
  club_name      text,
  chapter        text,
  club_logo      text,
  roster_points  int,
  stage_points   int,
  handler_points int,
  qa_points      int,
  qa_uncapped    int,
  total_points   int,
  rank           int
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_approved() then
    raise exception 'Sign in to see the standings.' using errcode = 'insufficient_privilege';
  end if;

  return query
  with roster as (
    select m.club_id, count(*)::int * 1 as pts
      from public.club_memberships m
     where m.status = 'active'
     group by m.club_id
  ),
  stage as (
    select e.club_id, count(*)::int * 5 as pts
      from public.competition_entries e
     where e.status = 'approved' and e.club_id is not null
     group by e.club_id
  ),
  handler as (
    /* `handler_club_id` first, the live membership second. A deleted handler
       has no membership, and that is exactly the case this coalesce exists
       for: the chapter keeps the points somebody earned for it. */
    select coalesce(h.handler_club_id, am.club_id) as club_id, count(*)::int * 2 as pts
      from public.competition_handlers h
      join public.competition_entries e on e.id = h.entry_id and e.status = 'approved'
      left join public.active_memberships am on am.user_id = h.handler_profile_id
     where coalesce(h.handler_club_id, am.club_id) is not null
     group by coalesce(h.handler_club_id, am.club_id)
  ),
  qa as (
    /* Q&A still scores through a live membership, and that is deliberate:
       these are points for being an active, answering member, and a deleted
       account is not one. The answer itself survives under its snapshot name;
       the points it earns for a chapter do not. */
    select am.club_id, count(*)::int * 1 as pts
      from public.answer_votes v
      join public.answers a   on a.id = v.answer_id and a.deleted_at is null
      join public.questions q on q.id = a.question_id and q.status = 'approved'
      join public.active_memberships am on am.user_id = a.author_id
     group by am.club_id
  ),
  combined as (
    select c.id,
           c.name,
           coalesce(u.short_name, u.name) as chapter,
           c.logo_url                     as logo,
           coalesce(roster.pts, 0)  as roster_pts,
           coalesce(stage.pts, 0)   as stage_pts,
           coalesce(handler.pts, 0) as handler_pts,
           coalesce(qa.pts, 0)      as qa_raw
      from public.clubs c
      join public.universities u on u.id = c.university_id
      left join roster  on roster.club_id  = c.id
      left join stage   on stage.club_id   = c.id
      left join handler on handler.club_id = c.id
      left join qa      on qa.club_id      = c.id
  ),
  capped as (
    select combined.*,
           /* qa may be at most a quarter of the final total. Solving
                qa <= 0.25 × (base + qa)
              for qa gives qa <= base / 3. */
           least(qa_raw, floor((roster_pts + stage_pts + handler_pts) / 3.0)::int) as qa_pts
      from combined
  )
  select capped.id,
         capped.name,
         capped.chapter,
         capped.logo,
         capped.roster_pts,
         capped.stage_pts,
         capped.handler_pts,
         capped.qa_pts,
         capped.qa_raw,
         (capped.roster_pts + capped.stage_pts + capped.handler_pts + capped.qa_pts)::int,
         rank() over (
           order by (capped.roster_pts + capped.stage_pts + capped.handler_pts + capped.qa_pts) desc,
                    capped.stage_pts desc
         )::int
    from capped
   order by rank() over (
     order by (capped.roster_pts + capped.stage_pts + capped.handler_pts + capped.qa_pts) desc,
              capped.stage_pts desc
   );
end;
$$;

revoke execute on function public.get_chapter_cup_standings() from anon;
grant execute on function public.get_chapter_cup_standings() to authenticated;

-- ── the athlete board and the share card tolerate a missing athlete ─────────
/* `get_athlete_rankings` joins profiles on `t.profile_id`, so a deleted
   athlete drops out of the athlete board entirely. That is correct: an
   individual leaderboard is a list of people, and they are not one any more.
   Their CLUB's points are unaffected, because the stage component scores off
   `e.club_id`.

   `get_share_card` is the one that would break visibly: an already-shared
   link would 404 once its athlete was gone. It reads the snapshot instead. */
drop function if exists public.get_share_card(uuid);
create function public.get_share_card(token uuid)
returns table (
  athlete_name    text,
  club_name       text,
  chapter         text,
  club_logo       text,
  logo_updated_at timestamptz,
  show_name       text,
  federation      text,
  date            date,
  division        text,
  class           text,
  "placing"       text,
  won_overall     boolean,
  status          text
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  return query
    select coalesce(p.display_name, e.athlete_display, 'NCBO athlete'),
           c.name,
           coalesce(u.short_name, u.name),
           c.logo_url,
           c.logo_updated_at,
           e.show_name,
           e.federation,
           e.date,
           e.division,
           e."class",
           e."placing",
           e.won_overall,
           e.status
      from public.competition_entries e
      /* LEFT, not INNER. The athlete may be gone; the result is still the
         chapter's record and the link is still in somebody's story. */
      left join public.profiles p on p.id = e.profile_id
      left join public.clubs c        on c.id = e.club_id
      left join public.universities u on u.id = c.university_id
     where e.share_token = token
       and e.status <> 'returned'
       and (p.id is null or p.deleted_at is null);
end;
$$;

grant execute on function public.get_share_card(uuid) to anon, authenticated;

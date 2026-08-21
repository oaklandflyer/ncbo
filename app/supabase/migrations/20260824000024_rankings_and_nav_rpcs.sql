-- ============================================================================
-- The four RPCs the app reads: nav counts, two leaderboards, one share card.
--
-- All SECURITY DEFINER, all doing their own authorisation in their first
-- statement. That is the pattern this schema has used since 0001, and the
-- reason is the same every time: a policy expression that reads a table is
-- itself filtered by that table's policies, so anything needing to see across
-- the RLS boundary has to step outside it deliberately and say who may.
-- ============================================================================

-- ── 1. nav badge counts ─────────────────────────────────────────────────────
-- One round trip for the whole navigation, rather than one per badge. The nav
-- renders on every page, so three separate counts would be three queries on
-- every request for a number that is usually zero.
create or replace function public.get_viewer_nav_counts()
returns table (
  pending_entries       int,
  pending_questions     int,
  all_pending_questions int
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  led uuid[] := public.my_led_clubs();
begin
  if auth.uid() is null or not public.is_approved() then
    return query select 0, 0, 0;
    return;
  end if;

  return query
  select
    /* Entries waiting on THIS viewer: the clubs they lead, or every club if
       they are an admin. A lead with no clubs gets zero, not everything. */
    (select count(*)::int from public.competition_entries e
      where e.status = 'pending'
        and (public.is_admin() or e.club_id = any (led)))::int,

    /* Questions this viewer can moderate. Same number as the one below for a
       moderator; kept separate because the nav needs to distinguish "your
       queue" from "the queue" when deciding which group to draw. */
    (case when public.is_moderator()
          then (select count(*)::int from public.questions q where q.status = 'pending')
          else 0 end)::int,

    (select count(*)::int from public.questions q where q.status = 'pending')::int;
end;
$$;

revoke execute on function public.get_viewer_nav_counts() from anon;
grant execute on function public.get_viewer_nav_counts() to authenticated;

-- ── 2. athlete rankings ─────────────────────────────────────────────────────
create or replace function public.get_athlete_rankings()
returns table (
  profile_id   uuid,
  display_name text,
  club_id      uuid,
  club_name    text,
  chapter      text,
  entries      int,
  best_placing text,
  points       int,
  rank         int
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_approved() then
    raise exception 'Sign in to see the rankings.' using errcode = 'insufficient_privilege';
  end if;

  return query
  with scored as (
    select e.profile_id,
           e.club_id,
           public.entry_points(e."placing", e.won_overall) as pts,
           e."placing" as pl
      from public.competition_entries e
     where e.status = 'approved'
  ),
  totals as (
    select s.profile_id,
           count(*)::int as entries,
           sum(s.pts)::int as points,
           /* Best finish, ordered as a person reads them rather than as text
              sorts them: '10th' would otherwise beat '2nd'. */
           min(case s.pl when '1st' then 1 when '2nd' then 2 when '3rd' then 3
                         when '4th' then 4 when '5th' then 5 else 99 end) as best_rank
      from scored s
     group by s.profile_id
  )
  select t.profile_id,
         p.display_name,
         am.club_id,
         c.name,
         coalesce(u.short_name, u.name),
         t.entries,
         case t.best_rank when 1 then '1st' when 2 then '2nd' when 3 then '3rd'
                          when 4 then '4th' when 5 then '5th' else 'DNP' end,
         t.points,
         rank() over (order by t.points desc, t.entries asc)::int
    from totals t
    join public.profiles p on p.id = t.profile_id
    /* The athlete's chapter comes from an active membership, never from a
       profile column: an org-role holder is not on a chapter's board. */
    left join public.active_memberships am on am.user_id = t.profile_id
    left join public.clubs c        on c.id = am.club_id
    left join public.universities u on u.id = am.university_id
   where p.status = 'approved' and p.deleted_at is null
   order by rank() over (order by t.points desc, t.entries asc);
end;
$$;

revoke execute on function public.get_athlete_rankings() from anon;
grant execute on function public.get_athlete_rankings() to authenticated;

-- ── 3. the Chapter Cup ──────────────────────────────────────────────────────
/*
 * Four components, and the cap.
 *
 *   roster_points   active members × 1   — showing up and staying
 *   stage_points    approved entries × 5 — competing at all, placing or not
 *   handler_points  approved handlers × 2 — turning up for somebody else
 *   qa_points       upvotes on approved answers × 1, CAPPED
 *
 * `roster_points` counts active `club_memberships`, not "approved profiles".
 * The two are different sets and the difference is exactly the admins and
 * coaching advisors that PR #37 spent a migration removing from rosters. A
 * headcount that counts them would put them back.
 *
 * The cap is the interesting rule. Q&A upvotes are the only component a club
 * can farm without leaving the building: answering is cheap, competing is not.
 * Capping Q&A at 25% of the club's total means it can never be more than a
 * third of the other three combined, so a chapter cannot win the Cup on forum
 * activity alone — but it still pays, because the alternative is a leaderboard
 * that tells members answering questions is worthless.
 *
 * The cap is applied here rather than in the app deliberately: it is part of
 * what the number *means*, and a cap the client applies is a cap that differs
 * between clients.
 */
create or replace function public.get_chapter_cup_standings()
returns table (
  club_id        uuid,
  club_name      text,
  chapter        text,
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
    /* Scored against the handler's OWN club, and only when the entry they
       crewed for was approved. Tagging cannot manufacture points. */
    select am.club_id, count(*)::int * 2 as pts
      from public.competition_handlers h
      join public.competition_entries e on e.id = h.entry_id and e.status = 'approved'
      join public.active_memberships am on am.user_id = h.handler_profile_id
     group by am.club_id
  ),
  qa as (
    /* One vote per member per answer is the primary key on `answer_votes`;
       "not your own" is its insert policy. Both are already true by the time a
       row exists, so this only has to count. */
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
              for qa gives qa <= base / 3, which is the form used here because
              it needs no reference to the total it is helping to compute. */
           least(qa_raw, floor((roster_pts + stage_pts + handler_pts) / 3.0)::int) as qa_pts
      from combined
  )
  select capped.id,
         capped.name,
         capped.chapter,
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

-- ── 4. the share card ───────────────────────────────────────────────────────
/*
 * The one function `anon` may call, because a share link is given to people
 * who do not have accounts. It takes an opaque token and returns exactly the
 * six fields a card prints — no ids, no email, no club internals.
 *
 * A returned entry yields NULL rather than its contents. The token stays alive
 * on purpose: the athlete may fix and resubmit, and burning the link would
 * break every place they had already pasted it.
 */
create or replace function public.get_share_card(token uuid)
returns table (
  athlete_name text,
  club_name    text,
  chapter      text,
  show_name    text,
  federation   text,
  date         date,
  division     text,
  class        text,
  "placing"    text,
  won_overall  boolean,
  status       text
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  return query
    select p.display_name,
           c.name,
           coalesce(u.short_name, u.name),
           e.show_name,
           e.federation,
           e.date,
           e.division,
           e."class",
           e."placing",
           e.won_overall,
           e.status
      from public.competition_entries e
      join public.profiles p on p.id = e.profile_id
      left join public.clubs c        on c.id = e.club_id
      left join public.universities u on u.id = c.university_id
     where e.share_token = token
       and e.status <> 'returned'
       and p.deleted_at is null;
end;
$$;

grant execute on function public.get_share_card(uuid) to anon, authenticated;

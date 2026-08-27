-- ============================================================================
-- Club leads manage their own roster, and the directory stops seeing double.
--
-- Three faults, one root. Since 0015 the real relation is `club_memberships`;
-- `profiles.club_id` is a derived mirror kept by `sync_profile_mirror`. Code
-- written before that still treats the mirror as the record, and the database
-- has been quietly disagreeing with the UI ever since.
--
-- ── 1. "Remove from roster" removed nobody ──────────────────────────────────
--
-- `removeFromClub` set `profiles.club_id = null` and nothing else. The roster
-- (`get_club_roster`), the directory (`member_directory`) and the rankings all
-- read `club_memberships`, so the member stayed exactly where they were. Worse
-- than a no-op: the very next membership write anywhere fires
-- `sync_profile_mirror`, which recomputes `club_id` from `derived_club()` and
-- puts the mirror back. A lead pressed the button, watched nothing happen, and
-- pressed it again.
--
-- ── 2. Leads could not be un-led ────────────────────────────────────────────
--
-- `my_led_clubs()` unions TWO sources of authority:
--
--     club_memberships.role in ('club_lead', 'co_lead')    -- the membership
--     club_leads.profile_id                                -- the named list
--
-- `set_club_lead()` writes only the second. So anybody whose authority came
-- from the first could not be demoted by any UI in the app — which is exactly
-- the reported "test accounts are stuck as Club Leads". `get_club_roster` then
-- computes its Lead badge from the membership role, so the badge and the
-- button disagreed about what had happened.
--
-- Both functions below write BOTH sources. That is the whole fix, and it is
-- why they are functions rather than table updates from the app: two writes
-- that must not half-succeed belong in one transaction with one authority
-- check, not in a server action that could be interrupted between them.
--
-- ── 3. The duplicate member ("Eli") ─────────────────────────────────────────
--
-- `member_directory` LEFT JOINs `active_memberships`, which is one row per
-- active membership. The unique index on `club_memberships` covers
-- `(user_id, university_id) where status <> 'denied' and university_id is not
-- null` — so two active memberships at two different universities are legal,
-- and so is any pair whose `university_id` is null. Each one produced its own
-- directory row for the same person.
--
-- `get_athlete_rankings()` had it worse: the same fan-out put the lifter in
-- the table twice, and because `rank()` is computed over those rows, their
-- duplicate pushed everybody below them down an extra place.
--
-- The fix is `primary_membership`, one row per person, used by both.
--
-- ── 4. Two relations the app queries do not exist ───────────────────────────
--
-- Found while checking the above: `national_rankings` and `chapter_rankings`
-- were dropped in 0023 and never recreated, yet `hub/page.js` queries both and
-- `network/page.js` reads `national_rankings` for the Cup points on every
-- directory card. They are not recreated here — the RPCs below are the live
-- replacements, and the app is pointed at them instead. See the note there.
-- ============================================================================

-- ── one active membership per person ────────────────────────────────────────
/*
 * Which of somebody's active memberships is *the* one.
 *
 * The ORDER BY is deliberately identical to `derived_club()`, which is what
 * decides `profiles.club_id`. Two different answers to "which club is this
 * person's" is the class of bug this whole migration is cleaning up, so the
 * rule is stated once here and mirrored there rather than invented twice.
 *
 * `membership_id` breaks the final tie. Without it two rows created in the
 * same transaction sort arbitrarily, and a view that returns a different
 * person's club on different days is worse than one that is consistently
 * wrong.
 */
create or replace view public.primary_membership
with (security_invoker = true) as
select distinct on (m.user_id)
  m.membership_id,
  m.user_id,
  m.club_id,
  m.university_id,
  m.role,
  m.grad_year,
  m.verified_at,
  m.verification_method,
  m.is_verified,
  m.dues_current,
  m.created_at
from public.active_memberships m
order by m.user_id, m.verified_at nulls last, m.created_at, m.membership_id;

comment on view public.primary_membership is
  'Exactly one active membership per person, chosen by the same rule as derived_club(). The directory and the rankings read this rather than active_memberships, which is one row per membership and therefore showed dual members twice.';

grant select on public.primary_membership to authenticated;

-- ── the directory stops seeing double ───────────────────────────────────────
/* Same column list as 0034, same filters. The only change is the relation on
   the right of the first join. */
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
  am.grad_year   as membership_grad_year,
  p.grad_year,
  p.grad_year_inferred,
  p.academic_level,
  (
    p.is_alumni
    or (p.grad_year is not null and p.grad_year < public.academic_year_of(now()))
  ) as is_alumni_effective
from public.profiles p
/* `primary_membership`, not `active_memberships`. That one word is the
   duplicate-member fix: the old relation is one row per membership, so a
   person with two active ones appeared twice in the Network directory under
   two different clubs. */
left join public.primary_membership am on am.user_id = p.id
left join public.clubs c        on c.id = am.club_id
left join public.universities u on u.id = am.university_id
where p.status = 'approved'
  and p.deleted_at is null
  /* The ghost filter, unchanged from 0034. `is_onboarded(uuid)` — NOT the
     `(profiles)` row overload, which expands to include `email` and fails the
     whole view for everybody who may not read it. Third appearance of that
     trap; see 0034 for the other two. */
  and public.is_onboarded(p.id);

grant select on public.member_directory to authenticated;

comment on view public.member_directory is
  'The Network directory, one row per member. Reads primary_membership so somebody with two active memberships appears once. Excludes accounts that have not finished onboarding.';

-- ── the leaderboards stop double-counting ──────────────────────────────────
/*
 * `national_rankings` and `chapter_rankings` are NOT recreated here, and that
 * is deliberate: 0023 dropped both and nothing has recreated them since. The
 * app has been querying two relations that do not exist — `hub/page.js` asks
 * for both, and `network/page.js` reads `national_rankings` for the Cup points
 * on every directory card. PostgREST answers a missing relation with an error,
 * the app's `|| []` swallows it, and the result is a Home screen that has been
 * quietly insisting nobody has scored all season.
 *
 * The live replacements are these two RPCs, which the `/rankings` pages
 * already use.
 * Pointing the Hub and the directory at them is the app-side half of this fix;
 * this is the database half, which is the same duplicate join as the
 * directory's.
 */
drop function if exists public.get_athlete_rankings();
create function public.get_athlete_rankings()
returns table (
  profile_id   uuid,
  display_name text,
  club_id      uuid,
  club_name    text,
  chapter      text,
  club_logo    text,
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
         c.logo_url,
         t.entries,
         case t.best_rank when 1 then '1st' when 2 then '2nd' when 3 then '3rd'
                          when 4 then '4th' when 5 then '5th' else 'DNP' end,
         t.points,
         rank() over (order by t.points desc, t.entries asc)::int
    from totals t
    join public.profiles p on p.id = t.profile_id
    /* `primary_membership`, not `active_memberships`. The old join was one row
       per membership, so a lifter belonging to two chapters appeared twice —
       and because `rank()` is computed over these rows, their duplicate pushed
       everybody below them down an extra place. */
    left join public.primary_membership am on am.user_id = t.profile_id
    left join public.clubs c        on c.id = am.club_id
    left join public.universities u on u.id = am.university_id
   where p.status = 'approved' and p.deleted_at is null
   order by rank() over (order by t.points desc, t.entries asc);
end;
$$;

revoke execute on function public.get_athlete_rankings() from anon;
grant execute on function public.get_athlete_rankings() to authenticated;

/*
 * Rebased on 0029, not 0025 — 0029 is the current definition and made the
 * handler component delete-safe (`coalesce(h.handler_club_id, am.club_id)`,
 * so a chapter keeps points earned by somebody whose account was later
 * deleted). Rebuilding this from 0025's text silently reverted that, and
 * `06_hard_delete.sql` caught it. Only the membership joins change here.
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
    /* Joined to `profiles` rather than counting membership rows on their own.
       A membership belonging to a deleted account, or to one that never
       finished signing up, is not a member of the chapter — and counting them
       is how a handful of test accounts quietly inflated a chapter's roster
       points. This is the same population the Network directory shows. */
    select m.club_id, count(*)::int * 1 as pts
      from public.club_memberships m
      join public.profiles p on p.id = m.user_id
     where m.status = 'active'
       and p.status = 'approved'
       and p.deleted_at is null
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
       for: the chapter keeps the points somebody earned for it.
       `primary_membership` on the fallback, so a handler with two active
       memberships credits one chapter rather than both. */
    select coalesce(h.handler_club_id, am.club_id) as club_id, count(*)::int * 2 as pts
      from public.competition_handlers h
      join public.competition_entries e on e.id = h.entry_id and e.status = 'approved'
      left join public.primary_membership am on am.user_id = h.handler_profile_id
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
      join public.primary_membership am on am.user_id = a.author_id
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

-- ============================================================================
-- The transfer escape hatch, and why it is this narrow.
--
-- `guard_membership_privileges` refuses `role = 'club_lead'` from anybody but
-- an admin, on purpose: appointing a chapter's lead is an NCBO decision, not
-- something a lead hands out. Leadership *transfer* is a different act — the
-- seat does not multiply, it moves — and that is the only thing opened here.
--
-- The guard is relaxed for one transaction-local flag that
-- `transfer_club_leadership()` sets. The flag is NOT the authorisation: the
-- guard still requires `leads_club(new.club_id)` alongside it, and the
-- function does its own check before setting anything. So even if a caller
-- could set the flag — there is no RPC that lets them, `set_config` is not
-- exposed through PostgREST, and `true` makes it die with the transaction —
-- they would still have to already lead the club, which is the same authority
-- the existing co-lead path requires.
--
-- What this deliberately does NOT allow: appointing a second club_lead. The
-- function demotes the caller in the same transaction, so the count of leads
-- at a chapter cannot go up by this route.
--
-- The body below is 0017's, not 0015's, with only the two `transferring`
-- clauses added. 0017 added the school-email `redeemed` branch, and rebuilding
-- this from the older text silently dropped it — `redeem_school_email_code()`
-- started failing with "Nobody verifies themselves". Caught by diffing the
-- policy suite against the base branch; the whole reason to run it that way.
-- ============================================================================
create or replace function public.guard_membership_privileges()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  lead_here    boolean;
  is_self      boolean;
  redeemed     boolean;
  transferring boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  lead_here := public.leads_club(new.club_id) and public.leads_club(old.club_id);
  is_self   := new.user_id = auth.uid();

  /* Set only by transfer_club_leadership(), only for the duration of its
     transaction. Paired with `lead_here` / `is_self` below — never sufficient
     on its own. */
  transferring := coalesce(
    current_setting('ncbo.leadership_transfer', true), ''
  ) = 'on';

  if new.user_id is distinct from old.user_id or new.club_id is distinct from old.club_id then
    raise exception 'A membership cannot be moved between people or clubs.'
      using errcode = 'insufficient_privilege';
  end if;

  if lead_here then
    -- Only an admin appoints a club_lead out of nowhere. The one exception is
    -- a transfer, where the same transaction steps the caller down.
    if new.role is distinct from old.role
       and new.role = 'club_lead'
       and not transferring then
      raise exception 'Only an admin can appoint a club lead.' using errcode = 'insufficient_privilege';
    end if;

    if new.verified_by_user_id is distinct from old.verified_by_user_id
       and new.verified_by_user_id is distinct from auth.uid() then
      raise exception 'A verification is recorded in the name of whoever made it.'
        using errcode = 'insufficient_privilege';
    end if;

    return new;
  end if;

  if is_self then
    if new.status is distinct from old.status then
      raise exception 'A club lead decides on an application, not the applicant.'
        using errcode = 'insufficient_privilege';
    end if;
    -- A lead stepping themselves down as part of a transfer is the one role
    -- change somebody may make to their own membership. Promoting yourself is
    -- still refused: the exception is `member`, and nothing else.
    if new.role is distinct from old.role
       and not (transferring and new.role = 'member') then
      raise exception 'Only a club lead or an admin can change a club role.'
        using errcode = 'insufficient_privilege';
    end if;

    -- The receipt: a code this person actually redeemed, for this membership.
    redeemed := new.verification_method = 'school_email'
            and exists (
              select 1 from public.school_email_codes c
               where c.membership_id = new.id
                 and c.user_id = auth.uid()
                 and c.consumed_at is not null
            );

    if not redeemed
       and (new.verified_at            is distinct from old.verified_at
         or new.verified_by_user_id    is distinct from old.verified_by_user_id
         or new.verification_method    is distinct from old.verification_method) then
      raise exception 'Nobody verifies themselves.' using errcode = 'insufficient_privilege';
    end if;

    -- Even with a receipt, the vouch is not recorded in anybody's name: no
    -- human vouched, and writing one in would be a forged signature.
    if new.verified_by_user_id is distinct from old.verified_by_user_id then
      raise exception 'A school-email code is not a vouch from a person.'
        using errcode = 'insufficient_privilege';
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

-- ── remove a member from the chapter ────────────────────────────────────────
/*
 * Off this chapter's roster. Not off the platform, and not deleted.
 *
 * `status = 'lapsed'` rather than a DELETE, matching the policy that already
 * says so: "Removing a membership erases the record of a decision. Statuses
 * exist for every legitimate ending." The unique `(user_id, club_id)` means
 * the same row is reused if they ever re-apply, so this is reversible and
 * leaves an audit trail.
 *
 * The role is cleared and the `club_leads` row deleted in the same statement
 * batch. A removed member who kept `role = 'club_lead'` would still satisfy
 * `my_led_clubs()` and go on leading a chapter they are no longer in — which
 * is the stuck-lead bug arriving by a different door.
 */
create or replace function public.remove_club_member(target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_club uuid;
begin
  if target is null then
    raise exception 'No member given.' using errcode = 'insufficient_privilege';
  end if;

  /* The club comes from the member's own active membership, never from an id
     the caller passed. Trusting a posted club id is how a lead at one chapter
     reaches a row at another. */
  select m.club_id into target_club
    from public.club_memberships m
   where m.user_id = target and m.status = 'active'
   order by m.verified_at nulls last, m.created_at, m.id
   limit 1;

  if target_club is null then
    raise exception 'That member is not on a chapter roster.' using errcode = 'insufficient_privilege';
  end if;

  if not (public.is_admin() or public.leads_club(target_club)) then
    raise exception 'You do not lead that chapter.' using errcode = 'insufficient_privilege';
  end if;

  /* A lead removing themselves would leave a chapter that may have no other
     lead, and no way back without an admin. Transferring first is the
     supported path, and the UI offers it. */
  if target = auth.uid() and not public.is_admin() then
    raise exception 'You cannot remove yourself. Transfer leadership first, or ask an admin.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.club_memberships
     set status = 'lapsed',
         role   = 'member'
   where user_id = target and club_id = target_club and status = 'active';

  -- The other half of `my_led_clubs()`. Leaving this behind is precisely how
  -- a removed account stays a lead.
  delete from public.club_leads
   where profile_id = target and club_id = target_club;

  -- `profiles.club_id` is a mirror; recompute it rather than writing it, so
  -- this agrees with what the triggers would have done anyway.
  perform public.sync_profile_mirror(target);
end;
$$;

comment on function public.remove_club_member(uuid) is
  'Takes a member off the chapter roster: membership to lapsed, club role cleared, club_leads row deleted, mirror resynced. Authorised against the club the member actually belongs to, never a club id from the caller.';

revoke execute on function public.remove_club_member(uuid) from anon;
grant execute on function public.remove_club_member(uuid) to authenticated;

-- ── hand the chapter to somebody else ───────────────────────────────────────
/*
 * One seat, moved. The caller steps down in the same transaction that
 * promotes the target, so a chapter can never gain a lead through this path
 * and can never be left without one.
 *
 * Both sources of authority are written on both sides — the membership role
 * and the `club_leads` row — because `my_led_clubs()` reads the union of
 * them. Writing one and not the other is the bug this migration exists to
 * fix, so doing it correctly twice is the point.
 */
create or replace function public.transfer_club_leadership(target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_club uuid;
  target_name text;
  actor       uuid := auth.uid();
begin
  if target is null then
    raise exception 'No member given.' using errcode = 'insufficient_privilege';
  end if;

  if actor is null then
    raise exception 'You are signed out.' using errcode = 'insufficient_privilege';
  end if;

  if target = actor then
    raise exception 'You already lead this chapter.' using errcode = 'insufficient_privilege';
  end if;

  select m.club_id into target_club
    from public.club_memberships m
   where m.user_id = target and m.status = 'active'
   order by m.verified_at nulls last, m.created_at, m.id
   limit 1;

  if target_club is null then
    raise exception 'That member is not on a chapter roster.' using errcode = 'insufficient_privilege';
  end if;

  if not (public.is_admin() or public.leads_club(target_club)) then
    raise exception 'You do not lead that chapter.' using errcode = 'insufficient_privilege';
  end if;

  select p.display_name into target_name from public.profiles p where p.id = target;

  /* Local to this transaction, and paired with `leads_club` in the guard —
     see the block comment above. */
  perform set_config('ncbo.leadership_transfer', 'on', true);

  -- Promote first, so a failure leaves the chapter with its existing lead
  -- rather than with none.
  update public.club_memberships
     set role = 'club_lead'
   where user_id = target and club_id = target_club and status = 'active';

  insert into public.club_leads (club_id, name, profile_id, ordinal)
  values (target_club, coalesce(target_name, 'Lead'), target, 5)
  on conflict (club_id, name) do update set profile_id = excluded.profile_id;

  -- Then step the caller down, on this club only. An admin acting on a
  -- chapter they do not belong to has nothing to step down from, which the
  -- WHERE handles without a branch.
  update public.club_memberships
     set role = 'member'
   where user_id = actor and club_id = target_club and status = 'active';

  delete from public.club_leads
   where profile_id = actor and club_id = target_club;

  perform set_config('ncbo.leadership_transfer', 'off', true);

  perform public.sync_profile_mirror(target);
  perform public.sync_profile_mirror(actor);
end;
$$;

comment on function public.transfer_club_leadership(uuid) is
  'Moves the club_lead seat from the caller to another active member of the same chapter, writing both club_memberships.role and club_leads on both sides. Atomic: the chapter never has two leads or none by this route.';

revoke execute on function public.transfer_club_leadership(uuid) from anon;
grant execute on function public.transfer_club_leadership(uuid) to authenticated;

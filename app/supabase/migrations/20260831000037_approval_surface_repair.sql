-- ============================================================================
-- The approval queue gets its screen back, and an admin gets a way to place
-- somebody in a chapter.
--
-- 0016 moved club approval off the admin's desk and onto the lead's, and built
-- everything it needs: `get_club_queue()`, `decide_membership()`, the vouches,
-- the escalation. The nav rebuild then replaced `/hub/club/queue` — the page
-- that rendered all of it — with a redirect to the *results* queue at
-- `/club/entries`. Two different queues, one route, and the membership one
-- lost its only screen.
--
-- The visible symptom is the one this migration is named for: a new account
-- applies, the application sits `pending` forever, and because
-- `member_directory` reads `active_memberships`, that person shows up in the
-- Network under "No club yet" with nobody — lead or admin — able to move them
-- out of it. Somebody who signed up saying they run the chapter is stuck in
-- exactly the same place, and worse off: at a club with no lead yet, the admin
-- is the only person who could ever have acted.
--
-- The page is restored in the app. Three things belong here:
--
--   1. the nav count, so the queue is visible without going looking for it
--   2. `claimed_lead` on the queue read, so the reviewer sees the claim 0032
--      recorded — it was written at signup and nothing ever showed it
--   3. `admin_place_member()`, because the admin's other route into a chapter
--      was the club dropdown on the user editor, and that dropdown wrote
--      `profiles.club_id` — a *derived mirror* since 0015, resynced from
--      memberships by trigger. It changed nothing anybody could see and was
--      undone by the next membership write. An admin assigning a club has to
--      write the membership, which is what this function does.
-- ============================================================================

-- ============================================================================
-- 1. The queue carries the lead claim
--
-- `create or replace` cannot widen a RETURNS TABLE, hence the drop. The body
-- is 0016's, with `claimed_lead` added and its authorisation unchanged: a lead
-- at Pitt calling this with Purdue's club id is still refused rather than
-- filtered.
-- ============================================================================
drop function if exists public.get_club_queue(uuid);

create function public.get_club_queue(target_club uuid)
returns table (
  membership_id       uuid,
  user_id             uuid,
  display_name        text,
  legal_name          text,
  preferred_name      text,
  grad_year           int,
  group_chat_platform text,
  group_chat_handle   text,
  found_via           text,
  referred_by_name    text,
  student_id_photo_path text,
  vouch_count         int,
  applied_at          timestamptz,
  hours_waiting       numeric,
  escalation_level    int,
  claimed_lead        boolean
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.leads_club(target_club)) then
    raise exception 'Not a lead of that club.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      m.id, m.user_id, p.display_name,
      m.legal_name, m.preferred_name, m.grad_year,
      m.group_chat_platform, m.group_chat_handle, m.found_via,
      r.display_name,
      m.student_id_photo_path,
      (select count(*)::int from public.membership_vouches v where v.membership_id = m.id),
      m.created_at,
      round(extract(epoch from (now() - m.created_at)) / 3600.0, 1),
      m.escalation_level,
      m.claimed_lead
      from public.club_memberships m
      join public.profiles p on p.id = m.user_id
      left join public.profiles r on r.id = m.referred_by_user_id
     where m.club_id = target_club
       and m.status  = 'pending'
     order by m.created_at;
end;
$$;

revoke execute on function public.get_club_queue(uuid) from anon;
grant execute on function public.get_club_queue(uuid) to authenticated;

-- ============================================================================
-- 2. Where the pending applications are
--
-- A lead has one chapter and does not need this. An admin has ninety and does:
-- without it, acting on a queue means guessing which chapter to switch to,
-- and a chapter with no lead of its own — the case where the admin is the only
-- possible approver — is exactly the one nobody thinks to check.
-- ============================================================================
create or replace function public.pending_applications_by_club()
returns table (
  club_id        uuid,
  club_name      text,
  short_name     text,
  pending        int,
  escalated      int,
  approver_count int,
  oldest_at      timestamptz
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select m.club_id,
         c.name,
         coalesce(u.short_name, u.name),
         count(*)::int,
         count(*) filter (where m.escalation_level > 0)::int,
         public.club_approver_count(m.club_id),
         min(m.created_at)
    from public.club_memberships m
    join public.clubs c        on c.id = m.club_id
    left join public.universities u on u.id = c.university_id
   where m.status = 'pending'
     and (public.is_admin() or m.club_id = any (public.my_led_clubs()))
   group by m.club_id, c.name, u.short_name, u.name
   order by min(m.created_at);
$$;

comment on function public.pending_applications_by_club() is
  'Chapters with somebody waiting, scoped to what the caller may act on. Zero rows for anyone who leads nothing and is not an admin.';

revoke execute on function public.pending_applications_by_club() from anon;
grant execute on function public.pending_applications_by_club() to authenticated;

-- ============================================================================
-- 3. The nav count
--
-- Applications join entries and questions. Without a badge the queue is a link
-- nobody clicks until somebody complains, which is how it went unnoticed that
-- the link had been pointing at the wrong queue entirely.
-- ============================================================================
drop function if exists public.get_viewer_nav_counts();

create function public.get_viewer_nav_counts()
returns table (
  pending_entries       int,
  pending_questions     int,
  all_pending_questions int,
  pending_applications  int
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  led uuid[] := public.my_led_clubs();
begin
  if auth.uid() is null or not public.is_approved() then
    return query select 0, 0, 0, 0;
    return;
  end if;

  return query
  select
    (select count(*)::int from public.competition_entries e
      where e.status = 'pending'
        and (public.is_admin() or e.club_id = any (led)))::int,

    (case when public.is_moderator()
          then (select count(*)::int from public.questions q where q.status = 'pending')
          else 0 end)::int,

    (select count(*)::int from public.questions q where q.status = 'pending')::int,

    /* Same scoping as the entries count above: the clubs this viewer leads, or
       every club for an admin. A lead with no clubs gets zero. */
    (select count(*)::int from public.club_memberships m
      where m.status = 'pending'
        and (public.is_admin() or m.club_id = any (led)))::int;
end;
$$;

revoke execute on function public.get_viewer_nav_counts() from anon;
grant execute on function public.get_viewer_nav_counts() to authenticated;

-- ============================================================================
-- 4. An admin places somebody in a chapter
--
-- The membership is the fact; `profiles.club_id` is a mirror the triggers keep
-- in step. This writes the fact.
--
-- Deliberately not a second approval path around `decide_membership()`: that
-- one is the club lead's and is club-scoped. This is the admin's, it is
-- admin-only, it records itself as such, and it exists for the two cases a
-- lead cannot cover — a chapter with no lead at all, and a member who joined
-- before any of this and never had a membership row.
-- ============================================================================
create or replace function public.admin_place_member(
  target   uuid,
  club     uuid,
  new_role public.membership_role default 'member'
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  existing uuid;
  target_name text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can assign a club.' using errcode = 'insufficient_privilege';
  end if;
  if target is null then
    raise exception 'No member named.' using errcode = 'no_data_found';
  end if;

  /* No club means off the roster, not erased. 'lapsed' rather than a delete,
     for the reason the delete policy gives: removing the row erases the
     record of a decision that was made. */
  if club is null then
    update public.club_memberships m
       set status             = 'lapsed',
           decided_at         = now(),
           decided_by_user_id = auth.uid()
     where m.user_id = target
       and m.status in ('pending', 'active');
    delete from public.club_leads l where l.profile_id = target;
    return;
  end if;

  if not exists (select 1 from public.clubs c where c.id = club) then
    raise exception 'No such club.' using errcode = 'no_data_found';
  end if;

  /* One chapter at a time. `club_memberships_one_per_university` would refuse
     the second row anyway; closing the old one first turns a constraint
     violation into the move the admin actually meant. */
  update public.club_memberships m
     set status             = 'lapsed',
         decided_at         = now(),
         decided_by_user_id = auth.uid()
   where m.user_id = target
     and m.club_id <> club
     and m.status in ('pending', 'active');

  select m.id into existing
    from public.club_memberships m
   where m.user_id = target and m.club_id = club;

  /* Read-then-write rather than an upsert, and 0032 is why: `on conflict do
     update` reads `excluded`, which spans the columns on this table's SELECT
     deny list. It is harmless from a definer function and a trap the moment
     anybody copies this shape into the app. */
  if existing is null then
    insert into public.club_memberships (
      user_id, club_id, status, role,
      verified_at, verified_by_user_id, verification_method,
      decided_at, decided_by_user_id
    ) values (
      target, club, 'active', new_role,
      now(), auth.uid(), 'admin'::public.verification_method,
      now(), auth.uid()
    );
  else
    update public.club_memberships m
       set status              = 'active',
           role                = new_role,
           verified_at         = coalesce(m.verified_at, now()),
           verified_by_user_id = coalesce(m.verified_by_user_id, auth.uid()),
           verification_method = coalesce(m.verification_method, 'admin'::public.verification_method),
           decided_at          = now(),
           decided_by_user_id  = auth.uid()
     where m.id = existing;
  end if;

  /* `club_leads` is the named list the public site reads, and `my_led_clubs()`
     unions it. A lead appointed here who is missing from it leads a chapter
     the app does not believe they lead. */
  select p.display_name into target_name from public.profiles p where p.id = target;

  if new_role in ('club_lead', 'co_lead') then
    insert into public.club_leads (club_id, name, profile_id, ordinal)
    values (club, coalesce(target_name, 'Lead'), target,
            case when new_role = 'club_lead' then 0 else 5 end)
    on conflict (club_id, name) do update set profile_id = excluded.profile_id;
  else
    delete from public.club_leads l where l.profile_id = target and l.club_id = club;
  end if;
end;
$$;

comment on function public.admin_place_member(uuid, uuid, public.membership_role) is
  'Admin-only. Writes the membership itself, because profiles.club_id is a derived mirror and assigning a club by writing to it changed nothing.';

revoke execute on function public.admin_place_member(uuid, uuid, public.membership_role) from anon;
grant execute on function public.admin_place_member(uuid, uuid, public.membership_role) to authenticated;

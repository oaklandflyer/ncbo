-- ============================================================================
-- "Led by Rachel Hare, Luke Rudolph, CL Test" — where that string comes from,
-- and why it outlived the people in it.
--
-- The Network directory's chapter heading reads `club_directory.leads`, which
-- is this, unchanged since 0016:
--
--     coalesce((select array_agg(l.name order by l.ordinal, l.name)
--                 from public.club_leads l where l.club_id = c.id), '{}')
--
-- An aggregate of `club_leads.name`. A **text column**. No join to `profiles`,
-- so nothing in it has ever been able to notice that the person it names is
-- deleted, was never on the app, or does not exist. Three different faults all
-- arrive at the same place:
--
--   1. **Seeded placeholders.** 0014 seeded `club_leads` from the marketing
--      site's roster and then tried to link each row to a profile by display
--      name. Rows that matched nobody kept `profile_id is null` and their name
--      — and the migration says so out loud, in a NOTICE that is still in
--      every migration log:
--
--        club_leads: no profile matched for Luke Rudolph, Rachel Hare,
--        Altan Sahin, Vincent Panzica, David, Eli Korta, Isabel Ward,
--        Sam Lampert, Alex Swanson, Andrew Cho, Sean Hanley
--
--      Those eleven names have been printed as chapter leadership ever since.
--
--   2. **Hard-deleted accounts.** `club_leads.profile_id` is
--      `references profiles(id) on delete set null`. Deleting the account
--      nulls the link and **leaves the name behind**, which is exactly how a
--      deleted "CL Test" goes on leading Pitt. The permanent-deletion work
--      erased the profile and could not erase this.
--
--   3. **Soft-deleted accounts.** `profiles.deleted_at` is set, the
--      `profile_id` still points at a live row, and nothing looks.
--
-- ── The fix ─────────────────────────────────────────────────────────────────
--
-- `leads` becomes an INNER JOIN to a profile that is present, approved and not
-- deleted. All three faults collapse into one rule: a name is published only
-- when there is a real, live account behind it. Cases 1 and 2 are excluded by
-- the join itself, because both have `profile_id is null`.
--
-- **This changes display only, never authority.** `my_led_clubs()` matches
-- `l.profile_id = auth.uid()`, which no orphan row can ever satisfy — a null
-- never equals a uuid. So nobody gains or loses the ability to lead anything
-- here; the directory simply stops making claims about people it cannot
-- substantiate. That separation is why this is safe to apply before the rows
-- are cleaned up.
--
-- The rows are still there afterwards, hidden rather than deleted, because
-- deleting eleven seeded names on the way past is a data decision an admin
-- should make deliberately. `clean_orphaned_club_leads()` below is that
-- decision, and `orphan_lead_count` is how they find the chapters that need it.
-- ============================================================================

drop view if exists public.club_directory;

create view public.club_directory
with (security_invoker = true) as
select
  c.id,
  c.name as club_name,
  c.status,
  c.active,
  c.founded_on,
  c.instagram,
  u.id    as school_id,
  u.id    as university_id,
  u.name  as school_name,
  coalesce(u.short_name, u.name) as short_name,
  u.state,
  u.domain,
  (select count(*) from public.club_memberships m
    where m.club_id = c.id and m.status = 'active') as member_count,
  (select count(*) from public.club_memberships m
    where m.club_id = c.id and m.status = 'pending') as pending_count,
  public.club_approver_count(c.id) as approver_count,

  /* The published list. An INNER JOIN to a live profile is the whole fix.
     `p.display_name` first so a member who renamed themselves is printed as
     they are now rather than as the seed spelled them; `l.name` is the
     fallback for a linked profile that has not set one. */
  coalesce(
    (select array_agg(
              coalesce(nullif(btrim(p.display_name), ''), l.name)
              order by l.ordinal, l.name)
       from public.club_leads l
       join public.profiles p on p.id = l.profile_id
      where l.club_id = c.id
        and p.deleted_at is null
        and p.status = 'approved'),
    '{}'
  ) as leads,

  /* What the join above is now hiding, so an admin can find it. Counted
     rather than listed: the names are in the settings screen, and a directory
     view is the wrong place to re-publish the thing it just suppressed. */
  (select count(*)
     from public.club_leads l
     left join public.profiles p on p.id = l.profile_id
    where l.club_id = c.id
      and (p.id is null or p.deleted_at is not null or p.status <> 'approved')
  ) as orphan_lead_count

from public.clubs c
join public.universities u on u.id = c.university_id;

grant select on public.club_directory to authenticated;

comment on view public.club_directory is
  'Chapters for the Network directory. `leads` names only people with a live, approved, non-deleted profile: the column is an aggregate of club_leads.name, and without that join it published seeded placeholders and the names of deleted accounts. `orphan_lead_count` is how many rows it is suppressing.';

-- ── what an admin needs to see before deleting anything ─────────────────────
/*
 * The lead rows for one chapter, with the reason each is or is not published.
 *
 * A bulk "clean" button with nothing to inspect first is a button nobody
 * presses. This is what the settings screen lists, so whoever is about to
 * delete eleven rows can read the names and see why each one is orphaned.
 *
 * SECURITY DEFINER with an explicit gate rather than a view, because it
 * reports on rows the `club_leads_read` policy shows to every approved member
 * — and the orphan reason is administrative detail, not roster information.
 */
create or replace function public.get_club_lead_entries(target_club uuid)
returns table (
  id           uuid,
  club_id      uuid,
  name         text,
  ordinal      int,
  profile_id   uuid,
  display_name text,
  is_published boolean,
  orphan_reason text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.leads_club(target_club)) then
    raise exception 'You do not lead that chapter.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select l.id,
           l.club_id,
           l.name,
           l.ordinal,
           l.profile_id,
           p.display_name,
           (p.id is not null and p.deleted_at is null and p.status = 'approved') as is_published,
           case
             when l.profile_id is null then 'No account linked'
             when p.id is null         then 'Account deleted'
             when p.deleted_at is not null then 'Account deleted'
             when p.status <> 'approved'   then 'Account ' || p.status::text
             else null
           end as orphan_reason
      from public.club_leads l
      left join public.profiles p on p.id = l.profile_id
     where l.club_id = target_club
     order by l.ordinal, l.name;
end;
$$;

comment on function public.get_club_lead_entries(uuid) is
  'Every club_leads row for one chapter, with whether the directory publishes it and why not. Club lead or admin only.';

revoke execute on function public.get_club_lead_entries(uuid) from anon;
grant execute on function public.get_club_lead_entries(uuid) to authenticated;

-- ── removing one entry ──────────────────────────────────────────────────────
/*
 * `club_leads_write` is admin-only, and 0011 left a note about that:
 *
 *   "A club lead editing their own club's lead list is a reasonable future
 *    step; it is not V1, and the narrower policy is the one that is safe to
 *    widen later."
 *
 * This is that step, taken as a function rather than as a wider policy, and
 * the difference matters. A policy that let leads write `club_leads` would let
 * them INSERT name-only rows — which is precisely the shape of the pollution
 * being cleaned up here. Removal is the only verb a lead gets; adding a lead
 * still goes through `set_club_lead()`, which requires a real member of the
 * chapter and so cannot manufacture an orphan.
 */
create or replace function public.remove_club_lead_entry(entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entry_club    uuid;
  entry_profile uuid;
begin
  select l.club_id, l.profile_id into entry_club, entry_profile
    from public.club_leads l where l.id = entry_id;

  if entry_club is null then
    raise exception 'That entry no longer exists.' using errcode = 'insufficient_privilege';
  end if;

  if not (public.is_admin() or public.leads_club(entry_club)) then
    raise exception 'You do not lead that chapter.' using errcode = 'insufficient_privilege';
  end if;

  /* Same rule as `remove_club_member`: nobody removes their own claim. A lead
     whose authority rests on this row would delete it and lock themselves out
     of the screen they are standing on. */
  if entry_profile is not null and entry_profile = auth.uid() and not public.is_admin() then
    raise exception 'You cannot remove your own entry. Transfer the chapter first, or ask an admin.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.club_leads where id = entry_id;

  if entry_profile is not null then
    perform public.sync_profile_mirror(entry_profile);
  end if;
end;
$$;

comment on function public.remove_club_lead_entry(uuid) is
  'Deletes one club_leads row. Club lead of that chapter, or admin. Removal only: adding a lead goes through set_club_lead(), which requires a real member and cannot create an orphan.';

revoke execute on function public.remove_club_lead_entry(uuid) from anon;
grant execute on function public.remove_club_lead_entry(uuid) to authenticated;

-- ── the bulk sweep ──────────────────────────────────────────────────────────
/*
 * Every orphan at one chapter, deleted, in one statement. Admin only — this is
 * the button that removes eleven seeded names, and that is an organisation
 * decision rather than a chapter one.
 *
 * The definition of "orphan" is the exact complement of what `club_directory`
 * publishes, deliberately: what the sweep deletes is precisely what the
 * directory is already refusing to show, so an admin can never use it to
 * remove a lead who is currently on screen.
 *
 * Returns the count, so the UI can say what it did rather than claiming
 * success over zero rows.
 */
create or replace function public.clean_orphaned_club_leads(target_club uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed int;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can clear orphaned lead entries.'
      using errcode = 'insufficient_privilege';
  end if;

  if target_club is null then
    raise exception 'No chapter given.' using errcode = 'insufficient_privilege';
  end if;

  with doomed as (
    select l.id
      from public.club_leads l
      left join public.profiles p on p.id = l.profile_id
     where l.club_id = target_club
       and (p.id is null or p.deleted_at is not null or p.status <> 'approved')
  )
  delete from public.club_leads l
   using doomed d
   where l.id = d.id;

  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.clean_orphaned_club_leads(uuid) is
  'Permanently deletes every club_leads row at one chapter whose profile is missing, deleted or unapproved — exactly the set club_directory suppresses. Admin only; returns how many rows went.';

revoke execute on function public.clean_orphaned_club_leads(uuid) from anon;
grant execute on function public.clean_orphaned_club_leads(uuid) to authenticated;

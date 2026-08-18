-- ============================================================================
-- Club leads review their own school
--
-- Every pending account has gone through one queue, staffed by admins. The
-- people who actually know whether a name belongs at Pitt are the leads at
-- Pitt, so they get the queue for their own school — and nothing else.
--
-- The scope is deliberately narrow. A club lead may:
--
--   * see pending accounts whose school_id matches their own
--   * move one of those from 'pending' to 'approved' or 'rejected'
--   * record that decision in admin_actions
--
-- and may not: touch anyone at another school, change a role (including their
-- own), suspend an approved member, or reverse a decision once made. Those
-- stay with admins, who keep the global view they had.
--
-- As everywhere else in this schema, the app is not what enforces this. The
-- policies and the guard below are; hiding the page would only hide the page.
-- ============================================================================

-- ── whose school am I at? ───────────────────────────────────────────────────
-- SECURITY DEFINER with a pinned search_path, like the other helpers: these
-- read `profiles` from inside policies *on* `profiles`, which would otherwise
-- recurse through RLS.
create or replace function public.my_school()
returns uuid
language sql stable security definer set search_path = public
as $$ select school_id from public.profiles where id = auth.uid() $$;

create or replace function public.school_of(target uuid)
returns uuid
language sql stable security definer set search_path = public
as $$ select school_id from public.profiles where id = target $$;

-- A club lead, at a school, looking at someone from that same school. Null
-- school on either side is not a match — a lead with no school assigned
-- reviews nobody, rather than everybody.
create or replace function public.leads_school_of(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.my_role() = 'club_lead'
     and public.my_school() is not null
     and public.school_of(target) is not distinct from public.my_school()
$$;

-- ── profiles: a scoped write path ───────────────────────────────────────────
drop policy profiles_update on public.profiles;

create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin() or public.leads_school_of(id))
  with check (id = auth.uid() or public.is_admin() or public.leads_school_of(id));

-- ── the guard decides what a club lead may actually change ──────────────────
-- The policy above lets a lead write to the row at all; this decides which
-- columns and which transitions. Split out of the admin path on purpose: a
-- lead is not a small admin, they have one job on one set of rows.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  reviewing boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Before the admin bypass: nobody attests to being 18 for another person.
  if new.is_adult is distinct from old.is_adult and new.id <> auth.uid() then
    raise exception 'Only the member themselves can make the 18+ attestation.'
      using errcode = 'insufficient_privilege';
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- A club lead deciding on a pending account at their own school. Both the
  -- old and the new school are checked, so a decision cannot quietly move
  -- someone between schools on its way through.
  reviewing := public.leads_school_of(new.id)
           and new.id <> auth.uid()
           and old.status = 'pending'
           and new.status in ('approved', 'rejected')
           and new.school_id is not distinct from old.school_id
           and new.role is not distinct from old.role
           and new.club_id is not distinct from old.club_id;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a role.' using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status and not reviewing then
    if public.my_role() = 'club_lead' then
      raise exception 'A club lead can only approve or decline a pending account at their own school.'
        using errcode = 'insufficient_privilege';
    end if;
    raise exception 'Only an admin can approve or suspend an account.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.club_id is distinct from old.club_id or new.school_id is distinct from old.school_id then
    raise exception 'Only an admin can reassign a club or school.' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ── the audit log follows the same scope ────────────────────────────────────
drop policy admin_actions_read on public.admin_actions;
drop policy admin_actions_insert on public.admin_actions;

-- Admins read everything. A club lead reads the decisions made about people at
-- their own school — including ones an admin made, so the two can see the same
-- history for the same person.
create policy admin_actions_read on public.admin_actions
  for select to authenticated
  using (public.is_admin() or public.leads_school_of(target_id));

create policy admin_actions_insert on public.admin_actions
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (public.is_admin() or public.leads_school_of(target_id))
  );

-- Still no update or delete policy anywhere: the log stays append-only for
-- leads and admins alike.

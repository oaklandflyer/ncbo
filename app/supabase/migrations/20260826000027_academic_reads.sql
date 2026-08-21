-- ============================================================================
-- The read paths learn about the academic model.
--
-- Four surfaces draw an ALUMNI badge, and each reads a different source: the
-- directory reads `member_directory`, the admin table reads
-- `get_admin_members()`, the roster reads the roster RPC, and a profile page
-- reads `profiles` directly. Recomputing "is this person an alumnus" in four
-- React components is how four surfaces come to disagree about it, so the
-- answer is computed once per source, in SQL, from `profiles_with_status`'s
-- rule.
--
-- The one exception is the profile page, which reads `profiles` through
-- `getProfileResult` with PostgREST embeds that a view cannot carry. It uses
-- the JavaScript mirror in `src/lib/academicYear.js`, pinned to this rule by
-- the same test cases.
-- ============================================================================

-- ── the directory ───────────────────────────────────────────────────────────
/* `grad_year` here was the MEMBERSHIP's year, which is the year they gave when
   they applied to that club. The profile's year is the one the member can
   correct, so that is the one a directory should print. Both are kept: a lead
   comparing an application against a roster wants to see the difference. */
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
left join public.active_memberships am on am.user_id = p.id
left join public.clubs c        on c.id = am.club_id
left join public.universities u on u.id = am.university_id
where p.status = 'approved'
  and p.deleted_at is null;

grant select on public.member_directory to authenticated;

-- ── the admin table ─────────────────────────────────────────────────────────
/* `create or replace` cannot widen a RETURNS TABLE, so this is dropped first.
   `grad_year_inferred` is in the projection specifically so the admin UI can
   ask somebody to confirm a projected year: a guess that nothing surfaces is
   a guess that becomes a fact by default. */
drop function if exists public.get_admin_members();

create function public.get_admin_members()
returns table (
  id uuid, display_name text, email text, role public.user_role,
  status public.account_status, club_id uuid, club_name text,
  school_id uuid, school_name text, division text, home_region text,
  verified boolean, credentials public.credential[],
  is_alumni boolean, alumni_since date, deleted_at timestamptz, created_at timestamptz,
  org_roles public.org_role[], membership_status public.membership_status,
  grad_year smallint, grad_year_inferred boolean,
  academic_level public.academic_level, is_alumni_effective boolean
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id, p.display_name, p.email, p.role, p.status,
           m.club_id, c.name, m.university_id, u.name,
           p.division, p.home_region, p.verified, p.credentials,
           p.is_alumni, p.alumni_since, p.deleted_at, p.created_at,
           coalesce((select array_agg(o.role order by o.role)
                       from public.org_roles o where o.user_id = p.id), '{}'),
           m.status,
           p.grad_year, p.grad_year_inferred, p.academic_level,
           (p.is_alumni
            or (p.grad_year is not null
                and p.grad_year < public.academic_year_of(now()))) as is_alumni_effective
      from public.profiles p
      left join public.club_memberships m
             on m.user_id = p.id and m.status in ('active', 'pending', 'alumni')
      left join public.clubs c        on c.id = m.club_id
      left join public.universities u on u.id = m.university_id
     order by p.display_name;
end;
$$;

revoke execute on function public.get_admin_members() from anon;
grant execute on function public.get_admin_members() to authenticated;

-- ── the roster ──────────────────────────────────────────────────────────────
/* `grad_year` in the old signature was `m.grad_year`, the membership's. The
   roster prints "Class of ..." from the profile now, because that is the
   column the member and the lead can both correct; the membership's stays
   under its own name so a lead can still see what somebody applied with. */
drop function if exists public.get_club_roster(uuid);

create function public.get_club_roster(target_club uuid)
returns table (
  id uuid, display_name text, email text, role public.user_role,
  division text, class_year text, home_region text,
  is_alumni boolean, alumni_since date, is_lead boolean, created_at timestamptz,
  membership_id uuid, club_role public.membership_role, membership_grad_year int,
  is_verified boolean, verification_method public.verification_method,
  dues_current boolean,
  grad_year smallint, grad_year_inferred boolean,
  academic_level public.academic_level, is_alumni_effective boolean
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.leads_club(target_club)) then
    raise exception 'Not a lead of that club.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id, p.display_name, p.email, p.role,
           p.division, p.class_year, p.home_region,
           p.is_alumni, p.alumni_since,
           (m.role in ('club_lead', 'co_lead')) as is_lead,
           p.created_at,
           m.id, m.role, m.grad_year,
           (m.verified_at is not null),
           m.verification_method,
           public.dues_current(m.id),
           p.grad_year, p.grad_year_inferred, p.academic_level,
           (p.is_alumni
            or (p.grad_year is not null
                and p.grad_year < public.academic_year_of(now()))) as is_alumni_effective
      from public.club_memberships m
      join public.profiles p on p.id = m.user_id
     where m.club_id = target_club
       and m.status  = 'active'
       and p.deleted_at is null
     order by p.display_name;
end;
$$;

revoke execute on function public.get_club_roster(uuid) from anon;
grant execute on function public.get_club_roster(uuid) to authenticated;

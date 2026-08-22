-- ============================================================================
-- Ghost accounts, and where somebody is from.
--
-- ── 1. Ghosts ───────────────────────────────────────────────────────────────
--
-- Supabase creates an `auth.users` row the instant somebody completes OAuth,
-- and `handle_new_user` creates a profile from it. Somebody who signs in with
-- Google and then closes the tab has an approved profile with no name, no
-- chapter and no answers, and `member_directory` filters only on
-- `status = 'approved'` — which under open signup they are. So they appear in
-- the Network directory as a blank card.
--
-- The filter is `is_onboarded`, which is the same function the app gates on,
-- rather than a hand-written list of "required fields are not null" that would
-- drift from it the first time the definition changes. It changed twice
-- already: 0026 dropped class_year, 0031 added affiliation.
--
-- **The admin table is deliberately NOT filtered.** An admin who cannot see a
-- ghost account cannot delete one, which would quietly undo the permanent
-- deletion work. It gains an `onboarded` flag instead, so the screen can hide
-- them by default and offer to show them.
--
-- ── 2. Hometown ─────────────────────────────────────────────────────────────
--
-- No new column. `profiles.home_region` already holds exactly this and has
-- since 0001: the profile editor labels it "Hometown region", the directory
-- groups by it, and `get_public_profile` returns it.
--
-- Adding `hometown` beside it would be the `clubs.school_id` /
-- `clubs.university_id` trap again, documented in
-- docs/NCBO-AUDIT-V1-ANSWERS.md §1: two columns holding one fact, different
-- screens reading different ones, and a join that silently returns nothing.
-- What was actually missing is that onboarding never asked for it, so it was
-- always null until somebody found the profile editor. That is a form change,
-- not a schema change.
-- ============================================================================

/*
 * The rule gains it too, so the app and the database agree about who is
 * finished. `src/lib/onboarding.js` is the mirror and
 * `test/onboarding.test.js` pins the two together.
 *
 * READ THIS BEFORE APPLYING. Every existing member with a null `home_region`
 * becomes un-onboarded the moment this runs, and the shell will send them
 * back to the form. That is a deliberate one-time interruption, not the
 * lockout of #48: since #50 the form prefills everything already answered and
 * names what is still missing, so it is one field and one tap. But it IS an
 * interruption, and how many people it touches should be known before rather
 * than discovered after:
 *
 *   -- select count(*) filter (where coalesce(btrim(home_region), '') = '') as will_be_asked,
 *   --        count(*)                                                     as onboarded_members
 *   --   from public.profiles
 *   --  where deleted_at is null
 *   --    and is_adult
 *   --    and coalesce(btrim(full_name), '') <> ''
 *   --    and affiliation is not null;
 *
 * If that first number is large and the interruption is not wanted, the
 * alternative is to drop `home_region` from this function and keep it
 * required in the form only, so new signups answer it and existing members
 * are asked the next time they edit their profile.
 */
create or replace function public.is_onboarded(p public.profiles)
returns boolean
language sql immutable
as $$
  select p.is_adult
     and coalesce(btrim(p.full_name), '')          <> ''
     and coalesce(btrim(p.display_name), '')       <> ''
     and coalesce(btrim(p.lifting_experience), '') <> ''
     and coalesce(btrim(p.major), '')              <> ''
     and coalesce(btrim(p.home_region), '')        <> ''
     and p.affiliation in ('student', 'affiliate')
     and (p.affiliation <> 'student' or p.grad_year is not null)
$$;

comment on column public.profiles.home_region is
  'Where they are from, as an area rather than an address: "Greater Pittsburgh, PA". Collected at onboarding and required there. This IS the hometown field; there is deliberately no second column holding the same fact.';

-- ── the directory stops showing ghosts ──────────────────────────────────────
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
  and p.deleted_at is null
  /* The ghost filter. `is_onboarded` rather than a hand-written list of
     non-null columns, because that list would drift from the real definition
     the first time it changed, and it has changed twice already: 0026 dropped
     class_year, 0031 added affiliation.

     The `(uuid)` overload, NOT the `(profiles)` one, and the difference is
     load-bearing. This view is `security_invoker`, so its body runs as the
     caller; the row-typed overload takes the whole record, which expands to
     include `email`, which `authenticated` may not read — and the whole view
     then fails for everybody with `permission denied for table profiles`.
     That is the third appearance of this trap, after the 0015-to-0020 outage
     and `profiles_with_status` in 0026. The `(uuid)` overload is
     SECURITY DEFINER and reads the row itself. */
  and public.is_onboarded(p.id);

grant select on public.member_directory to authenticated;

comment on view public.member_directory is
  'The Network directory. Excludes accounts that have not finished onboarding: Supabase creates a profile the moment somebody completes OAuth, and one who closed the tab afterwards is a blank card, not a member.';

-- ── the admin table can SEE ghosts, and say so ──────────────────────────────
/* Not filtered, deliberately: an admin who cannot see a ghost account cannot
   delete one. `create or replace` cannot widen a RETURNS TABLE. */
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
  academic_level public.academic_level, is_alumni_effective boolean,
  onboarded boolean, affiliation text
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
                and p.grad_year < public.academic_year_of(now()))) as is_alumni_effective,
           public.is_onboarded(p) as onboarded,
           p.affiliation
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

-- ── the popup learns the two things it was missing ──────────────────────────
/* It already returned home_region, grad_year, club and university. Adding the
   academic level completes the line the roster prints, so the popup and the
   roster say the same thing about the same person. */
drop function if exists public.get_public_profile(uuid);

create function public.get_public_profile(target uuid)
returns table (
  id uuid,
  display_name text,
  role public.user_role,
  club_id uuid,
  club_name text,
  university_name text,
  university_short_name text,
  grad_year int,
  academic_level public.academic_level,
  is_verified boolean,
  club_role public.membership_role,
  org_roles public.org_role[],
  experience_phase text,
  division text,
  home_region text,
  instagram_handle text,
  tiktok_handle text,
  is_alumni boolean,
  vetted_coach boolean,
  credentials public.credential[]
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_approved() then
    raise exception 'Sign in to view a profile.' using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id,
           p.display_name,
           p.role,
           am.club_id,
           c.name,
           u.name,
           coalesce(u.short_name, u.name),
           coalesce(p.grad_year::int, am.grad_year),
           p.academic_level,
           coalesce(am.is_verified, false),
           am.role,
           coalesce((select array_agg(o.role order by o.role)
                       from public.org_roles o where o.user_id = p.id), '{}'),
           p.experience_phase,
           p.division,
           p.home_region,
           p.instagram_handle,
           p.tiktok_handle,
           (p.is_alumni
            or (p.grad_year is not null
                and p.grad_year < public.academic_year_of(now()))),
           p.verified,
           p.credentials
      from public.profiles p
      left join public.active_memberships am on am.user_id = p.id
      left join public.clubs c        on c.id = am.club_id
      left join public.universities u on u.id = am.university_id
     where p.id = target
       and p.deleted_at is null
       and p.status = 'approved';
end;
$$;

revoke execute on function public.get_public_profile(uuid) from anon;
grant execute on function public.get_public_profile(uuid) to authenticated;

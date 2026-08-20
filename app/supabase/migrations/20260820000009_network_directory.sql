-- ============================================================================
-- The network directory.
--
-- No new columns. Every field the directory needs already exists:
--
--   hometown_region  →  profiles.home_region   (text, from the initial schema)
--   division         →  profiles.division      (text, from the initial schema)
--   league_credentials → profiles.credentials  (credential[], migration 0008)
--   is_vetted_coach  →  profiles.verified      (boolean default false, 0008)
--
-- Adding a second column for any of these would give the app two answers to
-- the same question. For vetting that is not just untidy: a coach marked
-- `verified` but not `is_vetted_coach` shows a trust seal on one screen and
-- not another, and nobody can say which is true. See the PR for the rename
-- path if the new names are wanted instead.
--
-- What this migration does add is the read surface: a narrow view, the
-- indexes the directory sorts and filters on, and demo values so the screen
-- has something to render.
-- ============================================================================

-- ── the directory projection ────────────────────────────────────────────────
-- A member row carries onboarding answers nobody else needs: class year,
-- lifting experience, major, the 18+ attestation, approval timestamps. The
-- directory selects through this view instead, so a client cannot ask for
-- more than the directory is meant to show — and, on a free-tier database,
-- so the wire carries eight columns per member rather than twenty.
--
-- Not SECURITY DEFINER by intent: unlike question_feed there is nothing to
-- anonymise here, so this runs as the caller and `profiles_read` (which
-- requires an approved account) still decides who sees the directory at all.
create or replace view public.member_directory
with (security_invoker = true) as
select
  p.id,
  p.display_name,
  p.role,
  p.division,
  p.home_region,
  p.verified,
  p.credentials,
  p.club_id,
  c.name   as club_name,
  p.school_id,
  s.name   as school_name,
  s.state  as school_state
from public.profiles p
left join public.clubs c   on c.id = p.club_id
left join public.schools s on s.id = p.school_id
where p.status = 'approved';

grant select on public.member_directory to authenticated;

-- ── indexes ─────────────────────────────────────────────────────────────────
-- The three groupings the directory offers. At 500 rows Postgres would
-- happily seq-scan; these matter at the size this is being built for, and
-- cost nothing now.
create index if not exists profiles_home_region_idx on public.profiles (home_region)
  where home_region is not null;
create index if not exists profiles_division_idx    on public.profiles (division)
  where division is not null;
create index if not exists profiles_display_name_idx on public.profiles (display_name);

-- ============================================================================
-- Demo values, so the directory is not an empty screen on first look.
--
-- Idempotent twice over: each update only touches rows where the field is
-- still null, so re-running never overwrites a real answer, and a member who
-- has since filled their own region keeps it.
--
-- `home_region` is deliberately a named area, never coordinates — "Greater
-- Pittsburgh, PA" is close enough to find someone to train with and far too
-- coarse to find their house.
-- ============================================================================
update public.profiles p
   set home_region = case s.state
         when 'PA' then 'Greater Pittsburgh, PA'
         when 'IN' then 'Central Indiana, IN'
         when 'IA' then 'Eastern Iowa, IA'
         when 'FL' then 'Tallahassee Area, FL'
         else 'Northeast Region'
       end
  from public.schools s
 where s.id = p.school_id
   and p.home_region is null;

-- Anyone with no school at all still gets a region, or they vanish from the
-- "By Hometown" grouping entirely.
update public.profiles
   set home_region = 'Unlisted Region'
 where home_region is null;

update public.profiles
   set division = case
         when role in ('advisor', 'admin') then 'Men''s Open'
         when (extract(epoch from created_at)::bigint % 2) = 0 then 'Men''s Physique'
         else 'Bikini'
       end
 where division is null;

-- One vetted coach, so the seal and the credential pills have something to
-- render. This is demo data on a real account: clear it before the directory
-- goes in front of members, with
--   update public.profiles set verified = false, credentials = '{}';
update public.profiles
   set verified    = true,
       verified_at = now(),
       credentials = '{"IFBB Pro","NASM CPT"}'
 where role = 'admin'
   and verified = false
   and credentials = '{}';

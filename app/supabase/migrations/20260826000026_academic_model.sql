-- ============================================================================
-- The academic model: a graduation year, an academic level, and one honest
-- flag saying which of the two we actually know.
--
-- `class_year` is free text holding a relative standing ("Junior"). It answers
-- "where are you now" and goes stale on its own every August without anybody
-- editing it, which is the whole problem: a roster full of Juniors is a roster
-- that was accurate once.
--
-- A graduation year does not go stale. It is also, crucially, **already
-- collected**: `club_memberships.grad_year` has held an integer since the
-- membership model landed, because onboarding asks for it. So most of this
-- backfill is a copy, not a guess, and the rows that are a guess say so.
--
--   grad_year           smallint. When they finish.
--   academic_level      undergrad / masters / phd / graduate_other /
--                       faculty_staff. What kind of student, which a year
--                       alone cannot tell you.
--   grad_year_inferred  true only where the year was projected from a relative
--                       standing. A projected year is a guess and the admin UI
--                       has to be able to ask somebody to confirm it.
--
-- `class_year` is deprecated here and dropped in a later migration, after the
-- UI has shipped and been verified. Dropping a column in the same migration
-- that stops writing it leaves no way back if the backfill was wrong.
-- ============================================================================

-- ── the academic year ───────────────────────────────────────────────────────
/*
 * Which academic year a moment falls in, named by the year it ENDS.
 *
 * August is the boundary, not January. A student who is a senior in September
 * 2026 graduates in 2027, and a calendar-year rollover would call them a 2026
 * graduate for four months. Everything that reasons about standing goes
 * through this: the backfill below, the alumni view, and the year range the
 * UI offers. `src/lib/academicYear.js` is the same function in JavaScript, and
 * `test/academicYear.test.js` pins the two together.
 *
 * STABLE rather than IMMUTABLE: `extract(month from ...)` on a timestamptz
 * depends on the session TimeZone, so it is not immutable and must not be put
 * in an index or a CHECK.
 */
create or replace function public.academic_year_of(at_time timestamptz)
returns int
language sql stable
as $$
  select (extract(year from at_time)::int
          + case when extract(month from at_time)::int >= 8 then 1 else 0 end)
$$;

comment on function public.academic_year_of(timestamptz) is
  'The academic year containing this moment, named by the year it ends. August is the boundary: September 2026 is academic year 2027.';

-- ── the enum ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where t.typname = 'academic_level' and n.nspname = 'public') then
    create type public.academic_level as enum
      ('undergrad', 'masters', 'phd', 'graduate_other', 'faculty_staff');
  end if;
end $$;

-- ── the columns ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists grad_year          smallint,
  add column if not exists academic_level     public.academic_level,
  add column if not exists grad_year_inferred boolean not null default false;

comment on column public.profiles.grad_year is
  'The academic year they finish, named by the year it ends. Null is valid: not everybody on this app is a student.';
comment on column public.profiles.academic_level is
  'What kind of student. A year alone cannot distinguish a senior from a second-year PhD.';
comment on column public.profiles.grad_year_inferred is
  'True only where grad_year was projected from a relative standing rather than stated. A projected year is a guess and the admin UI prompts to confirm it.';

/* Static bounds, because a CHECK must be immutable and `academic_year_of` is
   not. The job here is catching a mistyped 20264, not policing plausibility,
   so the ceiling is deliberately far out: a range that the year dropdown could
   ever reach the edge of is a form that fails on submit, and the unit test
   `every offered year is inside the CHECK constraint` found exactly that when
   the ceiling was 2100. GRAD_YEAR_MIN and GRAD_YEAR_MAX in
   `src/lib/academicYear.js` mirror these two numbers. */
alter table public.profiles drop constraint if exists profiles_grad_year_range;
alter table public.profiles
  add constraint profiles_grad_year_range
  check (grad_year is null or (grad_year >= 1960 and grad_year <= 2200));

/* Nothing is "inferred" without a year to have inferred. */
alter table public.profiles drop constraint if exists profiles_grad_year_inferred_check;
alter table public.profiles
  add constraint profiles_grad_year_inferred_check
  check (not grad_year_inferred or grad_year is not null);

-- ── the projection, for rows with no membership year ────────────────────────
/*
 * A relative standing turned into a graduation year, anchored on the academic
 * year rather than the calendar one.
 *
 * A senior in the current academic year finishes in it, so they map to the
 * academic year itself and each step below adds a year. "Graduate student"
 * gets two, which is the median taught masters and is openly a guess: every
 * row this touches is flagged `grad_year_inferred`.
 *
 * "Not a student" returns null on purpose. It is not a standing, and inventing
 * a graduation year for somebody who is not enrolled is worse than an empty
 * field, which at least prompts somebody to fill it in.
 */
create or replace function public.project_grad_year(standing text, at_time timestamptz)
returns smallint
language sql stable
as $$
  select case lower(btrim(coalesce(standing, '')))
    when 'freshman'             then (public.academic_year_of(at_time) + 3)::smallint
    when 'sophomore'            then (public.academic_year_of(at_time) + 2)::smallint
    when 'junior'               then (public.academic_year_of(at_time) + 1)::smallint
    when 'senior'               then (public.academic_year_of(at_time))::smallint
    when 'fifth year or beyond' then (public.academic_year_of(at_time))::smallint
    when 'graduate student'     then (public.academic_year_of(at_time) + 2)::smallint
    else null
  end
$$;

comment on function public.project_grad_year(text, timestamptz) is
  'A relative standing projected onto an academic graduation year. Every row it fills is flagged grad_year_inferred, because this is a guess.';

/* The standing to level mapping, which is a different question and mostly
   knowable. "Not a student" gives null rather than faculty_staff: not being
   enrolled does not make somebody staff. */
create or replace function public.level_of_standing(standing text)
returns public.academic_level
language sql immutable
as $$
  select case lower(btrim(coalesce(standing, '')))
    when 'freshman'             then 'undergrad'
    when 'sophomore'            then 'undergrad'
    when 'junior'               then 'undergrad'
    when 'senior'               then 'undergrad'
    when 'fifth year or beyond' then 'undergrad'
    when 'graduate student'     then 'graduate_other'
    else null
  end::public.academic_level
$$;

-- ── the backfill ────────────────────────────────────────────────────────────
/*
 * Two passes, and the order matters: the stated year wins over the projected
 * one everywhere both exist.
 *
 * DRY RUN. Run these before the updates to see the split, and put the counts
 * in the commit message:
 *
 *   -- how many rows each pass will touch
 *   -- select
 *   --   count(*) filter (where m.grad_year is not null)                        as from_membership,
 *   --   count(*) filter (where m.grad_year is null
 *   --                      and public.project_grad_year(p.class_year, now()) is not null) as projected,
 *   --   count(*) filter (where m.grad_year is null
 *   --                      and public.project_grad_year(p.class_year, now()) is null)     as left_null,
 *   --   count(*)                                                              as total
 *   -- from public.profiles p
 *   -- left join lateral (
 *   --   select cm.grad_year from public.club_memberships cm
 *   --    where cm.user_id = p.id and cm.grad_year is not null
 *   --    order by (cm.status = 'active') desc, cm.created_at desc limit 1
 *   -- ) m on true
 *   -- where p.deleted_at is null;
 *
 *   -- the distinct standings actually present, so a value nobody anticipated
 *   -- shows up as `left_null` above rather than silently
 *   -- select coalesce(class_year, '(null)') as standing, count(*)
 *   --   from public.profiles group by 1 order by 2 desc;
 */

-- Pass 1: the stated year. Not inferred, because somebody typed it.
with stated as (
  select p.id, m.grad_year
    from public.profiles p
    join lateral (
      select cm.grad_year
        from public.club_memberships cm
       where cm.user_id = p.id
         and cm.grad_year is not null
       /* An active membership is the current truth; failing that, the most
          recent application. A member who transferred has two rows and the
          live one is the one that counts. */
       order by (cm.status = 'active') desc, cm.created_at desc
       limit 1
    ) m on true
   where p.grad_year is null
)
update public.profiles p
   set grad_year = stated.grad_year::smallint,
       grad_year_inferred = false
  from stated
 where p.id = stated.id
   and stated.grad_year between 1960 and 2200;

-- Pass 2: the projection, only where pass 1 found nothing.
update public.profiles p
   set grad_year = public.project_grad_year(p.class_year, now()),
       grad_year_inferred = true
 where p.grad_year is null
   and public.project_grad_year(p.class_year, now()) is not null;

-- Level, independent of either pass: it comes from the standing, not the year.
update public.profiles p
   set academic_level = public.level_of_standing(p.class_year)
 where p.academic_level is null
   and public.level_of_standing(p.class_year) is not null;

-- ── deprecate, do not drop ──────────────────────────────────────────────────
comment on column public.profiles.class_year is
  'DEPRECATED as of 20260826000026. Free text holding a relative standing, which goes stale every August without anybody editing it. Superseded by grad_year and academic_level. Still written by nothing and read only by legacy surfaces; drop in a later migration once the UI has shipped and been verified.';

-- ── privileges ──────────────────────────────────────────────────────────────
/* `profiles` has column-level privileges, so a column added here starts with
   NO grant to `authenticated` and selecting it fails the whole statement. That
   is the exact fault that took the app down between 0015 and 0020. Three new
   columns, so this call is not optional. */
select public.reapply_column_privileges();

-- ── who is an alumnus, derived rather than remembered ───────────────────────
/*
 * `is_alumni` is a boolean somebody has to remember to set. Nobody does. It is
 * still authoritative when set, because an admin marking somebody an alumnus
 * early (they left, they transferred, they graduated in December) is a fact
 * this cannot derive.
 *
 * So `is_alumni_effective` is the OR of the two: the flag if it is set, and
 * otherwise whether their graduation year has passed. The August anchor is the
 * whole point. A 2027 graduate is a member for the whole of academic year
 * 2027 and an alumnus from August 2027, which is when they actually leave.
 *
 * A view rather than a generated column, because it depends on `now()` and a
 * stored value would be wrong the morning after it was written.
 *
 * `security_invoker` so the view is not a way around the policies on
 * `profiles`. Without it a view owned by the migration runner would return
 * rows the caller is not allowed to see.
 */
drop view if exists public.profiles_with_status;

/*
 * An explicit column list, not `p.*`, and the reason is not style.
 *
 * `profiles` has column-level privileges: `authenticated` may read every
 * column except `email`. With `security_invoker`, the view's own body runs as
 * the caller, so a `p.*` that expands to include `email` makes the whole view
 * unreadable by everybody, with `permission denied for table profiles` and no
 * hint that one column is at fault. That is the same failure that took the app
 * down between 0015 and 0020, wearing a different hat.
 *
 * So the list is deliberate, and `email` is absent by construction rather than
 * by a grant somebody has to remember to re-apply. A column added to
 * `profiles` later does not appear here until a migration adds it, which is a
 * visible gap rather than a silent leak.
 */
create view public.profiles_with_status
with (security_invoker = true) as
select
  p.id,
  p.display_name,
  p.full_name,
  p.role,
  p.status,
  p.club_id,
  p.school_id,
  p.division,
  p.home_region,
  p.major,
  p.lifting_experience,
  p.experience_phase,
  p.verified,
  p.credentials,
  p.instagram_handle,
  p.tiktok_handle,
  p.class_year,
  p.grad_year,
  p.grad_year_inferred,
  p.academic_level,
  p.is_alumni,
  p.alumni_since,
  p.created_at,
  p.deleted_at,
  public.academic_year_of(now()) as current_academic_year,
  (
    p.is_alumni
    or (p.grad_year is not null and p.grad_year < public.academic_year_of(now()))
  ) as is_alumni_effective,
  /* Why, so a surface can say "graduated 2026" rather than just greying the
     row out, and so an admin can tell a derived alumnus from a marked one. */
  case
    when p.is_alumni then 'marked'
    when p.grad_year is not null and p.grad_year < public.academic_year_of(now()) then 'graduated'
    else null
  end as alumni_reason
from public.profiles p;

comment on view public.profiles_with_status is
  'profiles plus is_alumni_effective: the stored flag OR a graduation year that has passed, anchored on the August academic year. Derived rather than stored, because a stored answer is wrong the morning after it is written. email is absent by construction.';

grant select on public.profiles_with_status to authenticated;

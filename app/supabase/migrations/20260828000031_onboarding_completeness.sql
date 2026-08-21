-- ============================================================================
-- What "finished signing up" means, updated for the academic model, and one
-- new question that the form has always needed and never asked.
--
-- Two changes.
--
-- 1. `is_onboarded` still required `class_year`, which migration 0026
--    deprecated. Nothing writes it now, so every account created after this
--    point would be permanently unfinished: trapped in onboarding, with the
--    form no longer offering the field that would release them. The
--    requirement moves to `grad_year`, which is what the form now collects.
--
-- 2. `affiliation`: student, or not.
--
--    Onboarding assumes everybody is a student at a university with a chapter,
--    so a coaching advisor or a member of staff signing up has exactly one
--    path through the form, and it applies them to a club they are not a
--    student at. Their application then sits in a club lead's queue, for a
--    person that lead has no way to place. Migration 0015's whole point was
--    that org roles and club membership are separate concerns; this is the
--    front door still conflating them.
--
--    Note what this column is NOT. It is not a role, and it does not grant
--    anything. `profiles.role` is derived from `org_roles` and
--    `club_memberships` by `derived_role()`, and `guard_profile_privileges`
--    refuses a direct write to it. An affiliate is somebody who said they are
--    not a student; they become an advisor when an admin grants them an
--    org role, and not one moment sooner.
-- ============================================================================
alter table public.profiles
  add column if not exists affiliation text
    check (affiliation is null or affiliation in ('student', 'affiliate'));

comment on column public.profiles.affiliation is
  'What the member said they are: a student, or somebody otherwise involved (coach, advisor, staff, alum). NOT a role and not a grant: role is derived from org_roles and club_memberships, and an affiliate has no standing anywhere until an admin gives them one.';

/*
 * DRY RUN. Everybody already signed up predates this question, so they will
 * all be null and all be trapped in onboarding unless they are backfilled.
 * Check the size of that before running the backfill below:
 *
 *   -- select count(*) filter (where affiliation is null)              as needs_backfill,
 *   --        count(*) filter (where affiliation is null
 *   --                           and exists (select 1 from public.club_memberships m
 *   --                                        where m.user_id = profiles.id))    as has_membership,
 *   --        count(*) filter (where affiliation is null
 *   --                           and exists (select 1 from public.org_roles o
 *   --                                        where o.user_id = profiles.id))    as has_org_role,
 *   --        count(*)                                                 as total
 *   --   from public.profiles where deleted_at is null;
 */

/* Anybody with a membership is a student; anybody with only an org role is an
   affiliate. Everybody else defaults to student, which is what they answered
   implicitly by completing a form that had no other option. Nobody is trapped
   by a question that did not exist when they signed up.

   Deliberately BEFORE the redefinition below, so `is_onboarded(p)` here is
   still the OLD rule. The filter therefore means "everybody who was finished
   under the rules they actually signed up under", which is exactly the set
   that must stay finished. Running it after would filter on the new rule,
   which nobody satisfies yet, and backfill nobody. */
update public.profiles p
   set affiliation = case
     when exists (select 1 from public.club_memberships m where m.user_id = p.id) then 'student'
     when exists (select 1 from public.org_roles o where o.user_id = p.id) then 'affiliate'
     else 'student'
   end
 where p.affiliation is null
   and public.is_onboarded(p);

-- ── the definition ──────────────────────────────────────────────────────────
/*
 * A graduation year is required of students and not of affiliates, because a
 * coach does not have one and demanding a fake year is how a field stops
 * meaning anything.
 *
 * Still `immutable`, so it can still be used in an index or a generated
 * column. That rules out reading any other table from in here, which is why
 * the affiliation had to become a column on `profiles` rather than something
 * derived from a membership at read time.
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
     and p.affiliation in ('student', 'affiliate')
     and (p.affiliation <> 'student' or p.grad_year is not null)
$$;

comment on function public.is_onboarded(public.profiles) is
  'Whether a profile is finished. Mirrored in src/lib/onboarding.js; test/onboarding.test.js pins the two together. class_year is deliberately absent: migration 0026 deprecated it and nothing writes it, so requiring it would trap every new account permanently.';

select public.reapply_column_privileges();

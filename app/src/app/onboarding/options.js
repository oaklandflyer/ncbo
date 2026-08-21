/**
 * The onboarding vocabularies.
 *
 * A plain module on purpose: these used to live in actions.js, but a
 * 'use server' file may only export async functions. Everything else is
 * rewritten into a server reference, so the client got a function-shaped stub
 * instead of an array and the form crashed on CLASS_YEARS.map at render time.
 * The build never noticed — it isn't a type error, just an invalid export.
 *
 * Imported by both the form (to draw the options) and the action (to check
 * what comes back), so the two cannot drift.
 */
/*
 * RETIRED. `CLASS_YEARS` fed the relative-standing select that migration 0026
 * deprecated: a standing goes stale every August without anybody editing it,
 * so the form asks for a graduation year instead and academic level is a
 * profile edit. `project_grad_year()` in that migration still knows these
 * strings, because it has to read the rows this list created.
 */

export const EXPERIENCE = [
  'Under a year', '1–2 years', '3–5 years', '5+ years',
];

/*
 * RETIRED. `GRAD_YEARS` built its window from the CALENDAR year, which put the
 * current cohort at the bottom of the list every September. `gradYearOptions`
 * in `src/lib/academicYear.js` replaces it: same window, anchored on the
 * academic year, and clamped to the range the CHECK constraint accepts.
 */

/**
 * Where the group chat actually is. Three options, because a lead recognising
 * an applicant needs to know which app to look in — "@jordan" is ambiguous
 * across three services and useless in the wrong one.
 */
export const CHAT_PLATFORMS = ['GroupMe', 'Discord', 'Instagram'];

/** How somebody found the club. Kept short; the value is in it being countable. */
export const FOUND_VIA = [
  'A friend or teammate',
  'The club group chat',
  'Instagram',
  'An activities fair',
  'A flyer on campus',
  'A coach or advisor',
  'Searched for it',
  'Somewhere else',
];

/**
 * What somebody says they are, at signup.
 *
 * Two options, and neither is a role. `profiles.role` is derived from
 * `org_roles` and `club_memberships` by `derived_role()`, and
 * `guard_profile_privileges` refuses a direct write to it, so a role picker
 * here would be a claim anybody could make that the database would then
 * overwrite. Worse than useless: it would look like it worked.
 *
 * This asks the question the routing actually needs, which is whether to put
 * somebody in front of a club lead. An affiliate becomes an advisor when an
 * admin grants them an org role, and not one moment sooner.
 */
export const AFFILIATION_CHOICES = [
  ['student', 'I am a student', 'Undergraduate or graduate, at the school you pick below.'],
  ['affiliate', 'Something else', 'Coach, advisor, staff, or an alum staying involved. You will not be applied to a club.'],
];

export const AFFILIATIONS = AFFILIATION_CHOICES.map(([v]) => v);

/**
 * The academic year, in JavaScript, matching `public.academic_year_of()`
 * exactly.
 *
 * Two copies of one rule is a risk, and the alternative is worse: the year
 * dropdown would have to ask the database what year it is before it could
 * draw itself. So the rule is written twice and `test/academicYear.test.js`
 * pins this copy to the SQL one, case for case, including the August boundary
 * both sides turn on.
 *
 * August, not January. A student who is a senior in September 2026 graduates
 * in 2027; a calendar-year rollover calls them a 2026 graduate for four
 * months, which is wrong on every roster that prints it.
 */
export function academicYearOf(at = new Date()) {
  const d = at instanceof Date ? at : new Date(at);
  /* getMonth() is zero-based, so 7 is August. */
  return d.getFullYear() + (d.getMonth() >= 7 ? 1 : 0);
}

/**
 * The bounds of `profiles_grad_year_range`, mirrored from migration 0026.
 *
 * A form that offers a year the database refuses is a form that fails on
 * submit, so the option list is clamped to these rather than trusted to stay
 * inside them. The unit test caught the un-clamped version reaching 2106.
 */
export const GRAD_YEAR_MIN = 1960;
export const GRAD_YEAR_MAX = 2200;

/**
 * The graduation years a form offers.
 *
 * A window rather than a free number: a club lead uses this to sanity-check an
 * applicant against their own roster, and "2047" helps nobody do that. One
 * year back so somebody who has just finished can still say so, six forward
 * to cover a first-year starting a long programme.
 *
 * Anchored on the academic year for the same reason everything else here is:
 * in September the useful range has already moved on, and offering the
 * calendar year would put the current cohort at the bottom of the list.
 */
export function gradYearOptions(at = new Date()) {
  const current = academicYearOf(at);
  return Array.from({ length: 8 }, (_, i) => current - 1 + i)
    .filter((y) => y >= GRAD_YEAR_MIN && y <= GRAD_YEAR_MAX);
}

/**
 * The levels, and how they are written on screen.
 *
 * Ordered as somebody progresses rather than alphabetically, so the list reads
 * as a path. `faculty_staff` is last because it is not a step on it.
 */
export const ACADEMIC_LEVELS = [
  ['undergrad', 'Undergraduate'],
  ['masters', "Master's"],
  ['phd', 'PhD'],
  ['graduate_other', 'Other graduate'],
  ['faculty_staff', 'Faculty or staff'],
];

export function academicLevelLabel(value) {
  return ACADEMIC_LEVELS.find(([v]) => v === value)?.[1] || null;
}

/**
 * "Class of 2027 · Undergraduate", or as much of it as is known.
 *
 * One function, because three surfaces print this and three near-identical
 * template literals is how they drift apart.
 */
export function academicLine(person) {
  const year = person?.grad_year;
  const level = academicLevelLabel(person?.academic_level);
  const parts = [];
  if (year) parts.push(`Class of ${year}`);
  if (level) parts.push(level);
  return parts.join(' · ') || null;
}

const LEVEL_VALUES = ACADEMIC_LEVELS.map(([v]) => v);

/**
 * The two academic fields out of a submitted form, validated.
 *
 * Shared by all three write surfaces, because three copies of "parse a year,
 * check the range, check the enum" is three chances to disagree about what an
 * empty string means. Empty means "not stated" and clears the column; it never
 * means zero and never means a guess.
 *
 * Setting a year by hand always clears `grad_year_inferred`. Somebody choosing
 * a year from a dropdown has stated it, which is the entire distinction that
 * flag exists to record.
 */
export function parseAcademic(formData) {
  const rawYear = String(formData.get('grad_year') ?? '').trim();
  const rawLevel = String(formData.get('academic_level') ?? '').trim();

  if (rawLevel && !LEVEL_VALUES.includes(rawLevel)) {
    return { error: 'Pick an academic level from the list.', focus: 'academic_level' };
  }

  if (!rawYear) {
    return { patch: { grad_year: null, grad_year_inferred: false, academic_level: rawLevel || null } };
  }

  const year = Number(rawYear);
  if (!Number.isInteger(year) || year < GRAD_YEAR_MIN || year > GRAD_YEAR_MAX) {
    return { error: 'Pick a graduation year from the list.', focus: 'grad_year' };
  }

  return { patch: { grad_year: year, grad_year_inferred: false, academic_level: rawLevel || null } };
}

/**
 * Whether somebody is an alumnus, mirroring `profiles_with_status`.
 *
 * Used by exactly one surface: the profile page, which reads `profiles`
 * through `getProfileResult` with PostgREST embeds a view cannot carry. Every
 * other surface gets `is_alumni_effective` computed in SQL, because four
 * components each deciding this is how four surfaces come to disagree.
 *
 * The stored flag wins when set, because an admin marking somebody an alumnus
 * early (they left, they transferred, they finished in December) is a fact
 * this cannot derive.
 */
export function isAlumniEffective(person, at = new Date()) {
  if (person?.is_alumni) return true;
  const year = person?.grad_year;
  return year != null && Number(year) < academicYearOf(at);
}

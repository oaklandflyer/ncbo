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
export const CLASS_YEARS = [
  'Freshman', 'Sophomore', 'Junior', 'Senior', 'Fifth year or beyond',
  'Graduate student', 'Not a student',
];

export const EXPERIENCE = [
  'Under a year', '1–2 years', '3–5 years', '5+ years',
];

/**
 * The graduation years offered. A window rather than a free number: the club
 * lead uses this to sanity-check an applicant against their own roster, and
 * "2047" helps nobody do that.
 */
export const GRAD_YEARS = (() => {
  const now = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => String(now + i - 1));
})();

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

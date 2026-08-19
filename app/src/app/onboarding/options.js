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

/**
 * Is this profile finished?
 *
 * One definition, imported by the shell, the onboarding page and the action,
 * so there is no way for them to disagree about who gets sent where. Mirrors
 * `public.is_onboarded(public.profiles)` in
 * `app/supabase/migrations/20260828000031_onboarding_completeness.sql`, and
 * `test/onboarding.test.js` pins the two together case by case.
 *
 * Fails closed: a null profile, a missing column, or an unticked attestation
 * all count as not onboarded.
 *
 * `class_year` used to be in here and is deliberately gone. Migration 0026
 * deprecated it and nothing writes it any more, so leaving it required would
 * trap every account created from that point on: sent to onboarding forever,
 * by a form that no longer offers the field that would release them.
 */
const REQUIRED = ['full_name', 'display_name', 'lifting_experience', 'major'];

export const AFFILIATIONS = ['student', 'affiliate'];

export function isOnboarded(profile) {
  if (!profile || profile.is_adult !== true) return false;
  if (!REQUIRED.every((key) => String(profile[key] || '').trim() !== '')) return false;
  if (!AFFILIATIONS.includes(profile.affiliation)) return false;
  /* A graduation year is required of students and not of affiliates: a coach
     does not have one, and demanding a fake year is how a field stops meaning
     anything. */
  if (profile.affiliation === 'student' && profile.grad_year == null) return false;
  return true;
}

/**
 * What is still missing, for a form that has to say so.
 *
 * Returns field names, not sentences: the copy belongs on the screen that
 * renders it, and a list of keys is what a form needs to focus the right
 * input.
 */
export function missingFields(profile) {
  const missing = [];
  if (!profile) return ['everything'];
  for (const key of REQUIRED) {
    if (String(profile[key] || '').trim() === '') missing.push(key);
  }
  if (!AFFILIATIONS.includes(profile.affiliation)) missing.push('affiliation');
  if (profile.affiliation === 'student' && profile.grad_year == null) missing.push('grad_year');
  if (profile.is_adult !== true) missing.push('is_adult');
  return missing;
}

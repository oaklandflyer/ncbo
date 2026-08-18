/**
 * Is this profile finished?
 *
 * One definition, imported by the hub layout, the onboarding page and the
 * middleware, so there is no way for them to disagree about who gets sent
 * where. Mirrors `public.is_onboarded()` in
 * app/supabase/migrations/20260818000004_onboarding.sql.
 *
 * Fails closed: a null profile, a missing column, or an unticked attestation
 * all count as not onboarded.
 */
const REQUIRED = ['full_name', 'display_name', 'class_year', 'lifting_experience', 'major'];

export function isOnboarded(profile) {
  if (!profile || profile.is_adult !== true) return false;
  return REQUIRED.every((key) => String(profile[key] || '').trim() !== '');
}

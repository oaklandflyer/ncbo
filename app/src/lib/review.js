/**
 * Who may work the review queue, and over whom.
 *
 * Mirrors the policies in
 * app/supabase/migrations/20260818000007_club_lead_review.sql. The database is
 * what enforces this; these helpers decide what to *draw*, so the page doesn't
 * offer a button that Postgres will refuse.
 *
 * A club lead with no school reviews nobody — not everybody.
 */
export function canReview(profile) {
  if (!profile || profile.status !== 'approved') return false;
  if (profile.role === 'admin') return true;
  return profile.role === 'club_lead' && !!profile.school_id;
}

/** An admin sees every school; a club lead sees their own. */
export function reviewScope(profile) {
  if (!profile) return { kind: 'none' };
  if (profile.role === 'admin') return { kind: 'global' };
  if (canReview(profile)) return { kind: 'school', schoolId: profile.school_id };
  return { kind: 'none' };
}

/** Role and club changes stay with admins. */
export function canManageRoles(profile) {
  return !!profile && profile.status === 'approved' && profile.role === 'admin';
}

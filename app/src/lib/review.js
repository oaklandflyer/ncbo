/**
 * Who may work a queue, and over whom.
 *
 * This module used to answer the question from `profiles.role` and
 * `profiles.school_id`, which is how it came to disagree with `viewer.js`
 * about whether a club lead could review anything. Both columns are derived
 * mirrors now, and the queue is club-scoped rather than school-scoped, so
 * every helper here takes the viewer context and reads the membership facts
 * it already fetched. There is one source of truth again.
 *
 * As before: these decide what to *draw*. The database is what enforces it.
 */

/**
 * Can this person act on an approval queue at all?
 *
 * A lead of at least one club, or an admin. An admin is included because they
 * can open any queue for support — but see `isDefaultApproverFor` below,
 * which is the question that decides who gets notified, and answers it
 * differently.
 */
export function canReview(viewer) {
  if (!viewer?.profile || viewer.profile.status !== 'approved') return false;
  return viewer.isAdmin || viewer.isClubLead;
}

/**
 * Whose applications this person sees.
 *
 * An admin sees every club; a lead sees the clubs they actually lead, which
 * is usually one. Club-scoped, not school-scoped: a university has one club,
 * so the two coincide today, and the club is the honest unit.
 */
export function reviewScope(viewer) {
  if (!viewer) return { kind: 'none' };
  if (viewer.isAdmin) return { kind: 'global' };
  if (viewer.isClubLead) return { kind: 'clubs', clubIds: viewer.ledClubIds };
  return { kind: 'none' };
}

/**
 * Whose job is it to decide, as opposed to who is merely allowed to?
 *
 * The distinction is the whole of 2.2. An admin can open any queue, and is
 * deliberately not the default approver for any of them: being the fallback
 * is what let the old queue back up during recruiting season, because the
 * person who could act was never the person who knew the applicant.
 */
export function isDefaultApproverFor(viewer, clubId) {
  return !!viewer?.isClubLead && viewer.ledClubIds.includes(clubId);
}

/** Role and club assignment stay with admins. */
export function canManageRoles(viewer) {
  return !!viewer?.isAdmin;
}

/**
 * Who moderates questions and curates the vault.
 *
 * Mirrors `public.is_moderator()` — admins and coaching advisors. A club lead
 * reviews *applications* at their own chapter, which is a different job on a
 * different table, and the database has never conflated the two.
 */
export function isModerator(viewer) {
  return !!viewer?.canModerateContent;
}

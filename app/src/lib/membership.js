/**
 * Membership, and what it does and does not unlock.
 *
 * The one rule this module exists to hold: signing in and being a student at a
 * chapter are different facts. A person with an account may read the board,
 * the calendar and the club list; a person with a verified membership is on a
 * roster, posts in their chapter, pays the member dues rate and registers for
 * competitions.
 *
 * Mirrors the predicates in `20260822000015`. The database is what enforces
 * this; these decide what to draw, so a screen does not offer a button that
 * Postgres will refuse.
 */

/** The statuses that mean somebody is on the roster right now. */
export const ON_ROSTER = ['active'];

/** Statuses that were a membership once and are no longer current. */
export const PAST = ['alumni', 'lapsed'];

/**
 * What the gated surfaces ask for. Verified and dues-paid are checked
 * separately on purpose: a member whose dues lapse loses the gated surfaces
 * without needing a lead to vouch for them a second time.
 */
export function gates(membership) {
  const active = !!membership && membership.status === 'active';
  const verified = active && !!membership.verified_at;
  const paid = active && membership.dues_current === true;

  return {
    /* Open to anyone with an account. Listed here rather than assumed, so
       that a later change has to argue with a name instead of a boolean. */
    browseContent: true,
    viewCalendar: true,
    readQA: true,
    discoverClubs: true,

    onRoster: verified,
    postInChapter: verified,
    memberDuesRate: verified,
    registerForCompetition: verified && paid,
  };
}

/** Chapter names read as "Pitt", not "University of Pittsburgh". */
export function chapterName(row) {
  if (!row) return null;
  return row.university_short_name || row.short_name || row.university_name || row.school_name || null;
}

/**
 * What to call somebody's affiliation on screen. "Independent" is the honest
 * answer for an org-role holder or a student whose school has no chapter, and
 * it is a real state rather than a blank.
 */
export function affiliationLabel(row) {
  return chapterName(row) || 'Independent';
}

export function clubRoleLabel(role) {
  if (role === 'club_lead') return 'Club lead';
  if (role === 'co_lead') return 'Co-lead';
  return 'Member';
}

export function orgRoleLabel(role) {
  return {
    admin: 'Admin',
    exec_board: 'Exec board',
    coaching_advisor: 'Coaching advisor',
    board_of_directors: 'Board of directors',
  }[role] || role;
}

/** Only the badges a member should see on somebody else's card. */
export function badgesFor({ club_role: clubRole, org_roles: orgRoles = [] }) {
  const badges = [];
  if (clubRole === 'club_lead' || clubRole === 'co_lead') badges.push(clubRoleLabel(clubRole));
  (orgRoles || []).forEach((r) => {
    if (r !== 'admin') badges.push(orgRoleLabel(r));
  });
  return badges;
}

export const EXPERIENCE_PHASES = [
  {
    value: 'new_to_lifting',
    label: 'New to lifting',
    blurb: 'You want to know when the club meets and who to show up with.',
  },
  {
    value: 'new_to_bodybuilding',
    label: 'Lifting already, new to bodybuilding',
    blurb: 'You want to know how prep works and what division you are.',
  },
  {
    value: 'competing',
    label: 'Competed, or prepping now',
    blurb: 'You want the calendar, results, and who else is prepping.',
  },
];

export function phaseLabel(value) {
  return EXPERIENCE_PHASES.find((p) => p.value === value)?.label || null;
}

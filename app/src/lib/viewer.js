import { createClient, getProfileResult } from '@/lib/supabase/server';

/**
 * One answer to "who is asking, and what may they do".
 *
 * Every page and every server action reads this rather than re-deriving the
 * question from `profile.role` — which is how the layout ended up disagreeing
 * with the pages about whether a club lead could review anything.
 *
 * Since the membership model landed, the shape of the answer changed in one
 * important way: **club standing and organisation standing are read from
 * different tables and never substituted for each other.**
 *
 *   membership  — a `club_memberships` row. What puts somebody on a roster,
 *                 and the only thing that does.
 *   orgRoles    — an `org_roles` row. Admin, exec, coaching advisor, board.
 *                 Never club membership, however senior.
 *
 * An admin with no membership leads nothing and is on no roster. An admin who
 * is genuinely a student at Pitt is a Pitt member because of the membership,
 * not because of the org role.
 *
 * It decides what to *draw* and what an action should refuse early. The
 * guarantee is RLS and the two guard triggers; a caller who forged their way
 * past this still meets Postgres.
 */
const EMPTY = {
  signedIn: false, profileError: null,
  userId: null, role: null, profile: null,
  membership: null, memberships: [], pendingMembership: null,
  orgRoles: [], ledClubIds: [], ledClubs: [], ledSchoolIds: [],
  isAdmin: false, isClubLead: false, isVerifiedMember: false,
  canModerateContent: false, canManageUsers: false,
  canManageClub: () => false, canSeeQueueFor: () => false,
};

export async function getViewerContext(supabaseArg) {
  const supabase = supabaseArg || await createClient();
  const { signedIn, profile, error: profileError } = await getProfileResult(supabase);

  /* `signedIn` and `profile` are separate answers on purpose. A signed-in
     member whose profile could not be read is not signed out, and treating
     them as though they were is what turned a stale schema into an
     unexplained redirect loop at the sign-in page. */
  if (!profile) return { ...EMPTY, signedIn, profileError };

  /* Three reads rather than one join: PostgREST would embed these, but the
     membership row carries columns an ordinary member is not granted, and a
     failed embed is harder to reason about than three explicit selects. */
  const [{ data: membershipRows }, { data: orgRoleRows }, { data: legacyLeadRows }] =
    await Promise.all([
      supabase
        .from('club_memberships')
        .select('id, club_id, university_id, status, role, verified_at, grad_year, created_at, clubs(name), universities(name, short_name)')
        .eq('user_id', profile.id),
      supabase.from('org_roles').select('role').eq('user_id', profile.id),
      /* `club_leads` still names people who have not signed up yet, so it
         cannot be folded into memberships. `my_led_clubs()` unions both in
         the database; this mirrors that, or the UI would hide a queue the
         policies would happily have served. */
      supabase.from('club_leads').select('club_id, clubs(name, university_id)').eq('profile_id', profile.id),
    ]);

  const memberships = membershipRows || [];
  const orgRoles = (orgRoleRows || []).map((r) => r.role);
  const accountLive = profile.status === 'approved';

  const active = memberships.find((m) => m.status === 'active') || null;
  const pending = memberships.find((m) => m.status === 'pending') || null;

  const membership = active && {
    id: active.id,
    clubId: active.club_id,
    clubName: active.clubs?.name || null,
    universityId: active.university_id,
    universityName: active.universities?.name || null,
    shortName: active.universities?.short_name || active.universities?.name || null,
    status: active.status,
    role: active.role,
    verifiedAt: active.verified_at,
    verified: !!active.verified_at,
    gradYear: active.grad_year,
  };

  const ledFromMembership = memberships
    .filter((m) => m.status === 'active' && ['club_lead', 'co_lead'].includes(m.role))
    .map((m) => ({ id: m.club_id, name: m.clubs?.name || 'Your club', universityId: m.university_id }));

  const ledFromLegacy = (legacyLeadRows || []).map((r) => ({
    id: r.club_id,
    name: r.clubs?.name || 'Your club',
    universityId: r.clubs?.university_id || null,
  }));

  const ledClubs = [...ledFromMembership, ...ledFromLegacy]
    .filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i);
  const ledClubIds = ledClubs.map((c) => c.id);

  const isAdmin = accountLive && orgRoles.includes('admin');
  const isClubLead = accountLive && ledClubIds.length > 0;

  return {
    signedIn: true,
    profileError: null,
    userId: profile.id,
    role: profile.role,
    profile,

    membership,
    memberships,
    pendingMembership: pending,
    orgRoles,

    ledClubs,
    ledClubIds,
    /* The universities behind those clubs. Kept for the pages that still
       phrase things per school. */
    ledSchoolIds: [...new Set(ledClubs.map((c) => c.universityId).filter(Boolean))],

    isAdmin,
    isClubLead,
    /* Verified is a membership fact. An admin is not a verified member of
       anywhere unless they are separately a student there. */
    isVerifiedMember: !!membership?.verified,

    /* Advisors keep content moderation — that is what the role is for. Exec
       and the board do not: running the organisation is not moderating it. */
    canModerateContent: accountLive
      && (isAdmin || orgRoles.includes('coaching_advisor')),
    /* Account management never widens past admin. */
    canManageUsers: isAdmin,

    canManageClub: (clubId) => isAdmin || (accountLive && ledClubIds.includes(clubId)),
    /* Deliberately narrower than canManageClub: an admin may *look* at any
       queue for support, and is not the default approver for any of them. */
    canSeeQueueFor: (clubId) => isAdmin || (accountLive && ledClubIds.includes(clubId)),
  };
}

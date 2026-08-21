import { createClient, getProfile } from '@/lib/supabase/server';

/**
 * One answer to "who is asking, and what may they do".
 *
 * Every page and every server action reads this rather than re-deriving the
 * question from `profile.role` — which is how the layout ended up disagreeing
 * with the pages about whether a club lead could review anything.
 *
 * It decides what to *draw* and what an action should refuse early. The
 * guarantee is RLS and `guard_profile_privileges()`; a caller who forged their
 * way past this still meets Postgres.
 *
 * The three capabilities are deliberately not the same set:
 *
 *   canModerateContent — advisor + admin. Approving and removing Q&A.
 *   canManageUsers     — admin only. Editing or removing an account.
 *   canManageClub(id)  — admin, or a lead OF THAT CLUB. Leading one club at a
 *                        school does not grant the other club at that school.
 */
export async function getViewerContext(supabaseArg) {
  const supabase = supabaseArg || await createClient();
  const profile = await getProfile(supabase);

  if (!profile) {
    return {
      userId: null, role: null, profile: null, ledClubIds: [],
      isAdmin: false, isClubLead: false, canModerateContent: false,
      canManageUsers: false, canManageClub: () => false,
    };
  }

  /* Leadership is a relation now, not a role string: `club_leads.profile_id`.
     A club_lead who leads nothing manages nothing, which is the honest
     answer — and the one the old school-based gate got wrong. */
  const { data: leadRows } = await supabase
    .from('club_leads')
    .select('club_id, clubs(name, school_id)')
    .eq('profile_id', profile.id);

  const led = leadRows || [];
  const ledClubIds = led.map((r) => r.club_id);
  const approved = profile.status === 'approved';

  const isAdmin = approved && profile.role === 'admin';
  const isClubLead = approved && profile.role === 'club_lead' && ledClubIds.length > 0;

  return {
    userId: profile.id,
    role: profile.role,
    profile,
    ledClubIds,
    ledClubs: led.map((r) => ({ id: r.club_id, name: r.clubs?.name || 'Your club' })),
    isAdmin,
    isClubLead,
    /* Advisors keep content moderation — that is what the role is for. */
    canModerateContent: approved && (profile.role === 'advisor' || profile.role === 'admin'),
    /* Account management never widens past admin. */
    canManageUsers: isAdmin,
    canManageClub: (clubId) => isAdmin || (approved && ledClubIds.includes(clubId)),
  };
}

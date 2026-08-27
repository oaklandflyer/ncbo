'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { parseAcademic } from '@/lib/academicYear';
import { notifyMembershipApproved } from '@/lib/push';

/**
 * Account management is admin-only — not moderator-only. An advisor moderates
 * content; membership is a different power, and this is the line.
 *
 * Every function re-checks it, and the database refuses independently:
 * `guard_profile_privileges()` raises on a status, role or deleted_at change
 * from anyone who is not an admin.
 */
async function requireAdmin(supabase) {
  const viewer = await getViewerContext(supabase);
  if (!viewer.userId) return { error: 'You are signed out.' };
  if (!viewer.canManageUsers) return { error: 'Admins only.' };
  return { viewer };
}

export async function adminUpdateUser(prev, formData) {
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if (gate.error) return { error: gate.error };

  const id = String(formData.get('id') || '');
  if (!id) return { error: 'Unknown member.' };

  const handle = (v) => {
    const raw = String(v || '').trim().replace(/\/+$/, '');
    return raw ? (raw.split('/').pop().replace(/^@/, '') || null) : null;
  };
  const text = (v, max) => {
    const raw = String(v || '').trim();
    return raw ? raw.slice(0, max) : null;
  };

  const academic = parseAcademic(formData);
  if (academic.error) return { error: academic.error };

  const patch = {
    display_name: text(formData.get('display_name'), 80) || 'Member',
    role: String(formData.get('role') || 'member'),
    school_id: String(formData.get('school_id') || '') || null,
    ...academic.patch,
    division: text(formData.get('division'), 60),
    home_region: text(formData.get('home_region'), 80),
    instagram_handle: handle(formData.get('instagram_handle')),
    tiktok_handle: handle(formData.get('tiktok_handle')),
    verified: formData.get('verified') === 'on',
    is_alumni: formData.get('is_alumni') === 'on',
  };

  if (!['member', 'club_lead', 'advisor', 'admin'].includes(patch.role)) {
    return { error: 'Unknown role.' };
  }

  const { data: current } = await supabase
    .from('profiles').select('alumni_since').eq('id', id).single();
  patch.alumni_since = patch.is_alumni
    ? (current?.alumni_since || new Date().toISOString().slice(0, 10))
    : null;

  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) return { error: error.message };

  /* The club is deliberately NOT in the patch above.
     `profiles.club_id` has been a derived mirror since 0015 — the trigger
     rewrites it from `club_memberships` — so assigning a club by writing it
     here changed nothing anybody could see: the roster, the Network and the
     headcount all read the membership, and the member stayed under "No club
     yet" until the next membership write silently reverted the column. The
     membership is the fact, and `admin_place_member()` writes it. */
  const placement = await placeInClub(supabase, id, formData);
  if (placement.error) return placement;

  revalidatePath('/hub/admin/users');
  revalidatePath('/hub/network');
  revalidatePath('/club/applications');
  revalidatePath('/club/roster');
  return { ok: true };
}

/**
 * The club dropdown on the editor, applied to the membership.
 *
 * Only when it actually changes something. Saving an unrelated edit — a
 * TikTok handle — must not turn a *pending* application into an approved
 * membership behind the reviewing lead's back: that decision belongs on the
 * applications queue, where the applicant's answers are in front of whoever
 * makes it. So a submission that names the club the member is already
 * attached to is a no-op, whatever the state of that attachment.
 */
async function placeInClub(supabase, id, formData) {
  const club = String(formData.get('club_id') || '') || null;
  const role = String(formData.get('role') || 'member') === 'club_lead' ? 'club_lead' : 'member';

  /* Every state, not just the active one: a pending applicant's editor shows
     their chapter in the dropdown, and comparing against actives only would
     read that unchanged value as a move and approve them. */
  const { data: rows } = await supabase
    .from('club_memberships')
    .select('club_id, role, status')
    .eq('user_id', id)
    .in('status', ['active', 'pending']);

  const current = (rows || []).find((m) => m.status === 'active')
    || (rows || []).find((m) => m.status === 'pending')
    || null;

  const clubUnchanged = (current?.club_id || null) === club;
  const roleUnchanged = !current || current.status !== 'active' || current.role === role
    || (role === 'member' && current.role === 'co_lead');

  if (clubUnchanged && roleUnchanged) return { ok: true };
  if (!club && !current) return { ok: true };

  /* Captured before the write, because afterwards there is no way to tell an
     approval from a transfer: both end with one active membership. Somebody
     with no active membership who now has one has been let in; somebody moved
     between chapters has not, and must not be told their account was
     approved. */
  const wasActive = (rows || []).some((m) => m.status === 'active');

  const { error } = await supabase.rpc('admin_place_member', {
    target: id,
    club,
    new_role: role,
  });

  if (error) {
    return { error: `The profile saved, but the club did not: ${error.message}` };
  }

  /* The same notification the applications queue sends, so a member cannot
     tell which route admitted them. Its result is ignored on purpose — see
     `@/lib/push`: the placement has happened either way. */
  if (club && !wasActive) await notifyMembershipApproved(id);

  return { ok: true };
}

/**
 * Soft delete. `auth.users` is never touched — the row survives so the
 * member's questions and answers keep an author. `status = 'removed'` is what
 * revokes access; `deleted_at` / `deleted_by` are the audit trail.
 */
export async function adminRemoveUser(prev, formData) {
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if (gate.error) return { error: gate.error };

  const id = String(formData.get('id') || '');

  /* An admin who removes themselves locks the last door behind them — there
     may be no other admin to undo it. */
  if (id === gate.viewer.userId) {
    return { error: 'You can’t remove your own account. Ask another admin.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      status: 'removed',
      deleted_at: new Date().toISOString(),
      deleted_by: gate.viewer.userId,
    })
    .eq('id', id);

  if (error) return { error: 'That didn’t save. The account is unchanged.' };

  revalidatePath('/hub/admin/users');
  revalidatePath('/hub/network');
  return { ok: true };
}

/** Put a removed account back, approved and visible again. */
export async function adminRestoreUser(prev, formData) {
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if (gate.error) return { error: gate.error };

  const id = String(formData.get('id') || '');
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'approved', deleted_at: null, deleted_by: null })
    .eq('id', id);

  if (error) return { error: 'That didn’t save.' };

  revalidatePath('/hub/admin/users');
  revalidatePath('/hub/network');
  return { ok: true };
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getProfile } from '@/lib/supabase/server';
import { canManageRoles } from '@/lib/review';
import { getViewerContext } from '@/lib/viewer';

/**
 * Change a member's role, club, or school.
 *
 * Nothing here trusts the caller: the update runs under the admin's own
 * session, and the `guard_profile_privileges` trigger rejects any role or
 * club change made by a non-admin. If a member POSTs this action directly,
 * Postgres refuses it.
 */
export async function updateMember(prev, formData) {
  const supabase = await createClient();

  const id = String(formData.get('id') || '');
  const role = String(formData.get('role') || '');
  const club_id = String(formData.get('club_id') || '') || null;

  if (!['member', 'club_lead', 'advisor', 'admin'].includes(role)) {
    return { error: 'Unknown role.' };
  }

  const { error } = await supabase.from('profiles').update({ role, club_id }).eq('id', id);
  if (error) {
    return { error: error.message.includes('Only an admin')
      ? 'Only an admin can change roles.'
      : error.message };
  }

  revalidatePath('/hub/admin');
  return { ok: true };
}

/**
 * Approve, decline, suspend or reinstate an account.
 *
 * Same story as updateMember: the `guard_profile_privileges` trigger refuses
 * a status change from anyone who isn't an admin, so this cannot be driven by
 * a member POSTing the action directly.
 *
 * Declining and suspending are different decisions and are stored as
 * different statuses — 'rejected' is "we read your application and said no",
 * 'suspended' is "you were in and we've stopped that". They get different
 * screens, and the log can tell them apart.
 */
const STATUSES = {
  approved:  { action: 'approved',  refusal: 'Only an admin can approve an account.' },
  rejected:  { action: 'rejected',  refusal: 'Only an admin can decline an account.' },
  suspended: { action: 'suspended', refusal: 'Only an admin can suspend an account.' },
};

export async function setStatus(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  /* Account status is admin-only now. It used to be shared with club leads,
     because approving an account was how somebody got into a chapter; that
     job moved to `decide_membership()` and the club queue, where it is
     scoped to one club. What is left here is suspending and removing
     accounts, which was always an admin's. */
  const viewer = await getViewerContext(supabase);
  if (!canManageRoles(viewer)) {
    return { error: 'Only an NCBO admin can change an account status. Applications are decided by club leads, on their own queue.' };
  }

  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  const note = String(formData.get('note') || '').trim().slice(0, 500);

  const spec = STATUSES[status];
  if (!spec) return { error: 'Unknown status.' };
  if (!id) return { error: 'No account named.' };
  if (id === user.id) return { error: 'You cannot change your own status.' };

  // Read the status we're moving away from, so the log records the transition
  // rather than just the destination. An approval that was already approved
  // reads very differently from one that reinstates a suspended account.
  const { data: before } = await supabase
    .from('profiles').select('status, school_id').eq('id', id).single();
  const previous = before?.status || null;

  const { error } = await supabase
    .from('profiles')
    .update({
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      approved_by: status === 'approved' ? user.id : null,
    })
    .eq('id', id);

  if (error) {
    return { error: error.message.includes('Only an admin') ? spec.refusal : error.message };
  }

  // Bringing back an account that was turned away or stopped is its own kind
  // of decision; the log says so rather than calling it a plain approval.
  const action = status === 'approved' && (previous === 'suspended' || previous === 'rejected')
    ? 'reinstated'
    : spec.action;

  const { error: logError } = await supabase.from('admin_actions').insert({
    actor_id: user.id,
    target_id: id,
    action,
    previous_status: previous,
    note: note || null,
  });

  // The decision has already been made and saved. A log that failed to write
  // is worth surfacing — quietly losing an audit entry is how a log stops
  // being trustworthy — but it does not undo the decision.
  revalidatePath('/hub/admin');
  revalidatePath('/hub');
  if (logError) {
    return { ok: true, warning: `Saved, but the audit entry failed: ${logError.message}` };
  }
  return { ok: true };
}

/**
 * Edit any member's details.
 *
 * Moderators and club leads reach this; the columns each may actually write
 * are decided by `guard_profile_privileges()`, not here. An advisor changing
 * somebody's role, or a lead changing their status, is refused by Postgres —
 * this function only decides what to *offer*.
 */
export async function editMember(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const id = String(formData.get('id') || '');
  if (!id) return { error: 'Unknown member.' };

  const handle = (value) => {
    const raw = String(value || '').trim().replace(/\/+$/, '');
    if (!raw) return null;
    return raw.split('/').pop().replace(/^@/, '') || null;
  };

  const patch = {
    display_name: String(formData.get('display_name') || '').trim() || 'Member',
    division: String(formData.get('division') || '').trim() || null,
    home_region: String(formData.get('home_region') || '').trim() || null,
    instagram_handle: handle(formData.get('instagram_handle')),
    tiktok_handle: handle(formData.get('tiktok_handle')),
    is_alumni: formData.get('is_alumni') === 'on',
  };

  /* Same rule as the member's own form: the date is stamped once and cleared
     when the flag is, so it never outlives the fact it records. */
  const { data: current } = await supabase
    .from('profiles').select('alumni_since').eq('id', id).single();
  patch.alumni_since = patch.is_alumni
    ? (current?.alumni_since || new Date().toISOString().slice(0, 10))
    : null;

  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) {
    return { error: error.message.includes('insufficient_privilege')
      || error.message.includes('row-level security')
      ? 'You can’t change that field on this member.'
      : error.message };
  }

  revalidatePath('/hub/admin');
  revalidatePath('/hub/network');
  return { ok: true };
}

/**
 * Remove a member from the platform. Admins only.
 *
 * Not a delete: `auth.users` is left alone, and the profile row survives so
 * their questions and answers keep an author. `status = 'removed'` is what
 * takes them out — every directory filters on `status = 'approved'`, and the
 * hub layout turns them away at the door.
 */
export async function removeMember(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const id = String(formData.get('id') || '');
  if (id === user.id) return { error: 'You can’t remove your own account.' };

  const { error } = await supabase
    .from('profiles').update({ status: 'removed' }).eq('id', id);

  if (error) {
    return { error: error.message.includes('insufficient_privilege')
      ? 'Only an admin can remove an account.'
      : 'That didn’t save. The account is unchanged.' };
  }

  revalidatePath('/hub/admin');
  return { ok: true };
}

/**
 * Take a member off a club's roster. A club lead may do this for their own
 * school; the guard allows a club change only when it is a removal.
 */
export async function removeFromRoster(prev, formData) {
  const supabase = await createClient();
  const id = String(formData.get('id') || '');

  const { error } = await supabase.from('profiles').update({ club_id: null }).eq('id', id);
  if (error) {
    return { error: error.message.includes('insufficient_privilege')
      ? 'You can only remove members of your own club.'
      : 'That didn’t save.' };
  }

  revalidatePath('/hub/admin');
  return { ok: true };
}

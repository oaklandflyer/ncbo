'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
    .from('profiles').select('status').eq('id', id).single();
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

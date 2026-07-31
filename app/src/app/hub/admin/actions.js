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

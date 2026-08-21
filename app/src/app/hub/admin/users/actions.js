'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';

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

  const patch = {
    display_name: text(formData.get('display_name'), 80) || 'Member',
    role: String(formData.get('role') || 'member'),
    club_id: String(formData.get('club_id') || '') || null,
    school_id: String(formData.get('school_id') || '') || null,
    division: text(formData.get('division'), 60),
    class_year: text(formData.get('class_year'), 20),
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

  revalidatePath('/hub/admin/users');
  revalidatePath('/hub/network');
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

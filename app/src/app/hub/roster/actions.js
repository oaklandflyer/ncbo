'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';

/**
 * Every action here re-checks `canManageClub(clubId)` against the club the
 * *target member actually belongs to* — not against a club id posted by the
 * browser. Trusting the posted id would let a lead of Club A pass Club A's id
 * while editing Club B's member.
 *
 * The database refuses all of this independently: `leads_club_of()` in the
 * profiles policy and the privilege guard. These checks exist so the failure
 * is a sentence rather than a Postgres error.
 */
async function authorize(supabase, memberId) {
  const viewer = await getViewerContext(supabase);
  if (!viewer.userId) return { error: 'You are signed out.' };

  const { data: member } = await supabase
    .from('profiles').select('id, club_id, role').eq('id', memberId).single();

  if (!member) return { error: 'That member no longer exists.' };
  if (!viewer.canManageClub(member.club_id)) {
    return { error: 'You don’t lead that member’s club.' };
  }
  return { viewer, member };
}

/** Division and class year — the two fields a lead keeps current. */
export async function updateRosterMember(prev, formData) {
  const supabase = await createClient();
  const id = String(formData.get('id') || '');

  const gate = await authorize(supabase, id);
  if (gate.error) return { error: gate.error };

  const patch = {
    division: String(formData.get('division') || '').trim() || null,
    class_year: String(formData.get('class_year') || '').trim() || null,
    is_alumni: formData.get('is_alumni') === 'on',
  };

  const { data: current } = await supabase
    .from('profiles').select('alumni_since').eq('id', id).single();
  patch.alumni_since = patch.is_alumni
    ? (current?.alumni_since || new Date().toISOString().slice(0, 10))
    : null;

  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) {
    return { error: error.message.includes('insufficient_privilege')
      ? 'The database refused that change.'
      : 'That didn’t save.' };
  }

  revalidatePath('/hub/roster');
  return { ok: true };
}

/**
 * Off the roster, not off the platform. `club_id` is cleared; the account and
 * everything on it survive. The guard permits a club change only when it is a
 * removal, so this cannot become a reassignment.
 */
export async function removeFromClub(prev, formData) {
  const supabase = await createClient();
  const id = String(formData.get('id') || '');

  const gate = await authorize(supabase, id);
  if (gate.error) return { error: gate.error };

  const { error } = await supabase.from('profiles').update({ club_id: null }).eq('id', id);
  if (error) return { error: 'That didn’t save. They are still on the roster.' };

  /* A lead who is removed loses the lead row with the membership — otherwise
     they would keep managing a club they are no longer in. */
  await supabase.rpc('set_club_lead', { target: id, make_lead: false });

  revalidatePath('/hub/roster');
  return { ok: true };
}

/**
 * Promote a member to co-lead, or step one down.
 *
 * `club_leads` is the relation the whole gate reads, so this is the one write
 * that hands somebody else authority — and the reason its policy is
 * admin-only in the database. A lead promoting a co-lead goes through here,
 * where the check is explicit, rather than through a policy that would have to
 * be widened for everyone.
 */
export async function setCoLead(prev, formData) {
  const supabase = await createClient();
  const id = String(formData.get('id') || '');
  const makeLead = formData.get('lead') === 'true';

  const gate = await authorize(supabase, id);
  if (gate.error) return { error: gate.error };

  const { viewer } = gate;

  if (!makeLead && id === viewer.userId && !viewer.isAdmin) {
    return { error: 'You can’t step yourself down — ask another lead or an admin.' };
  }

  /* Through the RPC, not the table: `club_leads_write` is admin-only on
     purpose, and this is the one narrow operation a lead may perform on it. */
  const { error } = await supabase.rpc('set_club_lead', { target: id, make_lead: makeLead });

  if (error) {
    return { error: error.message.includes('insufficient_privilege')
      ? error.message.replace(/^.*?:\s*/, '')
      : 'That didn’t save.' };
  }

  revalidatePath('/hub/roster');
  return { ok: true };
}

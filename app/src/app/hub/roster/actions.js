'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { parseAcademic } from '@/lib/academicYear';

/**
 * Every action here re-checks authority against the club the *target member
 * actually belongs to* — never against a club id posted by the browser.
 * Trusting the posted id would let a lead of Club A pass Club A's id while
 * editing Club B's member.
 *
 * For the two destructive actions that check happens in Postgres, inside the
 * SECURITY DEFINER function itself (migration 0040), which is the only place
 * it can be atomic with the writes it authorises. The checks in this file are
 * so the failure is a sentence rather than a Postgres error.
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

/** Every roster surface, after a write that changes who is on one. */
function revalidateRoster() {
  revalidatePath('/club/roster');
  revalidatePath('/hub/chapter/roster');
  revalidatePath('/hub/network');
  revalidatePath('/hub');
}

/** Division and class year — the two fields a lead keeps current. */
export async function updateRosterMember(prev, formData) {
  const supabase = await createClient();
  const id = String(formData.get('id') || '');

  const gate = await authorize(supabase, id);
  if (gate.error) return { error: gate.error };

  const academic = parseAcademic(formData);
  if (academic.error) return { error: academic.error };

  const patch = {
    division: String(formData.get('division') || '').trim() || null,
    is_alumni: formData.get('is_alumni') === 'on',
    ...academic.patch,
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

  revalidateRoster();
  return { ok: true };
}

/**
 * Postgres speaks in sentences here, so pass them through.
 *
 * `remove_club_member` and `transfer_club_leadership` raise
 * `insufficient_privilege` with a message written for a club lead to read —
 * "You cannot remove yourself. Transfer leadership first" is more use than
 * anything this layer could invent from an error code. PostgREST prefixes it,
 * so the prefix is what gets stripped.
 */
function readableRpcError(error, fallback) {
  const raw = String(error?.message || '');
  if (!raw) return fallback;
  if (error?.code === 'P0001' || raw.includes('insufficient_privilege')) {
    return raw.replace(/^.*?:\s*/, '') || fallback;
  }
  return fallback;
}

/**
 * Take somebody off this chapter's roster.
 *
 * The whole operation is one RPC because it is three writes that must not
 * half-succeed: the membership goes to `lapsed`, the club role is cleared, and
 * the `club_leads` row is deleted. `my_led_clubs()` reads the union of the last
 * two, so a removal that did only one of them would leave a removed member
 * still leading the chapter — which is the bug this replaces.
 *
 * What it replaces: an update setting `profiles.club_id = null`. That column is
 * a mirror maintained by `sync_profile_mirror`, not the record, so the old
 * version removed nobody from anything and the next membership write anywhere
 * put the mirror back.
 */
export async function removeMemberFromClub(memberId) {
  const id = String(memberId || '');
  if (!id) return { error: 'No member given.' };

  const supabase = await createClient();
  const gate = await authorize(supabase, id);
  if (gate.error) return { error: gate.error };

  const { error } = await supabase.rpc('remove_club_member', { target: id });
  if (error) {
    return { error: readableRpcError(error, 'That didn’t save. They are still on the roster.') };
  }

  revalidateRoster();
  return { ok: true };
}

/**
 * Hand the chapter to somebody else.
 *
 * Atomic in the database: the caller is demoted in the same transaction that
 * promotes the target, so a chapter cannot end up with two leads or none. The
 * table-level rule that only an admin appoints a `club_lead` is still there —
 * `transfer_club_leadership` is the one narrow exception, and it is an
 * exception precisely because the seat moves rather than multiplies. See
 * migration 0040.
 */
export async function transferLeadership(newLeadId) {
  const id = String(newLeadId || '');
  if (!id) return { error: 'No member given.' };

  const supabase = await createClient();
  const gate = await authorize(supabase, id);
  if (gate.error) return { error: gate.error };

  const { error } = await supabase.rpc('transfer_club_leadership', { target: id });
  if (error) {
    return { error: readableRpcError(error, 'That didn’t go through. You still lead this chapter.') };
  }

  revalidateRoster();
  return { ok: true };
}

/**
 * Promote a member to co-lead, or step one down.
 *
 * Distinct from `transferLeadership`: a co-lead is an addition, and the
 * chapter keeps its existing lead. Still goes through `set_club_lead`, whose
 * policy is admin-only on the table for the reason the original comment gives.
 */
export async function setCoLead(prev, formData) {
  const supabase = await createClient();
  const id = String(formData.get('id') || '');
  const makeLead = formData.get('lead') === 'true';

  const gate = await authorize(supabase, id);
  if (gate.error) return { error: gate.error };

  const { viewer } = gate;

  if (!makeLead && id === viewer.userId && !viewer.isAdmin) {
    return { error: 'You can’t step yourself down. Transfer the chapter instead.' };
  }

  const { error } = await supabase.rpc('set_club_lead', { target: id, make_lead: makeLead });
  if (error) return { error: readableRpcError(error, 'That didn’t save.') };

  revalidateRoster();
  return { ok: true };
}

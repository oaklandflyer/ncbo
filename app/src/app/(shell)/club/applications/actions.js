'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';

/**
 * The lead's three actions on an application: approve, deny, ask a question.
 *
 * Each one checks the club scope here so the UI can say something useful, and
 * each one is checked again by `decide_membership()` in Postgres, which is
 * what actually enforces it. A lead at Pitt who forged a Purdue membership id
 * into this form reaches the second check and is refused there.
 */
async function scoped(clubId) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);

  if (!viewer.profile) return { error: 'You are signed out.' };
  if (!viewer.canSeeQueueFor(clubId)) return { error: 'You do not lead that club.' };

  return { supabase, viewer };
}

export async function decideApplication(prev, formData) {
  const membershipId = String(formData.get('membership_id') || '');
  const clubId = String(formData.get('club_id') || '');
  const decision = String(formData.get('decision') || '');
  const note = String(formData.get('note') || '').trim().slice(0, 500);

  if (!membershipId || !['approve', 'deny'].includes(decision)) {
    return { error: 'That is not a decision we can record.' };
  }

  const ctx = await scoped(clubId);
  if (ctx.error) return ctx;

  const { error } = await ctx.supabase.rpc('decide_membership', {
    membership: membershipId,
    decision,
    note: note || null,
  });

  if (error) return { error: error.message };

  revalidatePath('/club/applications');
  revalidatePath('/club/roster');
  /* The hub carries the same count in its hero, and the Network is where the
     approval actually shows: an approved member leaves "No club yet" only once
     `member_directory` is read again. */
  revalidatePath('/hub');
  revalidatePath('/hub/network');
  return { ok: decision === 'approve' ? 'Approved.' : 'Declined.' };
}

/**
 * Ask an applicant something rather than guessing.
 *
 * The third action exists because a lead who half-recognises a name will
 * otherwise pick approve or deny at random, and the applicant will never learn
 * which or why.
 */
export async function askApplicant(prev, formData) {
  const membershipId = String(formData.get('membership_id') || '');
  const clubId = String(formData.get('club_id') || '');
  const body = String(formData.get('body') || '').trim().slice(0, 1000);

  if (!body) return { error: 'Write the question first.' };

  const ctx = await scoped(clubId);
  if (ctx.error) return ctx;

  const { error } = await ctx.supabase.from('membership_notes').insert({
    membership_id: membershipId,
    author_id: ctx.viewer.userId,
    body,
    to_applicant: true,
  });

  if (error) return { error: error.message };

  revalidatePath('/club/applications');
  return { ok: 'Sent to the applicant.' };
}

/**
 * Name or step down a co-lead.
 *
 * Every club needs a second approver: leadership turns over in May and
 * December, and a chapter whose only lead has graduated has a queue nobody can
 * act on. The lead's queue warns about it; this is the fix.
 */
export async function setCoLeadRole(prev, formData) {
  const targetId = String(formData.get('user_id') || '');
  const clubId = String(formData.get('club_id') || '');
  const makeCoLead = String(formData.get('make') || '') === 'yes';

  const ctx = await scoped(clubId);
  if (ctx.error) return ctx;

  const { error } = await ctx.supabase.rpc('set_club_role', {
    target: targetId,
    target_club: clubId,
    new_role: makeCoLead ? 'co_lead' : 'member',
  });

  if (error) return { error: error.message };

  revalidatePath('/club/applications');
  revalidatePath('/club/roster');
  return { ok: makeCoLead ? 'Co-lead added.' : 'Co-lead stepped down.' };
}

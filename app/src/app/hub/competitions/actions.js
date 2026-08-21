'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';

/**
 * Adding a show, entering a result, and confirming one.
 *
 * Each check here is a courtesy so the screen can say something useful. The
 * guarantee is `guard_competition_entry()` and the policies: a member who
 * forged a request past this still meets Postgres, which stamps their chapter
 * from their own membership and refuses to let them confirm themselves.
 */
export async function addCompetition(prev, formData) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.profile) return { error: 'You are signed out.' };

  const canAdd = viewer.isAdmin || viewer.orgRoles.includes('exec_board') || viewer.isClubLead;
  if (!canAdd) {
    return { error: 'Club leads and the exec board add shows. Ask your lead to put it up.' };
  }

  const name = String(formData.get('name') || '').trim().slice(0, 160);
  const startsOn = String(formData.get('starts_on') || '');
  const level = String(formData.get('level') || 'local');
  const federationId = String(formData.get('federation_id') || '') || null;
  const city = String(formData.get('city') || '').trim().slice(0, 80) || null;
  const state = String(formData.get('state') || '').trim().slice(0, 2).toUpperCase() || null;
  const infoUrl = String(formData.get('info_url') || '').trim() || null;

  if (name.length < 2) return { error: 'Give the show its name.' };
  if (!startsOn) return { error: 'When is it?' };
  if (!['local', 'regional', 'national'].includes(level)) return { error: 'Pick a level.' };
  if (infoUrl && !infoUrl.startsWith('https://')) {
    return { error: 'A link has to start with https://.' };
  }

  const { error } = await supabase.from('competitions').insert({
    name, starts_on: startsOn, level, federation_id: federationId, city, state, info_url: infoUrl,
  });

  if (error) return { error: error.message };

  revalidatePath('/hub/competitions');
  revalidatePath('/hub');
  return { ok: 'Added to the calendar.' };
}

/**
 * Enter your own result.
 *
 * `club_id` is deliberately not sent: the trigger stamps it from the
 * entrant's own active membership, so nobody scores for a chapter they are not
 * in. It arrives `pending` and is worth zero until a lead confirms it.
 */
export async function addResult(prev, formData) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.profile) return { error: 'You are signed out.' };

  const competitionId = String(formData.get('competition_id') || '');
  const division = String(formData.get('division') || '').trim().slice(0, 60) || null;
  const placementRaw = String(formData.get('placement') || '').trim();
  const classSizeRaw = String(formData.get('class_size') || '').trim();
  const isOverall = formData.get('is_overall') === 'on';

  if (!competitionId) return { error: 'Which show?' };

  const placement = placementRaw ? Number(placementRaw) : null;
  const classSize = classSizeRaw ? Number(classSizeRaw) : null;

  if (placement !== null && (!Number.isInteger(placement) || placement < 1 || placement > 99)) {
    return { error: 'A placement is a whole number between 1 and 99. Leave it blank if you would rather not say.' };
  }
  if (classSize !== null && (!Number.isInteger(classSize) || classSize < 1 || classSize > 200)) {
    return { error: 'How many were in your class? Leave it blank if you are not sure.' };
  }
  if (placement !== null && classSize !== null && placement > classSize) {
    return { error: 'That placement is higher than the number of people in the class.' };
  }

  const { error } = await supabase.from('competition_entries').insert({
    competition_id: competitionId,
    user_id: viewer.userId,
    division,
    placement,
    class_size: classSize,
    is_overall: isOverall,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'You have already entered a result for that show and division.' };
    }
    return { error: error.message };
  }

  revalidatePath('/hub/competitions');
  revalidatePath('/hub/rankings');
  return { ok: 'Added. Your club lead confirms it before it counts towards the rankings.' };
}

/** Confirm or dispute somebody else's result. Leads and the exec board only. */
export async function confirmResult(prev, formData) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.profile) return { error: 'You are signed out.' };

  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  if (!['confirmed', 'disputed'].includes(status)) return { error: 'Confirm or dispute.' };

  const { error } = await supabase
    .from('competition_entries')
    .update({ status })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/hub/competitions');
  revalidatePath('/hub/rankings');
  revalidatePath('/hub');
  return { ok: status === 'confirmed' ? 'Confirmed.' : 'Flagged for a second look.' };
}

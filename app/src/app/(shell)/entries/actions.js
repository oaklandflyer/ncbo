'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';

const PLACINGS = ['1st', '2nd', '3rd', '4th', '5th', 'DNP'];

/**
 * Log a result.
 *
 * `club_id` is deliberately not sent: the database stamps it from the
 * athlete's own active membership, so nobody scores for a chapter they are not
 * in. The entry arrives `pending` and is worth nothing until a lead approves.
 */
export async function logEntry(prev, formData) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.profile) return { error: 'You are signed out.' };

  const text = (k, max) => String(formData.get(k) || '').trim().slice(0, max);
  const showName = text('show_name', 160);
  const federation = text('federation', 40);
  const date = text('date', 10);
  const division = text('division', 60);
  const klass = text('class', 60);
  const placing = text('placing', 8);
  const wonOverall = formData.get('won_overall') === 'on';
  const handlers = formData.getAll('handlers').map(String).filter(Boolean).slice(0, 12);

  if (!showName) return { error: 'Which show was it?' };
  if (!federation) return { error: 'Pick the federation.' };
  if (!date) return { error: 'When was it?' };
  if (!division) return { error: 'Which division did you enter?' };
  if (!PLACINGS.includes(placing)) return { error: 'Pick your placing, or DNP.' };
  if (!viewer.membership) {
    return { error: 'You need to be on a chapter roster before logging a result. Your result has to score for somebody.' };
  }

  const { data: entry, error } = await supabase
    .from('competition_entries')
    .insert({
      profile_id: viewer.userId,
      show_name: showName,
      federation,
      date,
      division,
      class: klass || null,
      placing,
      won_overall: wonOverall,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'You have already logged a result for that show and division.' };
    }
    return { error: error.message };
  }

  /* Handlers are inserted after the entry exists, because the insert policy
     checks that the caller owns the entry being tagged against. A failure here
     does not lose the result: the athlete can add crew from the entry page. */
  if (handlers.length) {
    const { error: handlerError } = await supabase.from('competition_handlers').insert(
      handlers.map((id) => ({ entry_id: entry.id, handler_profile_id: id })),
    );
    if (handlerError) {
      console.error('[ncbo] handler tagging failed', { code: handlerError.code });
    }
  }

  revalidatePath('/', 'layout');
  redirect(`/entries/${entry.id}`);
}

/** Approve one entry, or every pending entry at one show. */
export async function approveEntries(prev, formData) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.profile) return { error: 'You are signed out.' };

  const id = String(formData.get('id') || '');
  const showName = String(formData.get('show_name') || '');
  const clubId = String(formData.get('club_id') || '');

  if (!viewer.canSeeQueueFor(clubId)) return { error: 'You do not lead that chapter.' };

  let query = supabase.from('competition_entries')
    .update({ status: 'approved' })
    .eq('club_id', clubId)
    .eq('status', 'pending');

  /* Bulk is scoped to one show on purpose. "Approve everything" across every
     show is the button a tired lead presses at 1am, and it is the one that
     puts unchecked results on a national leaderboard. */
  query = id ? query.eq('id', id) : query.eq('show_name', showName);

  const { error } = await query;
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { ok: id ? 'Approved.' : `Approved everything pending for ${showName}.` };
}

/** Send one back, with a reason. The reason is required by the database too. */
export async function returnEntry(prev, formData) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.profile) return { error: 'You are signed out.' };

  const id = String(formData.get('id') || '');
  const clubId = String(formData.get('club_id') || '');
  const reason = String(formData.get('rejection_reason') || '').trim().slice(0, 500);

  if (!viewer.canSeeQueueFor(clubId)) return { error: 'You do not lead that chapter.' };
  if (!reason) return { error: 'Say what needs fixing. A result sent back without a reason just gets resubmitted unchanged.' };

  const { error } = await supabase
    .from('competition_entries')
    .update({ status: 'returned', rejection_reason: reason })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { ok: 'Sent back to the athlete.' };
}

/** Chapter members, for the handler multi-select. */
export async function searchClubMembers(clubId, query) {
  if (!clubId) return { members: [] };
  const supabase = await createClient();
  let q = supabase.from('member_directory')
    .select('id, display_name').eq('club_id', clubId).order('display_name').limit(20);
  if (query?.trim()) q = q.ilike('display_name', `%${query.trim()}%`);
  const { data } = await q;
  return { members: data || [] };
}

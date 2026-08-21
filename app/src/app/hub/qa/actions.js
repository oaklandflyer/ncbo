'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** Any signed-in member may ask. */
export async function askQuestion(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const body = String(formData.get('body') || '').trim();
  const anonymous = formData.get('anonymous') === 'on';
  const slug = String(formData.get('slug') || '');

  if (!body) return { error: 'Write your question first.' };
  if (body.length > 1000) return { error: 'Keep it under 1000 characters.' };

  let channel_id = null;
  if (slug) {
    const { data: ch } = await supabase.from('channels').select('id').eq('slug', slug).single();
    channel_id = ch?.id ?? null;
  }

  const { error } = await supabase
    .from('questions').insert({ author_id: user.id, body, anonymous, channel_id });
  if (error) return { error: error.message };

  revalidatePath('/hub/qa');
  return { ok: true };
}

/**
 * Answer a question. Advisors and admins only.
 *
 * The check below is for the error message; the guarantee is the RLS policy
 * on `answers`, whose WITH CHECK requires is_moderator(). A member calling
 * the API directly gets rejected by Postgres, not by this function.
 */
export async function answerQuestion(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const id = String(formData.get('question_id') || '');
  const body = String(formData.get('body') || '').trim();
  if (!body) return { error: 'Write an answer first.' };

  const { error } = await supabase
    .from('answers').insert({ question_id: id, author_id: user.id, body });
  if (error) {
    return { error: error.message.includes('row-level security')
      ? 'Only advisors and the exec team can answer questions.'
      : error.message };
  }

  // Mark it answered. The questions UPDATE policy allows moderators.
  await supabase.from('questions').update({ answered: true }).eq('id', id);

  revalidatePath(`/hub/qa/${id}`);
  revalidatePath('/hub/qa');
  return { ok: true };
}

/**
 * Approve or reject a question. Advisors and admins only.
 *
 * As with answering, the check here is for the wording of the error. The
 * guarantee is `guard_question_status()` in the database, which refuses the
 * UPDATE for anyone who isn't a moderator — including the question's own
 * author, whom the UPDATE policy otherwise lets edit their row.
 */
export async function moderateQuestion(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const id = String(formData.get('question_id') || '');
  const status = String(formData.get('status') || '');
  if (!['approved', 'rejected'].includes(status)) return { error: 'Unknown decision.' };

  const { error } = await supabase
    .from('questions')
    .update({ status, moderated_at: new Date().toISOString(), moderated_by: user.id })
    .eq('id', id);

  if (error) {
    return { error: /row-level security|insufficient_privilege|Only an advisor/.test(error.message)
      ? 'Only advisors and the exec team can approve or reject questions.'
      : error.message };
  }

  revalidatePath(`/hub/qa/${id}`);
  revalidatePath('/hub/qa');
  return { ok: true };
}

/**
 * Toggle the caller's "this helped" vote on a question.
 *
 * The insert names `user_id: user.id` and the RLS CHECK requires it to equal
 * auth.uid(), so a forged vote is refused by Postgres rather than by this
 * function. Voting twice is refused by the composite primary key, which is
 * why a duplicate is treated as success: the desired state is already true.
 */
export async function toggleVote(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const id = String(formData.get('question_id') || '');
  const voted = formData.get('voted') === 'true';
  if (!id) return { error: 'Unknown question.' };

  const { error } = voted
    ? await supabase.from('question_votes').delete()
        .eq('question_id', id).eq('user_id', user.id)
    : await supabase.from('question_votes')
        .insert({ question_id: id, user_id: user.id });

  /* 23505 is the unique violation: somebody double-tapped, and the vote they
     wanted is already recorded. Nothing to report. */
  if (error && error.code !== '23505') {
    return { error: error.message.includes('row-level security')
      ? 'Only approved members can vote.'
      : 'That vote didn’t save. Try again.' };
  }

  revalidatePath('/hub/qa');
  return { ok: true };
}

/**
 * Remove a question from the board. Advisors and admins only.
 *
 * A soft delete: `deleted_at` is stamped and every read path filters it out.
 * A hard DELETE would cascade — `answers.question_id` and
 * `question_votes.question_id` are both ON DELETE CASCADE — so a moderator
 * tidying one question would silently destroy every answer written under it,
 * with nothing left to review if the call is questioned. The row stays on
 * disk; only its visibility changes.
 *
 * The guarantee is `guard_question_status()`, which refuses a `deleted_at`
 * change from anyone who is not a moderator. This function's check is for the
 * error message.
 */
export async function removeQuestion(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const id = String(formData.get('question_id') || '');
  if (!id) return { error: 'Unknown question.' };

  const { error } = await supabase
    .from('questions')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', id);

  if (error) {
    return { error: error.message.includes('insufficient_privilege')
      || error.message.includes('row-level security')
      ? 'Only advisors and the exec team can remove a question.'
      : 'That didn’t save. The question is still on the board.' };
  }

  revalidatePath('/hub/qa');
  return { ok: true };
}

/** Put a removed question back on the board. Moderators only. */
export async function restoreQuestion(prev, formData) {
  const supabase = await createClient();
  const id = String(formData.get('question_id') || '');

  const { error } = await supabase
    .from('questions').update({ deleted_at: null, deleted_by: null }).eq('id', id);

  if (error) {
    return { error: error.message.includes('insufficient_privilege')
      ? 'Only advisors and the exec team can restore a question.'
      : 'That didn’t save.' };
  }

  revalidatePath('/hub/qa');
  return { ok: true };
}

/**
 * Remove one answer, leaving the question standing.
 *
 * Same soft-delete semantics as a question: `deleted_at` is stamped, the feed
 * filters it, and `guard_answer_removal()` refuses the write from anyone who
 * is not a moderator.
 */
export async function removeAnswer(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const id = String(formData.get('answer_id') || '');
  const questionId = String(formData.get('question_id') || '');

  const { error } = await supabase
    .from('answers')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', id);

  if (error) {
    return { error: error.message.includes('insufficient_privilege')
      || error.message.includes('row-level security')
      ? 'Only advisors and the exec team can remove an answer.'
      : 'That didn’t save. The answer is still on the board.' };
  }

  if (questionId) revalidatePath(`/hub/qa/${questionId}`);
  revalidatePath('/hub/qa');
  return { ok: true };
}

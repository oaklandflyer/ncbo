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

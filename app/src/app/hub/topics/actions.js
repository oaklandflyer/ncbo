'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Post to a channel.
 *
 * author_id is taken from the session, never from the form — a client cannot
 * post as someone else. The matching RLS policy (author_id = auth.uid())
 * rejects it at the database if anyone tries.
 */
export async function createPost(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const body = String(formData.get('body') || '').trim();
  const slug = String(formData.get('slug') || '');
  const anonymous = formData.get('anonymous') === 'on';

  if (!body) return { error: 'Write something first.' };
  if (body.length > 240) return { error: 'Keep it under 240 characters.' };

  const { data: channel } = await supabase
    .from('channels').select('id').eq('slug', slug).single();
  if (!channel) return { error: 'That channel no longer exists.' };

  const { error } = await supabase.from('posts').insert({
    channel_id: channel.id,
    author_id: user.id,
    body,
    anonymous,
  });

  if (error) return { error: error.message };

  revalidatePath(`/hub/topics/${slug}`);
  return { ok: true };
}

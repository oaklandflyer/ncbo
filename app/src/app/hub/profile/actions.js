'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** Instagram and TikTok both allow letters, digits, dot and underscore. */
const HANDLE = /^[A-Za-z0-9._]+$/;

/**
 * Save the parts of a profile a member owns: where they're from, what they
 * compete in, and their own social accounts.
 *
 * School, club, role and vetting are not here on purpose — the database
 * refuses those from a member (`guard_profile_privileges`), so offering them
 * would be offering a button Postgres will reject.
 */
export async function saveProfile(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  /* A pasted "@name" or a full profile URL is what people actually type, so
     take both and store the handle either way. */
  const handle = (value) => {
    const raw = String(value || '').trim().replace(/\/+$/, '');
    if (!raw) return null;
    const tail = raw.split('/').pop().replace(/^@/, '');
    return tail || null;
  };

  const instagram_handle = handle(formData.get('instagram_handle'));
  const tiktok_handle = handle(formData.get('tiktok_handle'));

  for (const [label, value] of [['Instagram', instagram_handle], ['TikTok', tiktok_handle]]) {
    if (value && !HANDLE.test(value)) {
      return { error: `That ${label} handle has characters ${label} doesn’t allow.` };
    }
  }

  const home_region = String(formData.get('home_region') || '').trim() || null;
  const division = String(formData.get('division') || '').trim() || null;

  if (home_region && home_region.length > 80) {
    return { error: 'Keep the region short — "Greater Pittsburgh, PA".' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ home_region, division, instagram_handle, tiktok_handle })
    .eq('id', user.id);

  if (error) {
    return { error: error.message.includes('check constraint')
      ? 'That handle doesn’t look like a username.'
      : error.message };
  }

  revalidatePath('/hub/profile');
  revalidatePath('/hub/network');
  return { ok: true };
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const TYPES = ['youtube', 'pdf', 'article', 'spreadsheet', 'webinar'];

/**
 * Add a resource. Advisors and admins only.
 *
 * The check below is for the error message; the guarantee is the RLS policy
 * on `resources`, whose WITH CHECK requires is_moderator(). A member calling
 * the API directly is refused by Postgres.
 *
 * Links only, never files: the vault stores an address on somebody else's
 * host, which is what keeps it free to run. https is required in the column's
 * check constraint too — a `javascript:` href would be a script we hand to
 * every member who taps it.
 */
export async function addResource(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim() || null;
  const category = String(formData.get('category') || '').trim() || 'General';
  const type = String(formData.get('type') || 'article');
  const external_url = String(formData.get('external_url') || '').trim();

  if (!title) return { error: 'Give it a title.' };
  if (!TYPES.includes(type)) return { error: 'Pick a type from the list.' };

  let parsed;
  try {
    parsed = new URL(external_url);
  } catch {
    return { error: 'That isn’t a link. Paste the full address, starting https://' };
  }
  if (parsed.protocol !== 'https:') {
    return { error: 'Links must start with https:// — anything else we won’t open.' };
  }

  const { error } = await supabase
    .from('resources')
    .insert({ title, description, category, type, external_url, created_by: user.id });

  if (error) {
    return { error: error.message.includes('row-level security')
      ? 'Only advisors and the exec team can add resources.'
      : error.message };
  }

  revalidatePath('/hub/resources');
  return { ok: true };
}

/** Remove a resource. Same gate, enforced in the same place. */
export async function removeResource(prev, formData) {
  const supabase = await createClient();
  const id = String(formData.get('id') || '');

  const { error } = await supabase.from('resources').delete().eq('id', id);
  if (error) return { error: 'That didn’t delete. Try again.' };

  revalidatePath('/hub/resources');
  return { ok: true };
}

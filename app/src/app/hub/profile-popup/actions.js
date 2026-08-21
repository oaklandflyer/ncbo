'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * The one read behind every profile popup in the app.
 *
 * It calls `get_public_profile()`, a SECURITY DEFINER function with a fixed
 * projection: no email, no phone, no dues status, and never the group-chat
 * handle collected at signup. That handle is verification data a lead uses to
 * recognise somebody, not a social link to publish.
 *
 * The projection is what enforces that, rather than a rule in this component.
 * A React component that "doesn't render" a field has still shipped it to the
 * browser, where anyone can read it out of the flight payload. This way the
 * fields the popup must not show never leave Postgres, and no later edit here
 * can leak them.
 */
export async function loadPublicProfile(userId) {
  if (!userId) return { error: 'No profile asked for.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_profile', { target: userId });

  if (error) return { error: 'That profile could not be loaded.' };
  if (!data?.length) return { error: 'That member is no longer on the network.' };

  return { profile: data[0] };
}

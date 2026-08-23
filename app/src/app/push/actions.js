'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * The two writes behind the notifications toggle.
 *
 * Both take the browser's own subscription object rather than a user id: who
 * the row belongs to is `auth.uid()`, decided in Postgres, and never something
 * the client sends. A member POSTing a hand-rolled call at these can register
 * or remove a device on their own account and nowhere else.
 *
 * Neither revalidates a path. Nothing server-rendered reads this table — the
 * toggle's state comes from the browser's own `pushManager`, which is the only
 * source that knows whether *this* device is subscribed.
 */

/** Everything a sender needs, as the browser's `PushSubscription.toJSON()`. */
function readSubscription(sub) {
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint.trim() : '';
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth.trim() : '';
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh.trim() : '';

  if (!endpoint || !auth || !p256dh) return null;
  /* The endpoint is a vendor URL and the column caps at 2048. Refused here so
     the member gets a sentence instead of a constraint violation. */
  if (endpoint.length > 2048) return null;

  return { endpoint, auth, p256dh };
}

export async function subscribeToPush(sub) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out. Sign in again to turn notifications on.' };

  const parsed = readSubscription(sub);
  if (!parsed) return { error: 'Your browser did not return a complete subscription.' };

  /* Through the RPC rather than an upsert from here, and migration 0038 says
     why: the endpoint belongs to the browser, so on a shared device the row
     may still carry the last person's `user_id`, and every policy on the table
     correctly refuses to touch it. The definer function reassigns it. */
  const { error } = await supabase.rpc('save_push_subscription', {
    sub_endpoint: parsed.endpoint,
    sub_auth: parsed.auth,
    sub_p256dh: parsed.p256dh,
  });

  if (error) {
    console.error('[ncbo] push subscribe failed', { code: error.code, message: error.message });
    return { error: 'That did not save. Notifications are still off for this device.' };
  }

  return { ok: true };
}

/**
 * Forget one device.
 *
 * Scoped to the caller's own rows by RLS, so passing somebody else's endpoint
 * deletes nothing. A no-op delete is reported as success on purpose: the state
 * the member asked for — this device is not registered — is the state they end
 * up in either way, and an error there would only invite them to try again.
 */
export async function unsubscribeFromPush(endpoint) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out.' };

  const target = typeof endpoint === 'string' ? endpoint.trim() : '';
  if (!target) return { error: 'No device named.' };

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', target)
    .eq('user_id', user.id);

  if (error) {
    console.error('[ncbo] push unsubscribe failed', { code: error.code, message: error.message });
    return { error: 'That did not save. This device may still receive notifications.' };
  }

  return { ok: true };
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserResilient } from '@/lib/supabase/auth';

/**
 * The front door: straight to the hub, or to sign in.
 *
 * `getUserResilient` rather than a bare `getUser()`, for the same reason as
 * everywhere else — a null user meant both "signed out" and "we could not
 * reach the auth server", and this page answered both with /login. That is the
 * worst place to get it wrong: it is the URL people have bookmarked and the
 * one an installed PWA opens on, so one blip at the auth host greeted a
 * member with a sign-in screen before they had touched anything.
 *
 * When we cannot tell, assume the session that is probably there and send them
 * to /hub, which renders `AuthUnavailable` off the same third state: it says
 * the session is intact and offers a retry. A signed-out visitor who lands
 * there is redirected to /login from the shell, so guessing wrong costs one
 * redirect and nothing else.
 */
export default async function Index() {
  const supabase = await createClient();
  const { user, unavailable } = await getUserResilient(supabase);
  redirect(user || unavailable ? '/hub' : '/login');
}

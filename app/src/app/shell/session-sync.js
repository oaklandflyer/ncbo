'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Keeps a signed-in tab signed in.
 *
 * Until this existed, nothing in the hub ever constructed a browser Supabase
 * client. `createClient()` was called on the login page and by the push
 * toggle, and nowhere else — so once a member was inside the app there was no
 * client instance alive, and therefore no auto-refresh timer running.
 *
 * That is fine for somebody clicking around: the middleware refreshes on every
 * navigation. It is not fine for the way this app is actually used. It is an
 * installed PWA with a manifest and an install prompt; people leave it open on
 * a phone in a gym, screen off, for an hour or more. The access token expires
 * while nothing is watching, and the next thing they tap is a navigation that
 * has to refresh from cold — the case most likely to race with another
 * in-flight request and lose the rotating refresh token.
 *
 * Mounting a client here starts that timer, so the token is renewed quietly in
 * the background while the tab is open, and a navigation after a long idle
 * finds a session that is already fresh.
 *
 * Renders nothing. Mounted once, in the one shell every signed-in route uses,
 * for the same reason `ProfilePopupProvider` is: per page would be seven
 * places to remember and seven chances to forget one.
 */
export default function SessionSync() {
  const router = useRouter();

  /* One client for the life of the tab. Calling `createClient()` on each
     render would start a fresh auto-refresh timer every time and leave the
     old ones running, which is a slow multiplication of exactly the
     concurrent-refresh races this component exists to avoid. */
  const clientRef = useRef(null);
  if (clientRef.current === null) clientRef.current = createClient();

  useEffect(() => {
    const supabase = clientRef.current;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      /* `router.refresh()` on a token refresh, and only there. The browser
         client has just written new cookies; the server components rendered
         from the old ones are now stale, and re-rendering them is what makes
         the refresh visible to the rest of the app rather than something that
         happened only in this tab's memory.

         Deliberately not on every event: SIGNED_IN fires on tab focus as well
         as on an actual sign-in, and refreshing the router there would reload
         the whole tree every time somebody switched back to the app. */
      if (event === 'TOKEN_REFRESHED') {
        router.refresh();
        return;
      }

      /* A real sign-out — this tab, another tab, or a refresh token the
         server rejected for good. Going to /login here rather than waiting
         for the next navigation means the app stops showing a screen the
         member can no longer act on. */
      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}

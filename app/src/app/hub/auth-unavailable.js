import { AuthPage, AuthHeading, btnPrimary, fineprint } from '@/app/ui';

/**
 * Shown when the auth server could not be reached — not when somebody is
 * signed out.
 *
 * This is the screen that exists so the app stops lying about the third state.
 * A blip at the auth host — a cold start, a dropped connection, a 502, a rate
 * limit — used to come back as `user: null`, which every caller answered with
 * a redirect to /login. From the member's side that is indistinguishable from
 * being signed out, and it is what "I keep getting logged out" meant in beta:
 * mostly they never were. The session cookie was still in the browser and
 * still valid, and the app had thrown them out of the room over one failed
 * request.
 *
 * So: say what happened, and offer the one thing that actually helps, which is
 * trying again. No link to /login. Signing in again cannot fix a network
 * failure, and following that link is how somebody with a perfectly good
 * session ends up destroying it.
 */
export default function AuthUnavailable() {
  return (
    <AuthPage>
      <AuthHeading eyebrow="Still signed in">
        We couldn&rsquo;t reach<br />the sign-in service.
      </AuthHeading>

      <p className="mt-6 text-center text-[1.02rem] leading-relaxed text-body">
        Your session is fine — this is our end, not yours. The service that confirms who
        you are did not answer, so there is nothing to show on this page yet.
      </p>

      <a className={`${btnPrimary} mt-8 w-full`} href="/hub">
        Try again
      </a>

      <p className={`mt-7 border-t border-edge pt-6 text-center ${fineprint}`}>
        You have not been signed out, and you should not need to sign in again. If this
        keeps happening for more than a few minutes, the Supabase project is probably
        paused or down — the exact error is in the server logs.
      </p>
    </AuthPage>
  );
}

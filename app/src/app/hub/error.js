'use client';

import { useEffect } from 'react';
import { AuthPage, AuthHeading, btnGhost, fineprint } from '@/app/ui';

/**
 * The hub's error boundary.
 *
 * Next.js replaces a server error's message with a generic string before it
 * reaches the browser, and hands over only a `digest` — a hash of the real
 * error. That is the right default (an exception can carry a query, a column
 * name, a connection string), but it leaves the person looking at the screen
 * with a number and nothing to do with it.
 *
 * So this does the one useful thing available: it shows the digest, says
 * plainly that the real message is server-side only, and names where to find
 * it. Every server-side log line this app writes is prefixed `[ncbo]`, which
 * makes the matching entry one search rather than a scroll.
 */
export default function HubError({ error, reset }) {
  useEffect(() => {
    /* Also logged from the browser, so the digest is in one more place than
       the screenshot somebody is about to send. */
    console.error('[ncbo] hub render failed', { digest: error?.digest });
  }, [error]);

  return (
    <AuthPage wide>
      <AuthHeading eyebrow="Something broke">
        This page didn&rsquo;t<br />finish loading.
      </AuthHeading>

      <p className="mx-auto mt-6 max-w-[560px] text-center text-[1.02rem] leading-relaxed text-body">
        The server hit an error while building this page. Your account and your data are
        fine, and signing in again will not change anything.
      </p>

      {error?.digest && (
        <div className="mx-auto mt-8 max-w-[560px] rounded-[8px] border border-edge bg-band px-5 py-5">
          <p className="font-display text-[0.9rem] font-bold uppercase tracking-[0.04em] text-ink">
            Error reference
          </p>
          <pre className="mt-2 overflow-x-auto rounded-[6px] bg-surface px-4 py-3 text-[0.9rem] text-ink">
            {error.digest}
          </pre>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-body">
            The message itself is only in the server log, which is deliberate. In Vercel,
            open the project, then <b>Logs</b>, and search for that reference or for{' '}
            <code className="rounded bg-surface px-1.5 py-0.5 text-[0.9em]">[ncbo]</code>,
            which prefixes everything this app logs.
          </p>
        </div>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={() => reset()} className={btnGhost}>
          Try again
        </button>
        <a href="/login" className={btnGhost}>Back to sign in</a>
      </div>

      <p className={`mx-auto mt-7 max-w-[560px] text-center ${fineprint}`}>
        If it happens on every page rather than one, the likeliest causes are a paused
        Supabase project or a migration that has not been applied.
      </p>
    </AuthPage>
  );
}

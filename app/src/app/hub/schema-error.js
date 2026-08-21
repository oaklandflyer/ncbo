import { AuthPage, AuthHeading, fineprint } from '@/app/ui';

/**
 * Shown when a member is signed in and their profile could not be read.
 *
 * This exists because the app used to answer that situation by redirecting to
 * /login, which is a lie: the session is fine. Following the magic link again
 * produced the same redirect, so the whole thing looked like sign-in being
 * broken, and the actual cause — a database whose migrations had not been
 * applied — was invisible from the outside.
 *
 * The likely cause is named directly rather than hidden behind "something went
 * wrong", because the person most likely to hit this is whoever just deployed,
 * and they are one command away from fixing it.
 */
export default function SchemaError({ error }) {
  /* PostgREST's codes for the two failures a behind-schema database produces:
     an unknown column, and an embed whose relationship it cannot find. */
  const looksLikeSchema =
    error?.code === '42703'
    || error?.code === 'PGRST200'
    || error?.code === 'PGRST204'
    || /column|relationship|schema cache/i.test(error?.message || '');

  return (
    <AuthPage wide>
      <AuthHeading eyebrow="Signed in, but stuck">
        The app can&rsquo;t<br />read your profile.
      </AuthHeading>

      <p className="mx-auto mt-6 max-w-[560px] text-center text-[1.02rem] leading-relaxed text-body">
        Your sign-in worked. The database refused the query behind this page, so there is
        nothing to show you yet. This is not something you can fix by signing in again.
      </p>

      {looksLikeSchema && (
        <div className="mx-auto mt-8 max-w-[560px] rounded-[8px] border border-edge bg-band px-5 py-5">
          <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.04em] text-ink">
            Almost certainly: the database is behind the app
          </p>
          <p className="mt-3 text-[0.98rem] leading-relaxed text-body">
            The deployed code expects tables and columns that the database does not have
            yet. Deploying updates the app; it does not run migrations. From{' '}
            <code className="rounded bg-surface px-1.5 py-0.5 text-[0.9em]">app/</code>:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-[6px] bg-surface px-4 py-3 text-[0.88rem] text-ink">
            npm run db:push
          </pre>
        </div>
      )}

      <p className={`mx-auto mt-7 max-w-[560px] text-center ${fineprint}`}>
        If that is not it, the other common cause is a paused Supabase project: the free
        tier pauses after about a week without traffic, and un-pausing it from the
        dashboard brings everything back. The exact error is in the server logs.
      </p>

      <p className={`mx-auto mt-6 max-w-[560px] text-center ${fineprint}`}>
        <a className="font-semibold text-brand underline underline-offset-2" href="/login">
          Back to sign in
        </a>
      </p>
    </AuthPage>
  );
}

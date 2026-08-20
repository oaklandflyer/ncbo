'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AuthPage, AuthHeading, field, fieldLabel, btnPrimary, btnGhost, fineprint, buttonReset,
} from '@/app/ui';

/**
 * Three ways in, all the same action — signing in and signing up are one and
 * the same, and a first-time address gets an account.
 *
 * Students go through Microsoft: schools hand out Microsoft accounts, so that
 * is the door that already knows who they are. Everyone else uses Google or a
 * link to whatever address is theirs. The magic-link field is deliberately
 * pointed at personal addresses now — school mail systems quarantine the
 * links often enough that students were left waiting on mail that never came.
 *
 * Whether an account is live straight away is still decided in the database,
 * not here: a .edu address at a school NCBO already runs is approved on the
 * spot; everything else waits for an admin.
 */
const EDU = /^[^@\s]+@([a-z0-9-]+\.)*[a-z0-9-]+\.edu$/i;

/**
 * Where sign-in comes back to. Read at call time rather than at module scope:
 * NEXT_PUBLIC_SITE_URL is inlined at build, but window.location.origin is the
 * only thing that is right on a preview deployment that has neither.
 */
function callbackUrl() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  const next = new URLSearchParams(window.location.search).get('next') || '/hub';
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Messages for the reasons /auth/callback can send someone back here. */
const RETURNED_ERRORS = {
  link: 'That link didn’t work — it may have been used already or expired. Send yourself a fresh one.',
  oauth: 'That sign-in didn’t go through. Try again, or email yourself a link instead.',
};

/**
 * Supabase's errors are written for developers. Say the useful part, and
 * never say whether an address has an account — that would turn this form
 * into an account-enumeration oracle.
 */
function readableError(error) {
  const raw = String(error?.message || '').toLowerCase();
  if (raw.includes('provider is not enabled')) {
    return 'That sign-in method isn’t switched on for this site yet. Use a sign-in link for now.';
  }
  if (raw.includes('rate limit') || raw.includes('too many') || error?.status === 429) {
    return 'That’s a lot of links in a short time. Wait a minute, then try again.';
  }
  if (raw.includes('invalid') && raw.includes('email')) {
    return 'That doesn’t look like an email address we can send to.';
  }
  if (raw.includes('failed to fetch') || raw.includes('network')) {
    return 'We couldn’t reach the sign-in service. Check your connection and try again.';
  }
  return 'Something went wrong sending that link. Try again in a moment.';
}

/** Microsoft's mark, at the size the button's display text sits on. */
function MicrosoftMark() {
  return (
    <svg aria-hidden width="17" height="17" viewBox="0 0 48 48">
      <path fill="#F25022" d="M6 6h16.5v16.5H6z" />
      <path fill="#7FBA00" d="M25.5 6H42v16.5H25.5z" />
      <path fill="#00A4EF" d="M6 25.5h16.5V42H6z" />
      <path fill="#FFB900" d="M25.5 25.5H42V42H25.5z" />
    </svg>
  );
}

/** Google's mark, at the size the button's display text sits on. */
function GoogleMark() {
  return (
    <svg aria-hidden width="17" height="17" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C2.9 17.2 2 20.5 2 24s.9 6.8 2.5 9.9l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /* Which provider we are handing the browser off to, if any — one at a time,
     so the other button greys out rather than racing it. */
  const [provider, setProvider] = useState('');

  /* Read on the client rather than with useSearchParams: this page is
     otherwise statically rendered, and that hook would force it behind a
     Suspense boundary for the sake of one message. */
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('error');
    if (reason && RETURNED_ERRORS[reason]) setError(RETURNED_ERRORS[reason]);
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    const addr = email.trim();

    if (!addr.includes('@')) {
      setError('That doesn’t look like an email address.');
      return;
    }

    setBusy(true);
    setError('');

    const supabase = createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: callbackUrl() },
    });

    setBusy(false);
    if (sendError) setError(readableError(sendError));
    else setSentTo(addr);
  }

  /**
   * Hand off to Google or Microsoft ('azure' is Supabase's name for Microsoft
   * Entra). On success this never returns — the browser leaves for the
   * provider — so the busy state is deliberately left on: clearing it would
   * flash the button back to life during the redirect.
   *
   * Microsoft asks for `email` explicitly. Entra's default scopes don't
   * include it, and without an address the profile row has nothing to tie a
   * member to their school.
   */
  async function onOAuth(name) {
    setProvider(name);
    setError('');

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: name,
      options: {
        redirectTo: callbackUrl(),
        ...(name === 'azure' ? { scopes: 'email' } : null),
      },
    });

    if (oauthError) {
      setProvider('');
      setError(readableError(oauthError));
    }
  }

  /* Sent: the form is replaced rather than annotated. A confirmation under a
     still-filled form invites a second submission, and this link is
     single-use — the second one silently invalidates the first. */
  if (sentTo) {
    return (
      <AuthPage>
        <AuthHeading eyebrow="Link sent">Check your<br />inbox.</AuthHeading>

        <p className="mt-6 text-center text-[1.02rem] leading-relaxed text-body">
          We’ve emailed a sign-in link to{' '}
          <b className="font-semibold text-ink">{sentTo}</b>. Open it on this device and
          you’ll land straight in the hub.
        </p>

        <div className="mt-7 rounded-[8px] border border-edge bg-band px-5 py-4 text-[0.92rem] leading-relaxed text-body">
          The link works once and expires in an hour. Nothing after a minute or two? Check
          spam — it arrives from Supabase on NCBO’s behalf.
        </div>

        <button
          type="button"
          onClick={() => { setSentTo(''); setError(''); }}
          className={`${buttonReset} mt-7 w-full text-center font-display text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-meta transition hover:text-brand`}
        >
          Use a different address
        </button>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthHeading eyebrow="Members only">The member<br />locker room.</AuthHeading>

      <p className="mt-6 text-center text-[1.02rem] leading-relaxed text-body">
        No passwords here. Students, sign in with the Microsoft account your school gave
        you. Advisors, exec and everyone else: Google, or a link to your own inbox.
      </p>

      <div className="mt-8 grid gap-3">
        <button
          type="button"
          onClick={() => onOAuth('azure')}
          disabled={busy || !!provider}
          className={`${btnGhost} w-full`}
        >
          <MicrosoftMark />
          {provider === 'azure' ? 'Redirecting…' : 'Sign in with Microsoft'}
        </button>

        <button
          type="button"
          onClick={() => onOAuth('google')}
          disabled={busy || !!provider}
          className={`${btnGhost} w-full`}
        >
          <GoogleMark />
          {provider === 'google' ? 'Redirecting…' : 'Sign in with Google'}
        </button>
      </div>

      <p className={`mt-3 text-center ${fineprint}`}>
        Microsoft for school accounts · Google for personal ones
      </p>

      <div className="mt-7 flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-edge" />
        <span className="font-display text-[0.74rem] font-semibold uppercase tracking-[0.2em] text-meta">
          or
        </span>
        <span className="h-px flex-1 bg-edge" />
      </div>

      <form className="mt-7" onSubmit={onSubmit} noValidate>
        <label className={fieldLabel} htmlFor="email">Personal email</label>
        <input
          id="email" type="email" autoComplete="email" required
          className={field}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
        />

        {/* School addresses are the case this field is *not* for: their mail
            systems hold the links, and the Microsoft button gets students in
            without any of that. Say so rather than letting them wait. */}
        {EDU.test(email.trim()) ? (
          <p className={`mt-3 ${fineprint}`}>
            That’s a school address — school mail often holds these links. Sign in with
            Microsoft above instead and you’ll be straight in.
          </p>
        ) : email.includes('@') && (
          <p className={`mt-3 ${fineprint}`}>
            An admin will approve your account before it goes live, unless your school is
            already with NCBO.
          </p>
        )}

        {error && (
          <p id="login-error" role="alert" className="mt-3 text-[0.9rem] text-danger">
            {error}
          </p>
        )}

        <button className={`${btnPrimary} mt-6 w-full`} type="submit" disabled={busy || !!provider}>
          {busy ? 'Sending…' : 'Email me a link'}
        </button>
      </form>

      <p className={`mt-7 border-t border-edge pt-6 text-center ${fineprint}`}>
        Signing in with your school account ties you to your school and club
        automatically. However you get in, your email stays private — other members never
        see it.
      </p>
    </AuthPage>
  );
}

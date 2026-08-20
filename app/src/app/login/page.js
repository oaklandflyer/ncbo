'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AuthPage, AuthHeading, field, fieldLabel, btnPrimary, btnGhost, fineprint, buttonReset,
} from '@/app/ui';

/**
 * Two ways in, both the same action — signing in and signing up are one and
 * the same, and a first-time address gets an account.
 *
 * Google leads: schools on Google Workspace hand students an account that
 * already proves who they are, and it skips the wait for an email entirely.
 * The magic link stays for everyone Google can't speak for.
 *
 * Anyone may sign up; whether the account is live straight away is decided in
 * the database. A .edu address at a school NCBO already runs is approved on
 * the spot; everything else waits for an admin. The hint below just sets the
 * expectation — it decides nothing.
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
  oauth: 'Google sign-in didn’t go through. Try again, or use a sign-in link instead.',
};

/**
 * Supabase's errors are written for developers. Say the useful part, and
 * never say whether an address has an account — that would turn this form
 * into an account-enumeration oracle.
 */
function readableError(error) {
  const raw = String(error?.message || '').toLowerCase();
  if (raw.includes('provider is not enabled')) {
    return 'Google sign-in isn’t switched on for this site yet. Use a sign-in link for now.';
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
  const [google, setGoogle] = useState(false);

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
   * Google sign-in. On success this never returns — the browser leaves for
   * Google — so the busy state is deliberately left on: clearing it would
   * flash the button back to life during the redirect.
   */
  async function onGoogle() {
    setGoogle(true);
    setError('');

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });

    if (oauthError) {
      setGoogle(false);
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
        Sign in with your Google account, including university Google accounts. For
        personal or non-Google emails, request a sign-in link below.
      </p>

      <button
        type="button"
        onClick={onGoogle}
        disabled={google || busy}
        className={`${btnPrimary} mt-7 w-full`}
      >
        <GoogleMark />
        {google ? 'Redirecting…' : 'Sign in with Google'}
      </button>

      <div className="mt-7 flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-edge" />
        <span className="font-display text-[0.74rem] font-semibold uppercase tracking-[0.2em] text-meta">
          or
        </span>
        <span className="h-px flex-1 bg-edge" />
      </div>

      <form className="mt-7" onSubmit={onSubmit} noValidate>
        <label className={fieldLabel} htmlFor="email">Email address</label>
        <input
          id="email" type="email" autoComplete="email" required
          className={field}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
        />

        {email.includes('@') && !EDU.test(email.trim()) && (
          <p className={`mt-3 ${fineprint}`}>
            Not a school address — that’s fine, an admin will approve your account before
            it goes live.
          </p>
        )}

        {error && (
          <p id="login-error" role="alert" className="mt-3 text-[0.9rem] text-danger">
            {error}
          </p>
        )}

        <button className={`${btnGhost} mt-6 w-full`} type="submit" disabled={busy || google}>
          {busy ? 'Sending…' : 'Email me a link'}
        </button>
      </form>

      <p className={`mt-7 border-t border-edge pt-6 text-center ${fineprint}`}>
        A school address ties you to your school and club automatically. Either way your
        email stays private — other members never see it.
      </p>
    </AuthPage>
  );
}

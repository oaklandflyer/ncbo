'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AuthPage, AuthHeading, field, fieldLabel, btnPrimary, fineprint, buttonReset,
} from '@/app/ui';

/**
 * Sign-in by magic link. Signing in and signing up are the same action — a
 * first-time address gets an account.
 *
 * Anyone may sign up; whether the account is live straight away is decided in
 * the database. A .edu address at a school NCBO already runs is approved on
 * the spot; everything else waits for an admin. The hint below just sets the
 * expectation — it decides nothing.
 */
const EDU = /^[^@\s]+@([a-z0-9-]+\.)*[a-z0-9-]+\.edu$/i;

/**
 * Supabase's errors are written for developers. Say the useful part, and
 * never say whether an address has an account — that would turn this form
 * into an account-enumeration oracle.
 */
function readableError(error) {
  const raw = String(error?.message || '').toLowerCase();
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

export default function Login() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    const next = new URLSearchParams(window.location.search).get('next') || '/hub';
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        emailRedirectTo:
          `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}` +
          `/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setBusy(false);
    if (sendError) setError(readableError(sendError));
    else setSentTo(addr);
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
        Students: use your school email. Advisors and exec: use your own. No password —
        we’ll send you a link, and you’ll stay signed in on this device.
      </p>

      <form className="mt-8" onSubmit={onSubmit} noValidate>
        <label className={fieldLabel} htmlFor="email">Email address</label>
        <input
          id="email" type="email" autoComplete="email" required
          className={field}
          placeholder="you@yourschool.edu"
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

        <button className={`${btnPrimary} mt-6 w-full`} type="submit" disabled={busy}>
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

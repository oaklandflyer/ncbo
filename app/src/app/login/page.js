'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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

export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ kind: '', text: '' });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const addr = email.trim();

    if (!addr.includes('@')) {
      setState({ kind: 'err', text: 'That doesn’t look like an email address.' });
      return;
    }

    setBusy(true);
    setState({ kind: '', text: '' });

    const supabase = createClient();
    const next = new URLSearchParams(window.location.search).get('next') || '/hub';
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        emailRedirectTo:
          `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}` +
          `/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setBusy(false);
    setState(error
      ? { kind: 'err', text: error.message }
      : { kind: 'ok', text: `Check ${addr} — we sent you a sign-in link. It expires in an hour.` });
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <p className="eyebrow" style={{ justifyContent: 'center' }}>Members only</p>
        <h1>The member<br />locker room.</h1>
        <p className="lead" style={{ marginTop: '1rem', fontSize: '0.98rem' }}>
          Students: use your school email. Advisors and exec: use your own.
          No password — we&rsquo;ll send you a link, and you&rsquo;ll stay signed in on
          this device.
        </p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" autoComplete="email" required
              placeholder="you@yourschool.edu"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            {email.includes('@') && !EDU.test(email.trim()) && (
              <p className="fineprint" style={{ marginTop: '0.5rem' }}>
                Not a school address — that&rsquo;s fine, an admin will approve your account
                before it goes live.
              </p>
            )}
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a link'}
          </button>
          <p className={`msg ${state.kind}`} role="status" aria-live="polite">{state.text}</p>
        </form>

        <p className="fineprint">
          A school address ties you to your school and club automatically. Either way your
          email stays private — other members never see it.
        </p>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Sign-in by magic link.
 *
 * The .edu check here is for a friendly error only — the authoritative check
 * is the trigger on auth.users in the database, which aborts the signup for
 * any non-.edu address regardless of how the request was made.
 */
const EDU = /^[^@\s]+@([a-z0-9-]+\.)*[a-z0-9-]+\.edu$/i;

export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ kind: '', text: '' });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const addr = email.trim();

    if (!EDU.test(addr)) {
      setState({ kind: 'err', text: 'Use your school email — NCBO membership requires a .edu address.' });
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
          Sign in with your school email. No password — we&rsquo;ll send you a link.
        </p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">School email</label>
            <input
              id="email" type="email" autoComplete="email" required
              placeholder="you@yourschool.edu"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a link'}
          </button>
          <p className={`msg ${state.kind}`} role="status" aria-live="polite">{state.text}</p>
        </form>

        <p className="fineprint">
          Your .edu address is what ties you to your school and club. It stays private —
          other members never see it.
        </p>
      </div>
    </main>
  );
}

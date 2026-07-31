'use client';

import { useActionState, useEffect, useRef } from 'react';
import { askQuestion } from './actions';

export default function Ask({ channels }) {
  const [state, action, pending] = useActionState(askQuestion, {});
  const formRef = useRef(null);

  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);

  return (
    <form className="composer" action={action} ref={formRef}>
      <label htmlFor="q">Ask the network</label>
      <textarea id="q" name="body" maxLength={1000} placeholder="What do you want to know?" />
      <div className="composer-bar">
        <select name="slug" aria-label="Channel" style={{ width: 'auto' }}>
          <option value="">No channel</option>
          {channels.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <label className="checkline" style={{ margin: 0, textTransform: 'none', letterSpacing: 0 }}>
          <input type="checkbox" name="anonymous" />
          <span>Ask anonymously</span>
        </label>
        <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Ask'}
        </button>
      </div>
      {state?.error && <p className="msg err">{state.error}</p>}
      {state?.ok && <p className="msg ok">Posted. Advisors see it on the board now.</p>}
    </form>
  );
}

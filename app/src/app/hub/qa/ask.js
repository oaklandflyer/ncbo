'use client';

import { useActionState, useEffect, useRef } from 'react';
import { askQuestion } from './actions';
import {
  composerShell, composerLabel, composerField, composerBar,
  checkline, btnPrimary, selectField, FormMessage,
} from '../ui';

export default function Ask({ channels }) {
  const [state, action, pending] = useActionState(askQuestion, {});
  const formRef = useRef(null);

  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);

  return (
    <form className={composerShell} action={action} ref={formRef}>
      <label className={composerLabel} htmlFor="q">Ask the network</label>
      <textarea
        id="q" name="body" maxLength={1000} rows={3}
        className={composerField}
        placeholder="What do you want to know?"
      />
      <div className={composerBar}>
        <div className="flex flex-wrap items-center gap-3">
          <select name="slug" aria-label="Channel" className={selectField} defaultValue="">
            <option value="">No channel</option>
            {channels.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <label className={checkline}>
            <input type="checkbox" name="anonymous" className="h-4 w-4 accent-steel" />
            <span>Ask anonymously</span>
          </label>
        </div>
        <button className={btnPrimary} type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Ask'}
        </button>
      </div>
      <FormMessage error={state?.error} ok={state?.ok && 'Posted. Advisors see it on the board now.'} />
    </form>
  );
}

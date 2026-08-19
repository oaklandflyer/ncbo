'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createPost } from './actions';
import {
  composerShell, composerLabel, composerField, composerBar,
  checkline, btnPrimary, FormMessage,
} from '../ui';

const LIMIT = 240;

export default function Composer({ slug }) {
  const [state, action, pending] = useActionState(createPost, {});
  const [body, setBody] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.ok) { setBody(''); formRef.current?.reset(); }
  }, [state]);

  const left = LIMIT - body.length;

  return (
    <form className={composerShell} action={action} ref={formRef}>
      <input type="hidden" name="slug" value={slug} />
      <label className={composerLabel} htmlFor="body">Post to this channel</label>
      <textarea
        id="body" name="body" maxLength={LIMIT} value={body} rows={3}
        className={composerField}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share something short…"
      />
      <div className={composerBar}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Only turns amber near the limit — a counter that shouts from the
              first character is noise. */}
          <span
            aria-live="polite"
            className={`text-[0.82rem] tabular-nums ${left <= 20 ? 'text-danger' : 'text-muted'}`}
          >
            {left} left
          </span>
          <label className={checkline}>
            <input type="checkbox" name="anonymous" className="h-4 w-4 accent-steel" />
            <span>Post anonymously</span>
          </label>
        </div>
        <button className={btnPrimary} type="submit" disabled={pending || !body.trim()}>
          {pending ? 'Posting…' : 'Post'}
        </button>
      </div>
      <FormMessage error={state?.error} />
    </form>
  );
}

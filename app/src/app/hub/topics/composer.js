'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createPost } from './actions';
import { Eyebrow, field, fieldLabel, checkline, btnPrimary, FormMessage } from '@/app/ui';

const LIMIT = 240;

export default function Composer({ slug, channelName }) {
  const [state, action, pending] = useActionState(createPost, {});
  const [body, setBody] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.ok) { setBody(''); formRef.current?.reset(); }
  }, [state]);

  const left = LIMIT - body.length;

  return (
    <form className="rounded-[8px] border border-edge bg-surface p-6 sm:p-8" action={action} ref={formRef}>
      <input type="hidden" name="slug" value={slug} />
      <Eyebrow>Post</Eyebrow>
      <h2 className="mt-3 font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold uppercase leading-none text-ink">
        Say one thing well.
      </h2>
      <p className="mt-3 max-w-[560px] text-[0.98rem] text-body">
        {LIMIT} characters to {channelName ? `#${channelName}` : 'this channel'}. Short on
        purpose, and it keeps the board readable.
      </p>

      <div className="mt-6">
        <label className={fieldLabel} htmlFor="body">Your post</label>
        <textarea
          id="body" name="body" maxLength={LIMIT} value={body} rows={3}
          className={`${field} resize-y`}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share something short…"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Only turns red near the limit — a counter that shouts from the
              first character is noise. */}
          <span
            aria-live="polite"
            className={`font-display text-[0.85rem] font-semibold uppercase tracking-[0.1em] tabular-nums ${
              left <= 20 ? 'text-danger' : 'text-meta'
            }`}
          >
            {left} left
          </span>
          <label className={checkline}>
            <input type="checkbox" name="anonymous" className="h-4 w-4 accent-[#2F5FA8]" />
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

'use client';

import { useActionState, useEffect, useRef } from 'react';
import { askQuestion } from './actions';
import { Eyebrow, field, fieldLabel, checkline, btnPrimary } from '@/app/ui';

export default function Ask({ channels }) {
  const [state, action, pending] = useActionState(askQuestion, {});
  const formRef = useRef(null);

  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);

  return (
    <form className="rounded-[8px] border border-edge bg-surface p-6 sm:p-8" action={action} ref={formRef}>
      <Eyebrow>Ask the network</Eyebrow>
      <h2 className="mt-3 font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold uppercase leading-none text-ink">
        Put it to the panel.
      </h2>
      <p className="mt-3 max-w-[560px] text-[0.98rem] text-body">
        Advisors and the exec team see every question here, and one of them reads it before
        it reaches the board. Ask anonymously if you’d rather your name weren’t on it.
      </p>

      <div className="mt-6">
        <label className={fieldLabel} htmlFor="q">Your question</label>
        <textarea
          id="q" name="body" maxLength={1000} rows={4}
          className={`${field} resize-y`}
          placeholder="What do you want to know?"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <select name="slug" aria-label="Channel" defaultValue="" className={`${field} w-auto py-2`}>
            <option value="">No channel</option>
            {channels.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <label className={checkline}>
            <input type="checkbox" name="anonymous" className="h-4 w-4 accent-[#2F5FA8]" />
            <span>Ask anonymously</span>
          </label>
        </div>
        <button className={btnPrimary} type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Ask'}
        </button>
      </div>

      {state?.ok && (
        <div
          role="status"
          className="mt-5 rounded-[8px] border border-edge bg-band px-5 py-4 text-[0.95rem] leading-relaxed text-body"
        >
          <span className="font-display font-bold uppercase tracking-[0.08em] text-brand-deep">
            Sent for Review.
          </span>{' '}
          Your question will appear once approved by a moderator.
        </div>
      )}

      {/* Failure gets the same weight as success — an error that scrolls past
          in one line is how a member concludes the button is broken. */}
      {state?.error && (
        <div
          role="alert"
          className="mt-5 rounded-[8px] border border-[rgba(180,50,74,0.35)] px-5 py-4 text-[0.95rem] leading-relaxed text-danger"
        >
          <span className="font-display font-bold uppercase tracking-[0.08em]">
            Not sent.
          </span>{' '}
          {state.error}
        </div>
      )}
    </form>
  );
}

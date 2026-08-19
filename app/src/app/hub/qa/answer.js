'use client';

import { useActionState, useEffect, useRef } from 'react';
import { answerQuestion } from './actions';
import { Eyebrow, field, fieldLabel, btnPrimary, FormMessage } from '@/app/ui';

export default function AnswerForm({ questionId }) {
  const [state, action, pending] = useActionState(answerQuestion, {});
  const formRef = useRef(null);

  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);

  return (
    <form className="rounded-[8px] border border-edge bg-surface p-6 sm:p-8" action={action} ref={formRef}>
      <input type="hidden" name="question_id" value={questionId} />
      <Eyebrow>Answer this</Eyebrow>
      <h2 className="mt-3 font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold uppercase leading-none text-ink">
        Settle it for everyone.
      </h2>
      <p className="mt-3 max-w-[560px] text-[0.98rem] text-body">
        Your answer stays on the board, so the next person asking this finds it instead of
        asking again.
      </p>

      <div className="mt-6">
        <label className={fieldLabel} htmlFor="a">Your answer</label>
        <textarea
          id="a" name="body" maxLength={4000} rows={6}
          className={`${field} resize-y`}
          placeholder="Answer for the whole network…"
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button className={btnPrimary} type="submit" disabled={pending}>
          {pending ? 'Posting…' : 'Post answer'}
        </button>
      </div>

      <FormMessage error={state?.error} />
    </form>
  );
}

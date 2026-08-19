'use client';

import { useActionState, useEffect, useRef } from 'react';
import { answerQuestion } from './actions';
import {
  composerShell, composerLabel, composerField, composerBar, btnPrimary, FormMessage,
} from '../ui';

export default function AnswerForm({ questionId }) {
  const [state, action, pending] = useActionState(answerQuestion, {});
  const formRef = useRef(null);

  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);

  return (
    <form className={composerShell} action={action} ref={formRef}>
      <input type="hidden" name="question_id" value={questionId} />
      <label className={composerLabel} htmlFor="a">Your answer</label>
      <textarea
        id="a" name="body" maxLength={4000} rows={5}
        className={composerField}
        placeholder="Answer for the whole network…"
      />
      <div className={`${composerBar} justify-end`}>
        <button className={btnPrimary} type="submit" disabled={pending}>
          {pending ? 'Posting…' : 'Post answer'}
        </button>
      </div>
      <FormMessage error={state?.error} />
    </form>
  );
}

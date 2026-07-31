'use client';

import { useActionState, useEffect, useRef } from 'react';
import { answerQuestion } from './actions';

export default function AnswerForm({ questionId }) {
  const [state, action, pending] = useActionState(answerQuestion, {});
  const formRef = useRef(null);

  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);

  return (
    <form className="composer" action={action} ref={formRef}>
      <input type="hidden" name="question_id" value={questionId} />
      <label htmlFor="a">Your answer</label>
      <textarea id="a" name="body" maxLength={4000} placeholder="Answer for the whole network…" />
      <div className="composer-bar">
        <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
          {pending ? 'Posting…' : 'Post answer'}
        </button>
      </div>
      {state?.error && <p className="msg err">{state.error}</p>}
    </form>
  );
}

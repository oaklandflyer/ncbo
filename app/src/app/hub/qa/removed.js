'use client';

import { useActionState } from 'react';
import { restoreQuestion } from './actions';
import { Card, Meta, Badge, btnGhost, btnSmall } from '@/app/ui';

/** One removed question, with the way back. */
function RestoreRow({ question }) {
  const [state, action, pending] = useActionState(restoreQuestion, {});

  return (
    <Card className="p-5 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="line-clamp-2 text-[1rem] leading-relaxed text-body">{question.body}</p>
          <Meta className="mt-3">
            <Badge tone="forming">Removed</Badge>
            <span aria-hidden className="text-fine">·</span>
            <span>{question.author_name}</span>
            <span aria-hidden className="text-fine">·</span>
            <span>{new Date(question.deleted_at).toLocaleDateString()}</span>
          </Meta>
          {state?.error && (
            <p role="alert" className="mt-2 text-[0.85rem] text-danger">{state.error}</p>
          )}
        </div>

        <form action={action}>
          <input type="hidden" name="question_id" value={question.id} />
          <button className={`${btnGhost} ${btnSmall}`} type="submit" disabled={pending}>
            {pending ? 'Restoring…' : 'Restore'}
          </button>
        </form>
      </div>
    </Card>
  );
}

export default function RemovedList({ questions }) {
  return (
    <ul className="grid list-none gap-3">
      {questions.map((q) => <li key={q.id}><RestoreRow question={q} /></li>)}
    </ul>
  );
}

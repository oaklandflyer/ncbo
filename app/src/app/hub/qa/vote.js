'use client';

import { useActionState, useOptimistic, startTransition } from 'react';
import { toggleVote } from './actions';

/**
 * The helpful count, and the button that changes it.
 *
 * Optimistic: the count moves on tap, because a vote that waits for a round
 * trip feels broken on a phone. If the write fails the server action returns
 * an error, React discards the optimistic value on the next render, and the
 * count snaps back with the reason beside it — a visible rollback rather than
 * a silent lie.
 *
 * It sits inside a card that is itself a link, so the click must not bubble
 * up into a navigation.
 */
export default function Vote({ questionId, count, voted }) {
  const [state, action] = useActionState(toggleVote, {});
  const [optimistic, setOptimistic] = useOptimistic(
    { count, voted },
    (_, next) => next,
  );

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const next = {
      voted: !optimistic.voted,
      count: optimistic.count + (optimistic.voted ? -1 : 1),
    };

    const data = new FormData();
    data.set('question_id', questionId);
    data.set('voted', String(optimistic.voted));

    startTransition(() => {
      setOptimistic(next);
      action(data);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={optimistic.voted}
        aria-label={optimistic.voted ? 'Remove your helpful vote' : 'Mark this helpful'}
        className={`cursor-pointer appearance-none inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 font-display text-[0.74rem] font-bold uppercase tracking-[0.1em] transition ${
          optimistic.voted
            ? 'border-brand bg-brand-wash text-brand-deep'
            : 'border-edge bg-surface text-meta hover:border-brand hover:text-brand'
        }`}
      >
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth={optimistic.voted ? 2.4 : 1.8}
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V6.5M12 6.5 6.5 12M12 6.5 17.5 12" />
        </svg>
        {optimistic.count}
        <span className="sr-only"> helpful</span>
      </button>

      {state?.error && (
        <span role="alert" className="text-[0.8rem] text-danger">{state.error}</span>
      )}
    </span>
  );
}

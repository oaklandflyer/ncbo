'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { removeQuestion, removeAnswer } from './actions';
import { btnGhost, btnDanger, btnSmall, buttonReset } from '@/app/ui';

/**
 * Remove a question from the board, behind a confirmation that says what will
 * actually happen.
 *
 * Two things it deliberately does not do:
 *
 *   · It does not confirm on the same button. The first click opens a dialog;
 *     the confirm is a different button with a different label, so a
 *     double-tap on a phone cannot remove anything.
 *   · It does not pretend the row is gone before Postgres agrees. The card
 *     dims while the write is in flight and comes back — with the reason — if
 *     the write is refused. `revalidatePath` on the server is what actually
 *     drops it from the list, so what the moderator sees next is the real
 *     state of the queue rather than an optimistic guess.
 */
export default function Remove({
  questionId, title, answerCount = 0, label = 'Remove', kind = 'question', answerId,
}) {
  const [state, action, pending] = useActionState(
    kind === 'answer' ? removeAnswer : removeQuestion, {},
  );
  const [open, setOpen] = useState(false);
  const confirmRef = useRef(null);

  useEffect(() => { if (open) confirmRef.current?.focus(); }, [open]);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  // Escape closes it, like every other dialog on the platform.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label} — ${kind === 'answer' ? 'this answer' : 'this question'}`}
        className={`${buttonReset} inline-flex min-h-[44px] items-center gap-2 rounded-full border border-danger/40 px-4 font-display text-[0.74rem] font-bold uppercase tracking-[0.1em] text-danger transition hover:border-danger hover:bg-danger hover:text-white`}
      >
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M9.5 7V5.2h5V7M6.5 7l.9 12.3h9.2L17.5 7M10 10.5v6M14 10.5v6" />
        </svg>
        {label}
      </button>

      {state?.error && !open && (
        <p role="alert" className="mt-2 text-[0.85rem] text-danger">{state.error}</p>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`remove-${questionId}-title`}
          className="fixed inset-0 z-[300] flex items-end justify-center bg-scrim/40 p-4 sm:items-center"
        >
          {/* Clicking the backdrop cancels — the safe outcome, so it is the
              one an accidental tap lands on. */}
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setOpen(false)}
            className={`${buttonReset} absolute inset-0 cursor-default`}
          />

          <div className="relative w-full max-w-[460px] rounded-[8px] border border-edge bg-surface p-6 shadow-brand sm:p-7">
            <h2
              id={`remove-${questionId}-title`}
              className="font-display text-[1.3rem] font-extrabold uppercase leading-none text-ink"
            >
              {kind === 'answer' ? 'Remove this answer?' : 'Remove this question?'}
            </h2>

            <p className="mt-4 rounded-[8px] border border-edge bg-band px-4 py-3 text-[0.95rem] leading-relaxed text-body">
              “{title}”
            </p>

            <p className="mt-4 text-[0.95rem] leading-relaxed text-body">
              It comes off the board for everyone, including its author.
              {kind !== 'answer' && answerCount > 0 && (
                <>
                  {' '}The {answerCount} answer{answerCount === 1 ? '' : 's'} written under it
                  {answerCount === 1 ? ' goes' : ' go'} with it.
                </>
              )}
            </p>

            <p className="mt-3 text-[0.85rem] leading-relaxed text-meta">
              Nothing is destroyed — it stays in the database, and a moderator can put it
              back from the Removed list.
            </p>

            {state?.error && (
              <p role="alert" className="mt-4 text-[0.88rem] text-danger">{state.error}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <form action={action}>
                <input type="hidden" name="question_id" value={questionId} />
                {kind === 'answer' && <input type="hidden" name="answer_id" value={answerId} />}
                <button
                  ref={confirmRef}
                  type="submit"
                  disabled={pending}
                  className={`${btnDanger} ${btnSmall}`}
                >
                  {pending ? 'Removing…' : kind === 'answer' ? 'Remove answer' : 'Remove question'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`${btnGhost} ${btnSmall}`}
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useActionState } from 'react';
import { moderateQuestion } from './actions';
import { btnPrimary, btnGhost, btnSmall, FormMessage } from '@/app/ui';

/**
 * The moderator's two buttons on a pending question.
 *
 * One form per decision rather than one form with two submit values: a
 * rejection and an approval are different outcomes, and a mis-click between
 * two buttons in the same form is the easy mistake to make.
 */
export default function Moderate({ questionId }) {
  const [state, action, pending] = useActionState(moderateQuestion, {});

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <form action={action}>
          <input type="hidden" name="question_id" value={questionId} />
          <input type="hidden" name="status" value="approved" />
          <button className={`${btnPrimary} ${btnSmall}`} type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Approve'}
          </button>
        </form>

        <form action={action}>
          <input type="hidden" name="question_id" value={questionId} />
          <input type="hidden" name="status" value="rejected" />
          <button className={`${btnGhost} ${btnSmall}`} type="submit" disabled={pending}>
            Reject
          </button>
        </form>
      </div>

      <FormMessage error={state?.error} />
    </div>
  );
}

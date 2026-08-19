'use client';

import { useActionState } from 'react';
import { setStatus } from './actions';
import { btnPrimary, btnGhost, btnSmall } from '../ui';

export default function PendingRow({ member }) {
  const [state, action, pending] = useActionState(setStatus, {});

  return (
    <tr className="border-b border-edge/70 last:border-0">
      <td className="px-6 py-4">
        <span className="font-display text-[1.05rem] font-bold uppercase tracking-[0.02em] text-ink">
          {member.display_name || <span className="font-body normal-case text-fine">No name yet</span>}
        </span>
        {state?.error && <div className="mt-1 text-[0.82rem] text-danger" role="alert">{state.error}</div>}
        {state?.warning && <div className="mt-1 text-[0.82rem] text-danger" role="alert">{state.warning}</div>}
      </td>
      <td className="px-6 py-4 text-[0.92rem] text-body">
        {member.schools?.name || <span className="text-fine">No school on file</span>}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-wrap gap-2">
          <form action={action}>
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="status" value="approved" />
            <button className={`${btnPrimary} ${btnSmall}`} type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Approve'}
            </button>
          </form>
          <form action={action}>
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="status" value="rejected" />
            <button className={`${btnGhost} ${btnSmall}`} type="submit" disabled={pending}>Decline</button>
          </form>
        </div>
      </td>
    </tr>
  );
}

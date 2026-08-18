'use client';

import { useActionState } from 'react';
import { setStatus } from './actions';

export default function PendingRow({ member }) {
  const [state, action, pending] = useActionState(setStatus, {});

  return (
    <tr>
      <td>
        {member.display_name || <span className="muted">No name yet</span>}
        {state?.error && <div className="msg err" style={{ fontSize: '0.8rem' }}>{state.error}</div>}
        {state?.warning && <div className="msg err" style={{ fontSize: '0.8rem' }}>{state.warning}</div>}
      </td>
      <td>{member.schools?.name || <span className="muted">No school on file</span>}</td>
      <td>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <form action={action}>
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="status" value="approved" />
            <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Approve'}
            </button>
          </form>
          <form action={action}>
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="status" value="rejected" />
            <button className="btn btn-ghost btn-sm" type="submit" disabled={pending}>Decline</button>
          </form>
        </div>
      </td>
    </tr>
  );
}

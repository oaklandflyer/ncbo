'use client';

import { useActionState } from 'react';
import { updateMember } from './actions';

export default function MemberRow({ member, clubs }) {
  const [state, action, pending] = useActionState(updateMember, {});

  return (
    <tr>
      <td>
        {member.display_name}
        {state?.error && <div className="msg err" style={{ fontSize: '0.8rem' }}>{state.error}</div>}
        {state?.ok && <div className="msg ok" style={{ fontSize: '0.8rem' }}>Saved.</div>}
      </td>
      <td>{member.schools?.name || <span className="muted">—</span>}</td>
      <td>
        <form action={action} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <input type="hidden" name="id" value={member.id} />
          <select name="role" defaultValue={member.role} aria-label="Role">
            <option value="member">Member</option>
            <option value="club_lead">Club lead</option>
            <option value="advisor">Advisor</option>
            <option value="admin">Admin</option>
          </select>
          <select name="club_id" defaultValue={member.club_id || ''} aria-label="Club">
            <option value="">No club</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.schools?.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </form>
      </td>
    </tr>
  );
}

'use client';

import { useActionState } from 'react';
import { updateMember } from './actions';
import { btnGhost, btnSmall, field } from '@/app/ui';
import EditMember from './edit-member';

export default function MemberRow({ member, clubs }) {
  const [state, action, pending] = useActionState(updateMember, {});

  return (
    <tr className="border-b border-edge/70 last:border-0">
      <td className="px-6 py-4">
        <span className="font-display text-[1.05rem] font-bold uppercase tracking-[0.02em] text-ink">
          {member.display_name || <span className="font-body normal-case text-fine">No name yet</span>}
        </span>
        {state?.error && <div className="mt-1 text-[0.82rem] text-danger" role="alert">{state.error}</div>}
        {state?.ok && <div className="mt-1 text-[0.82rem] text-brand-deep" role="status">Saved.</div>}
      </td>
      <td className="px-6 py-4 text-[0.92rem] text-body">
        {member.schools?.name || <span className="text-fine">—</span>}
      </td>
      <td className="px-6 py-4">
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={member.id} />
          <select name="role" defaultValue={member.role} aria-label="Role" className={`${field} w-auto py-2 text-[0.9rem]`}>
            <option value="member">Member</option>
            <option value="club_lead">Club lead</option>
            <option value="advisor">Advisor</option>
            <option value="admin">Admin</option>
          </select>
          <select name="club_id" defaultValue={member.club_id || ''} aria-label="Club" className={`${field} w-auto py-2 text-[0.9rem]`}>
            <option value="">No club</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.schools?.name}</option>)}
          </select>
          <button className={`${btnGhost} ${btnSmall}`} type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </form>
      </td>
      <td className="px-6 py-4">
        <EditMember member={member} canRemove />
      </td>
    </tr>
  );
}

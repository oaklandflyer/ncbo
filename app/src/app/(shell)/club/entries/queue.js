'use client';

import { useActionState, useState } from 'react';
import { approveEntries, returnEntry } from '../../entries/actions';
import {
  Card, Badge, Meta, field, fieldLabel, btnPrimary, btnGhost, btnDanger, btnSmall,
  buttonReset, fineprint, FormMessage,
} from '@/app/ui';

/** One show's worth of pending results, with the bulk action scoped to it. */
export function ShowGroup({ show, clubId, entries }) {
  const [state, action, pending] = useActionState(approveEntries, {});

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge pb-4">
        <div className="min-w-0">
          <p className="font-display text-[1.1rem] font-bold uppercase tracking-[0.02em] text-ink">{show}</p>
          <Meta className="mt-1">
            {entries.length} result{entries.length === 1 ? '' : 's'} waiting
          </Meta>
        </div>

        {/* Bulk is scoped to one show, never to the whole queue: "approve
            everything" is the button a tired lead presses at 1am, and it is
            the one that puts unchecked results on a national leaderboard. */}
        <form action={action}>
          <input type="hidden" name="show_name" value={show} />
          <input type="hidden" name="club_id" value={clubId} />
          <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSmall}`}>
            {pending ? 'Approving…' : 'Approve all for this show'}
          </button>
        </form>
      </div>

      <ul className="mt-4 grid list-none gap-3">
        {entries.map((e) => <li key={e.id}><EntryRow entry={e} clubId={clubId} /></li>)}
      </ul>

      <FormMessage error={state.error} ok={state.ok} />
    </Card>
  );
}

function EntryRow({ entry, clubId }) {
  const [approveState, approve, approving] = useActionState(approveEntries, {});
  const [returnState, sendBack, returning] = useActionState(returnEntry, {});
  const [showReturn, setShowReturn] = useState(false);

  if (approveState.ok) return <Meta>{entry.athlete} · {approveState.ok}</Meta>;
  if (returnState.ok) return <Meta>{entry.athlete} · {returnState.ok}</Meta>;

  return (
    <div className="rounded-[6px] border border-edge bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{entry.athlete}</p>
          <Meta className="mt-1">
            {entry.division}
            {entry.class ? ` · ${entry.class}` : ''}
            {` · ${entry.placing}`}
            {entry.won_overall ? ' · overall' : ''}
            {entry.handlers > 0 ? ` · ${entry.handlers} crew` : ''}
          </Meta>
        </div>

        <div className="flex shrink-0 gap-2">
          <form action={approve}>
            <input type="hidden" name="id" value={entry.id} />
            <input type="hidden" name="club_id" value={clubId} />
            <button type="submit" disabled={approving} className={`${btnPrimary} ${btnSmall}`}>Approve</button>
          </form>
          <button type="button" onClick={() => setShowReturn((v) => !v)} className={`${btnGhost} ${btnSmall}`}>
            Send back
          </button>
        </div>
      </div>

      {showReturn && (
        <form action={sendBack} className="mt-3 border-t border-edge pt-3">
          <label className={fieldLabel} htmlFor={`why-${entry.id}`}>What needs fixing?</label>
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="club_id" value={clubId} />
          <textarea
            id={`why-${entry.id}`} name="rejection_reason" rows={2} required maxLength={500}
            className={field} placeholder="The posted results have you in 3rd, not 2nd."
          />
          <p className={`mt-2 ${fineprint}`}>
            The athlete sees this on their entry page. It is the only feedback they get, so it has
            to be enough to act on.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={returning} className={`${btnDanger} ${btnSmall}`}>
              {returning ? 'Sending…' : 'Send back'}
            </button>
            <button type="button" onClick={() => setShowReturn(false)}
                    className={`${buttonReset} px-2 text-[0.85rem] text-meta hover:text-ink`}>
              Cancel
            </button>
          </div>
          <FormMessage error={returnState.error} />
        </form>
      )}

      <FormMessage error={approveState.error} />
    </div>
  );
}

export { EntryRow };

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { removeClubLeadEntry, cleanOrphanedLeads } from './lead-actions';
import {
  Card, Badge, Meta, btnGhost, btnDanger, btnSmall, buttonReset, fineprint,
} from '@/app/ui';

/**
 * Who this chapter says it is led by, and which of those names the Network
 * directory will actually print.
 *
 * One screen for both audiences. An admin reaches it through `?club=` on the
 * chapter switcher, which is the convention `/admin/clubs` already documents —
 * "an admin lands on the lead's own screen for that chapter rather than an
 * admin-only variant of it." The only thing gated to admins is the bulk sweep,
 * because deleting a chapter's seeded history is an organisation decision.
 *
 * There is deliberately no "add a lead" field. A free-text name is exactly
 * what produced the eleven unlinked entries this screen exists to clear, so
 * adding a lead goes through the roster instead, where the candidate has to be
 * a real member of the chapter.
 */
export default function ChapterLeadsForm({ clubId, entries, isAdmin }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(null);

  const orphans = entries.filter((e) => !e.is_published);
  const published = entries.filter((e) => e.is_published);

  const run = (fn, onOk) => startTransition(async () => {
    setError('');
    setNotice('');
    const result = await fn();
    if (result?.error) setError(result.error);
    else onOk?.(result);
  });

  return (
    <div className="grid gap-4">
      {/* What members actually see. Quoting it back is the point of the panel:
          a lead reported this bug by reading the Network tab, so this is the
          same sentence, in the place where it can be fixed. */}
      <Card className="p-5 sm:p-6">
        <p className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-meta">
          On the Network directory
        </p>
        <p className="mt-2 text-[1rem] text-ink">
          {published.length > 0 ? (
            <>Led by {published.map((e) => e.display_name || e.name).join(', ')}</>
          ) : (
            <span className="text-meta">
              No lead is shown for this chapter yet. Names appear here once somebody with a
              live account is named a lead.
            </span>
          )}
        </p>
        {orphans.length > 0 && (
          <Meta className="mt-3">
            {orphans.length} {orphans.length === 1 ? 'entry is' : 'entries are'} hidden because
            there is no live account behind {orphans.length === 1 ? 'it' : 'them'}.
          </Meta>
        )}
      </Card>

      {entries.length === 0 ? (
        <Card className="p-5">
          <p className="text-[0.95rem] text-body">
            Nobody is named as a lead for this chapter. Promote a member from{' '}
            <Link className="font-semibold text-brand underline underline-offset-2" href="/club/roster">
              the roster
            </Link>
            .
          </p>
        </Card>
      ) : (
        <ul className="grid list-none gap-2">
          {entries.map((e) => (
            <li key={e.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-display text-[1rem] font-bold uppercase tracking-[0.02em] text-ink">
                      {e.display_name || e.name}
                    </span>
                    {e.is_published
                      ? <Badge tone="active">Shown</Badge>
                      : <Badge tone="forming">Hidden</Badge>}
                  </span>
                  <Meta className="mt-1">
                    {e.orphan_reason || 'Linked to a live account'}
                    {/* The stored label, when it differs from the account's
                        own name. A seed spelled somebody one way and they have
                        since renamed themselves; showing both is how a lead
                        recognises which row is which. */}
                    {e.display_name && e.name && e.display_name !== e.name && (
                      <> · listed as “{e.name}”</>
                    )}
                  </Meta>
                </span>

                {confirming === e.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(
                        () => removeClubLeadEntry(e.id),
                        () => setConfirming(null),
                      )}
                      className={`${btnDanger} ${btnSmall}`}
                    >
                      {pending ? 'Removing…' : 'Remove'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className={`${btnGhost} ${btnSmall}`}
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setConfirming(e.id); setError(''); }}
                    className={`${buttonReset} min-h-[44px] shrink-0 px-2 font-display text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-meta transition hover:text-danger`}
                  >
                    Remove
                  </button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Admin only, and only worth showing when there is something to sweep. */}
      {isAdmin && orphans.length > 0 && (
        <Card className="p-5">
          <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.04em] text-ink">
            Clear the {orphans.length} hidden {orphans.length === 1 ? 'entry' : 'entries'}
          </p>
          <p className={`mt-2 ${fineprint}`}>
            Deletes them permanently. These are the rows the directory already refuses to
            show — seeded names that never had an account, and names left behind when an
            account was deleted. Nothing currently on screen can be removed this way.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(
              () => cleanOrphanedLeads(clubId),
              (r) => setNotice(
                r.removed > 0
                  ? `Removed ${r.removed} ${r.removed === 1 ? 'entry' : 'entries'}.`
                  : 'Nothing to remove.',
              ),
            )}
            className={`${btnDanger} ${btnSmall} mt-4`}
          >
            {pending ? 'Clearing…' : 'Clear hidden entries'}
          </button>
        </Card>
      )}

      {error && <p role="alert" className="text-[0.9rem] text-danger">{error}</p>}
      {notice && <p role="status" className="text-[0.9rem] text-body">{notice}</p>}
    </div>
  );
}

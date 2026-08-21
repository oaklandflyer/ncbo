'use client';

import { useActionState, useState } from 'react';
import { updateRosterMember, removeFromClub, setCoLead } from './actions';
import {
  Card, Badge, Meta, AlumniBadge, field, fieldLabel, checkline,
  btnPrimary, btnGhost, btnDanger, btnSmall, buttonReset, fineprint, FormMessage,
} from '@/app/ui';
import { UserChip } from '@/app/hub/profile-popup/popup';
import AcademicFields from '@/app/hub/academic-fields';
import { academicLine } from '@/lib/academicYear';

/** Copy every address at once — the reason a lead opens this page at all. */
function CopyEmails({ emails }) {
  const [copied, setCopied] = useState('');

  async function copy() {
    const text = emails.filter(Boolean).join(', ');
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied.');
    } catch {
      /* Clipboard is blocked outside a secure context and in some embedded
         browsers. Say so rather than silently doing nothing. */
      setCopied('Your browser blocked the copy. Select the addresses instead.');
    }
    setTimeout(() => setCopied(''), 4000);
  }

  return (
    <span className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={copy} className={`${btnGhost} ${btnSmall} bg-surface`}>
        Copy all emails
      </button>
      {copied && <span role="status" className={fineprint}>{copied}</span>}
    </span>
  );
}

function MemberEditor({ member, canPromote }) {
  const [state, action, pending] = useActionState(updateRosterMember, {});
  const [removeState, removeAction, removing] = useActionState(removeFromClub, {});
  const [leadState, leadAction, leadPending] = useActionState(setCoLead, {});
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} className={`${btnGhost} ${btnSmall}`}>
        {open ? 'Close' : 'Manage'}
      </button>

      {open && (
        <div className="mt-4 w-full border-t border-edge pt-4">
          <form action={action} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={member.id} />
            <div>
              <label className={fieldLabel} htmlFor={`div-${member.id}`}>Division</label>
              <input id={`div-${member.id}`} name="division" defaultValue={member.division || ''}
                     className={field} maxLength={60} />
            </div>
            <AcademicFields person={member} idPrefix={`m-${member.id}-`} />

            <label className={`${checkline} sm:col-span-2 rounded-[8px] border border-edge bg-band px-4 py-3`}>
              <input type="checkbox" name="is_alumni" defaultChecked={!!member.is_alumni}
                     className="h-4 w-4 accent-[#2F5FA8]" />
              <span>Graduated, so show as Alumni</span>
            </label>

            <div className="sm:col-span-2">
              <FormMessage error={state?.error} ok={state?.ok && 'Saved.'} />
              <button className={`${btnPrimary} ${btnSmall} mt-3`} type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-edge pt-4">
            {canPromote && (
              <form action={leadAction}>
                <input type="hidden" name="id" value={member.id} />
                <input type="hidden" name="lead" value={member.is_lead ? 'false' : 'true'} />
                <button className={`${btnGhost} ${btnSmall}`} type="submit" disabled={leadPending}>
                  {leadPending ? 'Working…' : member.is_lead ? 'Step down as lead' : 'Make co-lead'}
                </button>
              </form>
            )}

            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={`${buttonReset} min-h-[44px] font-display text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-meta transition hover:text-danger`}
              >
                Remove from roster
              </button>
            ) : (
              <div className="w-full rounded-[8px] border border-edge bg-band p-4">
                <p className="text-[0.95rem] leading-relaxed text-body">
                  <b className="font-semibold text-ink">{member.display_name}</b> comes off this
                  club’s roster. They keep their NCBO account, their posts and everyone they know
                  here. They just stop being one of your members.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={removeAction}>
                    <input type="hidden" name="id" value={member.id} />
                    <button className={`${btnDanger} ${btnSmall}`} type="submit" disabled={removing}>
                      {removing ? 'Removing…' : 'Remove from roster'}
                    </button>
                  </form>
                  <button type="button" onClick={() => setConfirming(false)}
                          className={`${btnGhost} ${btnSmall}`}>
                    Keep them
                  </button>
                </div>
              </div>
            )}
          </div>

          {(removeState?.error || leadState?.error) && (
            <p role="alert" className="mt-3 text-[0.88rem] text-danger">
              {removeState?.error || leadState?.error}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Cards, not a table — even on desktop.
 *
 * Seven columns of mixed-length text squeezed into a phone is the failure the
 * brief called out, and a table that becomes cards below `sm` still has to be
 * maintained twice. One layout, and the row expands in place to edit.
 */
export default function RosterTable({ members, canPromote }) {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[0.98rem] text-body">
          {members.length} {members.length === 1 ? 'member' : 'members'} on this roster.
        </p>
        <CopyEmails emails={members.map((m) => m.email)} />
      </div>

      <ul className="grid list-none gap-3">
        {members.map((m) => {
          const academic = academicLine(m) || (m.class_year ? `Class of ${m.class_year}` : null);
          return (
          <li key={m.id}>
            <Card className="p-5 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <UserChip
                      userId={m.id}
                      className="font-display text-[1.05rem] font-bold uppercase tracking-[0.02em] text-ink"
                    >
                      {m.display_name}
                    </UserChip>
                    {m.is_lead && <Badge tone="active">Lead</Badge>}
                    {m.role !== 'member' && m.role !== 'club_lead' && (
                      <Badge tone="forming">{m.role}</Badge>
                    )}
                    {m.is_alumni_effective && <AlumniBadge since={m.alumni_since} />}
                  </div>

                  {/* The address is the point of this screen — selectable, and
                      never truncated into uselessness. */}
                  <p className="mt-2 break-all text-[0.95rem] text-body">
                    <a href={`mailto:${m.email}`} className="underline decoration-edge underline-offset-2 hover:text-brand">
                      {m.email || <span className="text-fine">No address on file</span>}
                    </a>
                  </p>

                  {/* "Class of 2027 · Undergraduate", built by one helper so
                      the roster, the profile and the directory cannot word it
                      three different ways. `class_year` is deprecated and is
                      the fallback only until the backfill has been verified in
                      production. */}
                  <Meta className="mt-2">
                    {m.division && <span>{m.division}</span>}
                    {m.division && academic && <span aria-hidden className="text-fine">·</span>}
                    {academic && <span>{academic}</span>}
                    {(m.division || academic) && <span aria-hidden className="text-fine">·</span>}
                    <span>Joined {new Date(m.created_at).toLocaleDateString()}</span>
                  </Meta>
                </div>

                <MemberEditor member={m} canPromote={canPromote} />
              </div>
            </Card>
          </li>
          );
        })}
      </ul>
    </>
  );
}

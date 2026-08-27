'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import {
  updateRosterMember, removeMemberFromClub, transferLeadership, setCoLead,
} from './actions';
import {
  Badge, Meta, AlumniBadge, field, fieldLabel, checkline,
  btnPrimary, btnGhost, btnDanger, btnSmall, buttonReset, fineprint, FormMessage,
} from '@/app/ui';
import { UserChip } from '@/app/hub/profile-popup/popup';
import AcademicFields from '@/app/hub/academic-fields';
import { academicLine } from '@/lib/academicYear';

/**
 * The chapter roster a club lead manages.
 *
 * One markup, two shapes. Below `md` each member is a stacked card; from `md`
 * up the same grid resolves into aligned columns under a header row, which is
 * a data table in every way that matters and needs no second implementation.
 * The alternative — a `<table>` for desktop and cards for phones — is two
 * layouts to keep in step, and the one that drifts is always the one nobody is
 * looking at.
 *
 * Colour is entirely tokens (`bg-surface`, `bg-band`, `text-ink`). In dark
 * mode those resolve to zinc-950 for the page and zinc-900 for rows, which is
 * the dark table this was asked for; in light mode the same class names stay
 * legible. Hardcoding `bg-zinc-950` would have made this one screen unreadable
 * for anybody on the light theme.
 */

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

function DotsIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

/**
 * The per-row menu.
 *
 * Both destructive actions live behind it rather than as bare buttons in the
 * row, because a roster is a list somebody scrolls with a thumb and "Remove"
 * sitting under that thumb is an accident waiting to happen. Each one then
 * asks again in words that say what actually happens, since neither is
 * undoable by the lead who did it.
 */
function RowMenu({ member, isSelf, onRemove, onTransfer, onCoLead, busy }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setConfirming(null);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); setConfirming(null); }
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* A lead has nothing to do to themselves from this menu: removing yourself
     is refused by the database, and transferring to yourself is a no-op. The
     row keeps its dots hidden rather than offering two actions that both end
     in an error message. */
  if (isSelf) {
    return <span className={`${fineprint} whitespace-nowrap`}>You</span>;
  }

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${member.display_name || 'this member'}`}
        onClick={() => { setOpen((v) => !v); setConfirming(null); }}
        disabled={busy}
        className={`${buttonReset} grid h-11 w-11 place-items-center rounded-[8px] text-meta transition-colors hover:bg-band hover:text-ink disabled:opacity-50`}
      >
        <DotsIcon />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-[60] w-[268px] rounded-[10px] border border-edge bg-surface p-2 shadow-[0_18px_50px_rgba(10,20,36,0.28)]"
        >
          {confirming === null && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirming('lead')}
                className={`${buttonReset} block w-full rounded-[6px] px-3 py-3 text-left text-[0.95rem] text-ink hover:bg-band`}
              >
                Make Chapter Lead
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirming('colead')}
                className={`${buttonReset} block w-full rounded-[6px] px-3 py-3 text-left text-[0.95rem] text-ink hover:bg-band`}
              >
                {member.is_lead ? 'Step down as co-lead' : 'Make co-lead'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirming('remove')}
                className={`${buttonReset} block w-full rounded-[6px] px-3 py-3 text-left text-[0.95rem] text-danger hover:bg-band`}
              >
                Remove from Chapter
              </button>
            </>
          )}

          {confirming === 'remove' && (
            <Confirm
              body={
                <>
                  <b className="font-semibold text-ink">{member.display_name}</b> comes off this
                  chapter’s roster. They keep their NCBO account, their posts and everyone they
                  know here — they stop being one of your members, and stop counting toward your
                  Chapter Cup roster points.
                </>
              }
              confirmLabel="Remove from Chapter"
              danger
              busy={busy}
              onCancel={() => setConfirming(null)}
              onConfirm={() => { onRemove(); setOpen(false); setConfirming(null); }}
            />
          )}

          {confirming === 'lead' && (
            <Confirm
              body={
                <>
                  <b className="font-semibold text-ink">{member.display_name}</b> becomes the
                  chapter lead and <b className="font-semibold text-ink">you become an ordinary
                  member</b>. There is one lead seat and this hands it over — you will not be able
                  to undo it yourself afterwards.
                </>
              }
              confirmLabel="Transfer the chapter"
              danger
              busy={busy}
              onCancel={() => setConfirming(null)}
              onConfirm={() => { onTransfer(); setOpen(false); setConfirming(null); }}
            />
          )}

          {confirming === 'colead' && (
            <Confirm
              body={
                member.is_lead ? (
                  <>
                    <b className="font-semibold text-ink">{member.display_name}</b> stops being a
                    co-lead. They stay on the roster as a member.
                  </>
                ) : (
                  <>
                    <b className="font-semibold text-ink">{member.display_name}</b> becomes a
                    co-lead: they can review applications and manage this roster alongside you.
                    You stay the chapter lead.
                  </>
                )
              }
              confirmLabel={member.is_lead ? 'Step them down' : 'Make co-lead'}
              busy={busy}
              onCancel={() => setConfirming(null)}
              onConfirm={() => { onCoLead(!member.is_lead); setOpen(false); setConfirming(null); }}
            />
          )}
        </div>
      )}
    </span>
  );
}

function Confirm({ body, confirmLabel, onConfirm, onCancel, busy, danger = false }) {
  return (
    <div className="p-2">
      <p className="text-[0.9rem] leading-relaxed text-body">{body}</p>
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`${danger ? btnDanger : btnPrimary} ${btnSmall} w-full`}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button type="button" onClick={onCancel} className={`${btnGhost} ${btnSmall} w-full`}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** The editable fields, kept behind a disclosure so the table stays a table. */
function MemberEditor({ member }) {
  const [state, action, pending] = useActionState(updateRosterMember, {});
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${btnGhost} ${btnSmall} whitespace-nowrap`}
      >
        {open ? 'Close' : 'Edit'}
      </button>

      {open && (
        <form action={action} className="mt-4 grid w-full gap-4 border-t border-edge pt-4 sm:grid-cols-2">
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
      )}
    </>
  );
}

/* One grid template, shared by the header and every row, so the columns cannot
   drift apart. Below `md` the whole thing stacks and the header is hidden. */
const ROW = 'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,1.4fr)_auto] md:items-center md:gap-4';

function MemberRow({ member, canPromote, viewerId }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [leadState, leadAction] = useActionState(setCoLead, {});

  const academic = academicLine(member)
    || (member.class_year ? `Class of ${member.class_year}` : null);

  /* The two destructive actions take an id and nothing else, so they are
     called through a transition rather than a form — there is no field for a
     form to carry. */
  const run = (fn) => startTransition(async () => {
    setError('');
    const result = await fn();
    if (result?.error) setError(result.error);
  });

  return (
    <li className="border-b border-edge last:border-b-0">
      <div className={`px-4 py-4 hover:bg-band md:px-5 ${ROW}`}>
        {/* name */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <UserChip
              userId={member.id}
              className="font-display text-[1.02rem] font-bold uppercase tracking-[0.02em] text-ink"
            >
              {member.display_name || 'No name yet'}
            </UserChip>
            {member.is_lead && <Badge tone="active">Lead</Badge>}
            {member.is_alumni_effective && <AlumniBadge since={member.alumni_since} />}
          </div>
        </div>

        {/* address — the point of this screen, so selectable and never truncated */}
        <div className="mt-2 min-w-0 md:mt-0">
          <a
            href={`mailto:${member.email}`}
            className="block break-all text-[0.92rem] text-body underline decoration-edge underline-offset-2 hover:text-brand"
          >
            {member.email || <span className="text-fine">No address on file</span>}
          </a>
        </div>

        {/* division / class */}
        <div className="mt-2 min-w-0 md:mt-0">
          <Meta>
            {member.division && <span>{member.division}</span>}
            {member.division && academic && <span aria-hidden className="text-fine">·</span>}
            {academic && <span>{academic}</span>}
            {!member.division && !academic && <span className="text-fine">—</span>}
          </Meta>
        </div>

        {/* actions */}
        <div className="mt-3 flex items-center justify-end gap-2 md:mt-0">
          <MemberEditor member={member} />
          {canPromote && (
            <RowMenu
              member={member}
              isSelf={member.id === viewerId}
              busy={pending}
              onRemove={() => run(() => removeMemberFromClub(member.id))}
              onTransfer={() => run(() => transferLeadership(member.id))}
              onCoLead={(make) => {
                const data = new FormData();
                data.set('id', member.id);
                data.set('lead', make ? 'true' : 'false');
                startTransition(() => leadAction(data));
              }}
            />
          )}
        </div>
      </div>

      {(error || leadState?.error) && (
        <p role="alert" className="px-4 pb-4 text-[0.88rem] text-danger md:px-5">
          {error || leadState.error}
        </p>
      )}
    </li>
  );
}

export default function RosterTable({ members, canPromote, viewerId = null }) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[0.98rem] text-body">
          {members.length} {members.length === 1 ? 'member' : 'members'} on this roster.
        </p>
        <CopyEmails emails={members.map((m) => m.email)} />
      </div>

      <div className="overflow-hidden rounded-[10px] border border-edge bg-surface">
        {/* The header exists from `md` up, where the rows actually line up into
            columns. On a phone it would be a row of labels above stacked
            cards, which is noise. */}
        <div
          className={`hidden border-b border-edge bg-band px-5 py-3 font-display text-[0.68rem] font-bold uppercase tracking-[0.14em] text-meta ${ROW}`}
        >
          <span>Member</span>
          <span>Email</span>
          <span>Division &amp; class</span>
          <span className="text-right">Actions</span>
        </div>

        <ul className="list-none">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} canPromote={canPromote} viewerId={viewerId} />
          ))}
        </ul>
      </div>
    </>
  );
}

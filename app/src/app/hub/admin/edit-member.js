'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { editMember, removeMember, removeFromRoster } from './actions';
import {
  field, fieldLabel, checkline, btnPrimary, btnGhost, btnDanger, btnSmall,
  buttonReset, fineprint, FormMessage,
} from '@/app/ui';

/**
 * Edit one member, in a dialog.
 *
 * What it offers depends on who is looking: an admin sees the remove button, a
 * club lead sees "take off roster" instead. Neither is the actual gate —
 * `guard_profile_privileges()` refuses anything the caller may not write, so
 * the worst a mis-drawn button can do is produce an error message.
 */
export default function EditMember({ member, canRemove = false, canRoster = false }) {
  const [state, action, pending] = useActionState(editMember, {});
  const [removeState, removeAction, removing] = useActionState(
    canRemove ? removeMember : removeFromRoster, {},
  );
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const firstFieldRef = useRef(null);

  useEffect(() => { if (open) firstFieldRef.current?.focus(); }, [open]);
  useEffect(() => { if (removeState?.ok) { setOpen(false); setConfirming(false); } }, [removeState]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setConfirming(false); setOpen(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btnGhost} ${btnSmall}`}>
        Edit
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${member.display_name || 'member'}`}
          className="fixed inset-0 z-[300] flex items-end justify-center overflow-y-auto bg-scrim/40 p-4 sm:items-center"
        >
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setOpen(false)}
            className={`${buttonReset} absolute inset-0 cursor-default`}
          />

          <div className="relative my-auto w-full max-w-[520px] rounded-[8px] border border-edge bg-surface p-6 shadow-brand sm:p-7">
            <h2 className="font-display text-[1.3rem] font-extrabold uppercase leading-none text-ink">
              {member.display_name || 'Member'}
            </h2>
            <p className={`mt-2 ${fineprint}`}>
              {member.schools?.name || member.school_name || 'No school on file'}
            </p>

            <form action={action} className="mt-6 grid gap-5">
              <input type="hidden" name="id" value={member.id} />

              <div>
                <label className={fieldLabel} htmlFor={`n-${member.id}`}>Display name</label>
                <input
                  ref={firstFieldRef} id={`n-${member.id}`} name="display_name"
                  defaultValue={member.display_name || ''} className={field} maxLength={80}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={fieldLabel} htmlFor={`d-${member.id}`}>Division</label>
                  <input id={`d-${member.id}`} name="division"
                         defaultValue={member.division || ''} className={field} maxLength={60} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor={`r-${member.id}`}>Home region</label>
                  <input id={`r-${member.id}`} name="home_region"
                         defaultValue={member.home_region || ''} className={field} maxLength={80} />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={fieldLabel} htmlFor={`ig-${member.id}`}>Instagram</label>
                  <input id={`ig-${member.id}`} name="instagram_handle"
                         defaultValue={member.instagram_handle || ''} className={field}
                         autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor={`tt-${member.id}`}>TikTok</label>
                  <input id={`tt-${member.id}`} name="tiktok_handle"
                         defaultValue={member.tiktok_handle || ''} className={field}
                         autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                </div>
              </div>

              <label className={`${checkline} rounded-[8px] border border-edge bg-band px-4 py-3`}>
                <input type="checkbox" name="is_alumni" defaultChecked={!!member.is_alumni}
                       className="h-4 w-4 accent-[#2F5FA8]" />
                <span>Graduated — show as Alumni in the directory</span>
              </label>

              <FormMessage error={state?.error} ok={state?.ok && 'Saved.'} />

              <div className="flex flex-wrap gap-3">
                <button className={`${btnPrimary} ${btnSmall}`} type="submit" disabled={pending}>
                  {pending ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className={`${btnGhost} ${btnSmall}`}>
                  Done
                </button>
              </div>
            </form>

            {(canRemove || canRoster) && (
              <div className="mt-7 border-t border-edge pt-5">
                {!confirming ? (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className={`${buttonReset} min-h-[44px] font-display text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-meta transition hover:text-danger`}
                  >
                    {canRemove ? 'Remove from NCBO' : 'Take off this club’s roster'}
                  </button>
                ) : (
                  <div>
                    <p className="text-[0.95rem] leading-relaxed text-body">
                      {canRemove
                        ? `${member.display_name || 'This member'} will be signed out, removed from every directory, and unable to sign back in. Their posts and answers stay, with their name on them. An admin can undo this by setting their status back to approved.`
                        : `${member.display_name || 'This member'} stays on the platform and keeps their account — they just come off this club’s roster.`}
                    </p>

                    {removeState?.error && (
                      <p role="alert" className="mt-3 text-[0.88rem] text-danger">{removeState.error}</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <form action={removeAction}>
                        <input type="hidden" name="id" value={member.id} />
                        <button className={`${btnDanger} ${btnSmall}`} type="submit" disabled={removing}>
                          {removing ? 'Working…' : canRemove ? 'Remove member' : 'Remove from roster'}
                        </button>
                      </form>
                      <button type="button" onClick={() => setConfirming(false)}
                              className={`${btnGhost} ${btnSmall}`}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

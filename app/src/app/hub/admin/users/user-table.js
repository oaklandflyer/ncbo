'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { adminUpdateUser, adminRemoveUser, adminRestoreUser } from './actions';
import { hardDeleteUser } from './delete-actions';
import {
  Card, Badge, Meta, AlumniBadge, VettedSeal, field, fieldLabel, checkline,
  btnPrimary, btnGhost, btnDanger, btnSmall, buttonReset, fineprint, FormMessage,
} from '@/app/ui';
import AcademicFields from '@/app/hub/academic-fields';
import { UserChip } from '@/app/hub/profile-popup/popup';

const ROLES = [['member', 'Member'], ['club_lead', 'Club lead'], ['advisor', 'Advisor'], ['admin', 'Admin']];

/**
 * The permanent deletion panel.
 *
 * It enumerates both halves before it asks for anything. "This cannot be
 * undone" is true and useless; what an admin actually needs to know is that
 * the chapter keeps its Chapter Cup points and that the person's answers stay
 * on the board under their name, because those are the two things somebody
 * will ask about afterwards.
 *
 * The email has to be typed. Not a checkbox, not a second click: typing the
 * address is the only confirmation that cannot be done by muscle memory on
 * the wrong row.
 */
function HardDelete({ user, onDone }) {
  const [state, action, pending] = useActionState(hardDeleteUser, {});
  const [typed, setTyped] = useState('');

  const matches = !!user.email && typed.trim().toLowerCase() === String(user.email).toLowerCase();

  /* Depends on the flag, not on `state` and `onDone`. `onDone` is an inline
     arrow recreated every render, so the old deps re-ran this on every render
     and called it repeatedly once the delete had succeeded. */
  const succeeded = Boolean(state?.ok);
  useEffect(() => { if (succeeded) onDone?.(); }, [succeeded]);

  return (
    <div className="mt-4 w-full rounded-[8px] border border-danger bg-[rgba(180,50,74,0.05)] p-5">
      <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.04em] text-danger">
        Delete {user.display_name || 'this account'} permanently
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-display text-[0.7rem] font-bold uppercase tracking-[0.14em] text-danger">
            Destroyed
          </p>
          <ul className="mt-2 list-none text-[0.88rem] leading-relaxed text-body">
            <li>Their sign-in. They cannot log in again, ever.</li>
            <li>Their profile and club membership.</li>
            <li>Every vote they cast, and any org role.</li>
            <li>Their student ID photo, if they uploaded one.</li>
          </ul>
        </div>
        <div>
          <p className="font-display text-[0.7rem] font-bold uppercase tracking-[0.14em] text-brand">
            Kept, under their name
          </p>
          <ul className="mt-2 list-none text-[0.88rem] leading-relaxed text-body">
            <li>Verified competition results, so their chapter keeps the points.</li>
            <li>Handler credits, for the same reason.</li>
            <li>Questions and answers, so other people&rsquo;s threads still read.</li>
            <li>This deletion, in the audit log.</li>
          </ul>
        </div>
      </div>

      <form action={action} className="mt-5">
        <input type="hidden" name="target_id" value={user.id} />
        <label className={fieldLabel} htmlFor={`confirm-${user.id}`}>
          Type {user.email || 'the account email'} to confirm
        </label>
        <input
          id={`confirm-${user.id}`}
          name="confirm_email"
          className={field}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={!matches || pending}
          className={`${btnDanger} mt-4`}
        >
          {pending ? 'Deleting…' : 'Delete permanently'}
        </button>
      </form>

      <FormMessage error={state?.error} ok={state?.ok} />
    </div>
  );
}

function UserEditor({
  user, clubs, schools, isSelf, canHardDelete = false, hardDeleteConfigured = false,
}) {
  const [state, action, pending] = useActionState(adminUpdateUser, {});
  const [removeState, removeAction, removing] = useActionState(adminRemoveUser, {});
  const [restoreState, restoreAction, restoring] = useActionState(adminRestoreUser, {});
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging] = useState(false);

  const removed = !!user.deleted_at || user.status === 'removed';

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className={`${btnGhost} ${btnSmall}`}>
          {open ? 'Close' : 'Edit'}
        </button>

        {removed && (
          <form action={restoreAction}>
            <input type="hidden" name="id" value={user.id} />
            <button className={`${btnGhost} ${btnSmall}`} type="submit" disabled={restoring}>
              {restoring ? 'Restoring…' : 'Restore'}
            </button>
          </form>
        )}

        {/* Three conditions, all required: an admin, an account already in the
            REMOVED state, and not yourself. Restore sits beside it on purpose,
            so the reversible option is never further away than the
            irreversible one. */}
        {removed && canHardDelete && !isSelf && hardDeleteConfigured && (
          <button
            type="button"
            onClick={() => setPurging((v) => !v)}
            className={`${btnGhost} ${btnSmall} border-danger text-danger`}
          >
            {purging ? 'Cancel' : 'Delete permanently'}
          </button>
        )}
      </div>

      {/* The control used to be hidden when the deployment had no service-role
          key, which meant the feature "did not work" and nothing anywhere said
          why: an admin looking at a removed account saw no button and no
          reason for its absence. A disabled control that explains itself is
          always better than a missing one. */}
      {removed && canHardDelete && !isSelf && !hardDeleteConfigured && (
        <p className={`mt-2 w-full ${fineprint}`}>
          Permanent deletion is unavailable: this deployment has no
          {' '}<code className="font-mono text-[0.82rem]">SUPABASE_SERVICE_ROLE_KEY</code>.
          Add it to the Vercel project for Preview and Production, then redeploy.
        </p>
      )}

      {purging && <HardDelete user={user} onDone={() => setPurging(false)} />}

      {(restoreState?.error || removeState?.error) && (
        <p role="alert" className="mt-2 w-full text-[0.85rem] text-danger">
          {restoreState?.error || removeState?.error}
        </p>
      )}

      {open && (
        <div className="mt-4 w-full border-t border-edge pt-4">
          <form action={action} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={user.id} />

            <div className="sm:col-span-2">
              <label className={fieldLabel} htmlFor={`n-${user.id}`}>Display name</label>
              <input id={`n-${user.id}`} name="display_name" defaultValue={user.display_name || ''}
                     className={field} maxLength={80} />
            </div>

            <div>
              <label className={fieldLabel} htmlFor={`role-${user.id}`}>Role</label>
              <select id={`role-${user.id}`} name="role" defaultValue={user.role}
                      className={`${field} py-3`}>
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className={fieldLabel} htmlFor={`club-${user.id}`}>Club</label>
              <select id={`club-${user.id}`} name="club_id" defaultValue={user.club_id || ''}
                      className={`${field} py-3`}>
                <option value="">No club</option>
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.club_name}</option>)}
              </select>
            </div>

            <div>
              <label className={fieldLabel} htmlFor={`school-${user.id}`}>School</label>
              <select id={`school-${user.id}`} name="school_id" defaultValue={user.school_id || ''}
                      className={`${field} py-3`}>
                <option value="">No school</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className={fieldLabel} htmlFor={`div-${user.id}`}>Division</label>
              <input id={`div-${user.id}`} name="division" defaultValue={user.division || ''}
                     className={field} maxLength={60} />
            </div>

            <AcademicFields person={user} idPrefix={`u-${user.id}-`} />

            <div>
              <label className={fieldLabel} htmlFor={`hr-${user.id}`}>Home region</label>
              <input id={`hr-${user.id}`} name="home_region" defaultValue={user.home_region || ''}
                     className={field} maxLength={80} />
            </div>

            <div>
              <label className={fieldLabel} htmlFor={`ig-${user.id}`}>Instagram</label>
              <input id={`ig-${user.id}`} name="instagram_handle" defaultValue={user.instagram_handle || ''}
                     className={field} autoCapitalize="none" spellCheck={false} />
            </div>

            <div>
              <label className={fieldLabel} htmlFor={`tt-${user.id}`}>TikTok</label>
              <input id={`tt-${user.id}`} name="tiktok_handle" defaultValue={user.tiktok_handle || ''}
                     className={field} autoCapitalize="none" spellCheck={false} />
            </div>

            <label className={`${checkline} rounded-[8px] border border-edge bg-band px-4 py-3`}>
              <input type="checkbox" name="verified" defaultChecked={!!user.verified}
                     className="h-4 w-4 accent-[#2F5FA8]" />
              <span>NCBO vetted</span>
            </label>

            <label className={`${checkline} rounded-[8px] border border-edge bg-band px-4 py-3`}>
              <input type="checkbox" name="is_alumni" defaultChecked={!!user.is_alumni}
                     className="h-4 w-4 accent-[#2F5FA8]" />
              <span>Alumni</span>
            </label>

            <div className="sm:col-span-2">
              <FormMessage error={state?.error} ok={state?.ok && 'Saved.'} />
              <button className={`${btnPrimary} ${btnSmall} mt-3`} type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>

          {!removed && (
            <div className="mt-6 border-t border-edge pt-5">
              {isSelf ? (
                <p className={fineprint}>
                  This is your own account, and an admin can’t remove themselves. Ask another
                  admin if you need it closed.
                </p>
              ) : !confirming ? (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className={`${buttonReset} min-h-[44px] font-display text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-meta transition hover:text-danger`}
                >
                  Remove this user
                </button>
              ) : (
                <div>
                  <p className="text-[0.95rem] leading-relaxed text-body">
                    <b className="font-semibold text-ink">{user.display_name}</b> will be signed
                    out and unable to sign back in, and disappears from every directory. Their
                    questions and answers stay on the board with their name on them. Nothing is
                    deleted, and you can restore the account from this page.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <form action={removeAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <button className={`${btnDanger} ${btnSmall}`} type="submit" disabled={removing}>
                        {removing ? 'Removing…' : 'Remove user'}
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
      )}
    </>
  );
}

export default function UserTable({
  users, clubs, schools, viewerId, canHardDelete = false, hardDeleteConfigured = false,
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [club, setClub] = useState('');
  /*
   * Ghosts: signed in with Google, closed the tab, never finished. Supabase
   * made them an account the moment OAuth returned.
   *
   * Hidden by default because they are noise on a roster, and behind a toggle
   * rather than filtered out of the query, because an admin who cannot SEE a
   * ghost cannot delete one — and deleting them is the only thing anybody
   * wants to do with them.
   */
  const [showGhosts, setShowGhosts] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (!showGhosts && u.onboarded === false) return false;
      if (role && u.role !== role) return false;
      if (club && u.club_id !== club) return false;
      if (!q) return true;
      return `${u.display_name} ${u.email || ''} ${u.club_name || ''} ${u.school_name || ''}`
        .toLowerCase().includes(q);
    });
  }, [users, query, role, club, showGhosts]);

  /* Counted from everybody, not from what is shown, so the label says how many
     are being hidden rather than how many are already visible. */
  const ghostCount = useMemo(
    () => users.filter((u) => u.onboarded === false).length,
    [users],
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className="sr-only" htmlFor="user-search">Search members</label>
          <input id="user-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search by name, email, club or school" className={`${field} min-h-[44px]`} />
        </div>
        <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)}
                className={`${field} py-3`}>
          <option value="">All roles</option>
          {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="Filter by club" value={club} onChange={(e) => setClub(e.target.value)}
                className={`${field} py-3`}>
          <option value="">All clubs</option>
          {clubs.map((c) => <option key={c.id} value={c.id}>{c.club_name}</option>)}
        </select>
        <label className={`${checkline} sm:col-span-2 self-center`}>
          <input
            type="checkbox"
            checked={showGhosts}
            onChange={(e) => setShowGhosts(e.target.checked)}
            className="h-4 w-4 accent-[#2F5FA8]"
          />
          <span className={fineprint}>
            Show accounts that never finished signup
            {ghostCount > 0 ? ` (${ghostCount})` : ''}
          </span>
        </label>

        <p className={`self-center ${fineprint}`}>
          {shown.length} of {users.length}
        </p>
      </div>

      <ul className="mt-6 grid list-none gap-3">
        {shown.map((u) => {
          const removed = !!u.deleted_at || u.status === 'removed';
          return (
            <li key={u.id}>
              <Card className={`p-5 sm:p-5 ${removed ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      {/* The same popup the Network and the roster use, not a
                          second modal. It is enforced by projection:
                          `get_public_profile` returns only what a summary may
                          show, so no component here can leak an email by
                          rendering one more field. */}
                      <UserChip
                        userId={u.id}
                        className="font-display text-[1.05rem] font-bold uppercase tracking-[0.02em] text-ink"
                      >
                        {u.display_name || <span className="text-fine">No name yet</span>}
                      </UserChip>
                      {u.onboarded === false && <Badge tone="pending">Never finished signup</Badge>}
                      {u.role !== 'member' && <Badge tone="active">{u.role.replace('_', ' ')}</Badge>}
                      {u.verified && <VettedSeal />}
                      {u.is_alumni_effective && <AlumniBadge since={u.alumni_since} />}
                      {/* A projected year is a guess the backfill made from a
                          relative standing, and a guess nothing surfaces
                          becomes a fact by default. This is the only place
                          that says so, and opening EDIT and saving clears it,
                          because picking a year from the dropdown states it. */}
                      {u.grad_year_inferred && (
                        <Badge tone="forming">Confirm {u.grad_year}</Badge>
                      )}
                      {removed && <Badge tone="forming">Removed</Badge>}
                      {u.status === 'pending' && <Badge tone="pending">Pending</Badge>}
                    </div>

                    <p className="mt-2 break-all text-[0.95rem] text-body">
                      {u.email || <span className="text-fine">No address on file</span>}
                    </p>

                    <Meta className="mt-2">
                      {u.club_name && <span>{u.club_name}</span>}
                      {u.club_name && u.school_name && <span aria-hidden className="text-fine">·</span>}
                      {u.school_name && <span>{u.school_name}</span>}
                    </Meta>
                  </div>

                  <UserEditor
                    user={u}
                    clubs={clubs}
                    schools={schools}
                    isSelf={u.id === viewerId}
                    canHardDelete={canHardDelete}
                    hardDeleteConfigured={hardDeleteConfigured}
                  />
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}

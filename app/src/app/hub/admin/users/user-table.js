'use client';

import { useActionState, useMemo, useState } from 'react';
import { adminUpdateUser, adminRemoveUser, adminRestoreUser } from './actions';
import {
  Card, Badge, Meta, AlumniBadge, VettedSeal, field, fieldLabel, checkline,
  btnPrimary, btnGhost, btnDanger, btnSmall, buttonReset, fineprint, FormMessage,
} from '@/app/ui';

const ROLES = [['member', 'Member'], ['club_lead', 'Club lead'], ['advisor', 'Advisor'], ['admin', 'Admin']];

function UserEditor({ user, clubs, schools, isSelf }) {
  const [state, action, pending] = useActionState(adminUpdateUser, {});
  const [removeState, removeAction, removing] = useActionState(adminRemoveUser, {});
  const [restoreState, restoreAction, restoring] = useActionState(adminRestoreUser, {});
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
      </div>

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

            <div>
              <label className={fieldLabel} htmlFor={`cy-${user.id}`}>Class year</label>
              <input id={`cy-${user.id}`} name="class_year" defaultValue={user.class_year || ''}
                     className={field} maxLength={20} />
            </div>

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

export default function UserTable({ users, clubs, schools, viewerId }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [club, setClub] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (role && u.role !== role) return false;
      if (club && u.club_id !== club) return false;
      if (!q) return true;
      return `${u.display_name} ${u.email || ''} ${u.club_name || ''} ${u.school_name || ''}`
        .toLowerCase().includes(q);
    });
  }, [users, query, role, club]);

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
                      <span className="font-display text-[1.05rem] font-bold uppercase tracking-[0.02em] text-ink">
                        {u.display_name}
                      </span>
                      {u.role !== 'member' && <Badge tone="active">{u.role.replace('_', ' ')}</Badge>}
                      {u.verified && <VettedSeal />}
                      {u.is_alumni && <AlumniBadge since={u.alumni_since} />}
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

                  <UserEditor user={u} clubs={clubs} schools={schools} isSelf={u.id === viewerId} />
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}

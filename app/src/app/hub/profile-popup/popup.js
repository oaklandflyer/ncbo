'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loadPublicProfile } from './actions';
import { affiliationLabel, badgesFor, clubRoleLabel, phaseLabel } from '@/lib/membership';
import { Badge, VettedSeal, Credentials, Meta, buttonReset, btnGhost, btnSmall, fineprint } from '@/app/ui';
import { initials } from '@/lib/monogram';
import { academicLevelLabel } from '@/lib/academicYear';

/**
 * The profile popup, and the chip that opens it.
 *
 * One component, mounted once by the hub layout, opened from anywhere a person
 * appears: the Network directory, Topics, Q&A, a roster, a leaderboard. Built
 * this way rather than per screen for the reason every duplicated modal
 * eventually proves — five copies drift, and the copy that drifts is the one
 * that starts showing a field it should not.
 *
 * The data is fetched when it opens, not with the page. A directory of two
 * hundred members would otherwise carry two hundred profiles nobody looks at.
 */
const PopupContext = createContext(null);

export function useProfilePopup() {
  const open = useContext(PopupContext);
  /* Rendered outside the provider (a route that has not been wrapped yet):
     the chip stays a plain name rather than throwing. */
  return open || (() => {});
}

export function ProfilePopupProvider({ children }) {
  const [userId, setUserId] = useState(null);
  const [state, setState] = useState({ loading: false });
  const closeRef = useRef(null);
  const openerRef = useRef(null);

  const open = useCallback((id) => {
    openerRef.current = document.activeElement;
    setUserId(id);
  }, []);

  const close = useCallback(() => {
    setUserId(null);
    setState({ loading: false });
    /* Focus goes back where it came from. Without this a keyboard user who
       opened the tenth row lands at the top of the document on close. */
    openerRef.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;
    setState({ loading: true });
    loadPublicProfile(userId).then((result) => {
      if (!cancelled) setState({ loading: false, ...result });
    });

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    /* The page behind a modal must not scroll under it on a phone. */
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [userId, close]);

  useEffect(() => {
    if (userId && !state.loading) closeRef.current?.focus();
  }, [userId, state.loading]);

  return (
    <PopupContext.Provider value={open}>
      {children}
      {userId && (
        <ProfileModal
          state={state}
          onClose={close}
          closeRef={closeRef}
        />
      )}
    </PopupContext.Provider>
  );
}

function Initials({ name }) {
  return (
    <span
      aria-hidden
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-wash font-display text-[1.15rem] font-bold text-brand"
    >
      {initials(name)}
    </span>
  );
}

function ProfileModal({ state, onClose, closeRef }) {
  const p = state.profile;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p ? `${p.display_name}, profile` : 'Profile'}
        className="w-full max-w-[440px] rounded-t-[14px] border border-edge bg-surface p-6 shadow-[0_-8px_40px_rgba(20,24,31,0.18)] sm:rounded-[12px] sm:shadow-[0_18px_60px_rgba(20,24,31,0.22)]"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {state.loading && <p className={fineprint}>Loading…</p>}

        {state.error && (
          <>
            <p role="alert" className="text-[0.95rem] text-body">{state.error}</p>
            <button ref={closeRef} type="button" onClick={onClose} className={`${btnGhost} ${btnSmall} mt-5 w-full`}>
              Close
            </button>
          </>
        )}

        {p && (
          <>
            <div className="flex items-start gap-4">
              <Initials name={p.display_name} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-[1.3rem] font-bold uppercase leading-tight tracking-[0.02em] text-ink">
                  {p.display_name || 'Member'}
                </h2>

                {/* Chapter, or Independent. A real state, not a blank: an
                    advisor and a student at a school with no chapter both
                    belong on the network without belonging to a club. */}
                <Meta className="mt-1">
                  {affiliationLabel({ university_short_name: p.university_short_name })}
                  {p.grad_year ? ` · Class of ${p.grad_year}` : ''}
                </Meta>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {p.is_verified && <Badge tone="active">Verified member</Badge>}
              {badgesFor(p).map((b) => <Badge key={b}>{b}</Badge>)}
              {p.is_alumni && <Badge>Alumni</Badge>}
              {p.vetted_coach && <VettedSeal />}
            </div>

            {p.credentials?.length > 0 && (
              <div className="mt-3"><Credentials items={p.credentials} /></div>
            )}

            <dl className="mt-5 grid gap-x-5 gap-y-3 border-t border-edge pt-5 sm:grid-cols-2">
              <Fact label="Experience" value={phaseLabel(p.experience_phase)} />
              <Fact label="Division" value={p.division} />
              <Fact label="Hometown" value={p.home_region} />
              <Fact label="Level" value={academicLevelLabel(p.academic_level)} />
              <Fact
                label="Role at chapter"
                value={p.club_role ? clubRoleLabel(p.club_role) : null}
              />
            </dl>

            {/* Absent rather than empty when there is nothing to show: a
                "no results" panel implies this person tried and did not
                place, which is a different claim from having not competed. */}
            {state.history?.length > 0 && (
              <div className="mt-5 border-t border-edge pt-5">
                <p className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-meta">
                  Competition history
                </p>
                <ul className="mt-3 grid list-none gap-2">
                  {state.history.slice(0, 5).map((h, i) => (
                    <li key={`${h.competition_name}-${i}`} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[0.95rem] text-ink">
                          {h.competition_name}
                        </span>
                        <span className="block text-[0.82rem] text-meta">
                          {new Date(`${h.starts_on}T12:00:00`).getFullYear()}
                          {h.division ? ` · ${h.division}` : ''}
                          {h.federation ? ` · ${h.federation}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 font-display text-[0.9rem] font-bold text-ink">
                        {h.is_overall ? 'Overall' : h.placement ? `${h.placement}` : 'Competed'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Link
                href={`/hub/network?member=${p.id}`}
                className={`${btnGhost} ${btnSmall} text-center`}
                onClick={onClose}
              >
                View full profile
              </Link>
              {/* Messaging is not built in this pass. The hook is here, and
                  it is disabled rather than hidden so the shape of the card
                  does not change on the day it starts working. */}
              <button
                type="button"
                disabled
                title="Messaging is not switched on yet."
                className={`${btnGhost} ${btnSmall} cursor-not-allowed text-center opacity-45`}
              >
                Message
              </button>
            </div>

            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className={`${buttonReset} mt-4 w-full py-2 text-center font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-meta hover:text-ink`}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-meta">{label}</dt>
      <dd className="mt-1 text-[0.95rem] text-body">{value}</dd>
    </div>
  );
}

/**
 * A person's name, anywhere in the app, as something you can tap.
 *
 * Anonymous authors have no id and must stay a plain span: making "Anonymous"
 * tappable would be a bug that undoes the whole anonymity boundary in one
 * click.
 */
export function UserChip({ userId, name, className = '', children }) {
  const open = useProfilePopup();

  if (!userId) {
    return <span className={className}>{children || name}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => open(userId)}
      className={`${buttonReset} text-left underline-offset-2 hover:underline ${className}`}
    >
      {children || name}
    </button>
  );
}

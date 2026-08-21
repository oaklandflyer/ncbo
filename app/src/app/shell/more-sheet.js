'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Seal } from '@/app/brand/marks';
import { NavIcon } from './icons';
import { NavBadge } from './badge';
import { buttonReset } from '@/app/ui';

/**
 * The mobile drawer.
 *
 * Renders the same `navModel` the sidebar does, so a queue can never exist on
 * one surface and not the other. Three details here are load-bearing on a real
 * phone rather than in a simulator, and each of them is a bug this app would
 * otherwise have:
 *
 *  1. **Portalled to document.body.** The shell has `transform` and
 *     `backdrop-filter` on ancestors, and either one makes a `position: fixed`
 *     child fix to that ancestor instead of the viewport. A drawer that is
 *     supposed to cover the screen ends up covering a card.
 *
 *  2. **Scroll lock via `position: fixed` on body, with the offset kept.**
 *     `overflow: hidden` does not hold in iOS Safari; the page scrolls behind
 *     the drawer anyway. Fixing the body does hold, but it jumps the page to
 *     the top unless the scroll position is stored and restored, which is the
 *     part usually left out.
 *
 *  3. **Closes on `usePathname()` change.** Tapping a link inside a drawer
 *     navigates without unmounting it, so without this the drawer stays open
 *     over the page it just took you to.
 */
export default function MoreSheet({ nav, aggregate = 0, scopeSwitcher = null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef(null);
  const openerRef = useRef(null);
  const panelRef = useRef(null);

  /* Portals need a DOM. Rendering nothing on the server and on the first
     client pass keeps the two in agreement. */
  useEffect(() => setMounted(true), []);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;

    const y = window.scrollY;
    const { body } = document;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.width = '100%';

    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      /* Restore where they were. Without this the page is at the top every
         time the drawer closes, which reads as the app losing their place. */
      window.scrollTo(0, y);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* The sheet used to open part-way down its own list, and the cause was this
     effect rather than a stale scroll position: the panel is conditionally
     rendered, so every open mounts a fresh element at scrollTop 0, and then
     `closeRef.current.focus()` moved focus to the *last* child and the browser
     scrolled it into view. `preventScroll` is the actual fix. The explicit
     `scrollTop = 0` stays as a belt-and-braces guard for browsers that restore
     a remembered offset. */
  useEffect(() => {
    if (open) {
      if (panelRef.current) panelRef.current.scrollTop = 0;
      closeRef.current?.focus({ preventScroll: true });
    } else {
      openerRef.current?.focus?.();
    }
  }, [open]);

  const drawer = open && (
    <div
      className="fixed inset-0 z-[400] flex items-end bg-ink/45 backdrop-blur-[2px] lg:hidden"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="More"
        /* The safe-area inset is a class rather than an inline style, so a
           caller can still override the padding. Tailwind passes the whole
           `max(...)` through untouched. */
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-[16px] border-t border-edge bg-surface px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-edge" aria-hidden />

        {/* The one branded surface on a phone below the header. The seal
            rather than the wordmark: at this size the lockup's two subtitle
            lines are illegible, so the name is set as text beside it. */}
        <div className="mb-4 mt-3 flex items-center gap-2.5 border-b border-edge pb-4">
          <Seal alt="" className="h-8 w-8" />
          <span className="font-display text-[0.95rem] font-extrabold uppercase tracking-[0.16em] text-ink">
            NCBO
          </span>
        </div>

        {/* The scope switcher is the top row, because an admin who opens this
            on a phone is almost always about to act on a specific chapter and
            needs to see which one before anything else. */}
        {scopeSwitcher && <div className="mb-5 border-b border-edge pb-5">{scopeSwitcher}</div>}

        {nav.map((group) => (
          <div key={group.id} className="mb-6 last:mb-2">
            <p className="pb-2 font-display text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-meta">
              {group.label}
            </p>
            <ul className="list-none">
              {group.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex min-h-[48px] items-center gap-3 rounded-[6px] px-2 text-[1rem] text-body hover:bg-band"
                  >
                    <NavIcon name={item.icon} size={20} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <NavBadge count={item.badge} subject={item.label.toLowerCase()} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <button
          ref={closeRef}
          type="button"
          onClick={() => setOpen(false)}
          className={`${buttonReset} min-h-[48px] w-full text-center font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-meta`}
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-[3px] px-1 py-2 text-meta"
      >
        <span className="relative flex h-[26px] w-[34px] items-center justify-center rounded-full">
          <NavIcon name="more" />
          {aggregate > 0 && (
            <span className="pointer-events-none absolute -right-[6px] -top-[6px]">
              <NavBadge count={aggregate} subject="item" className="border border-white" />
            </span>
          )}
        </span>
        <span className="font-display text-[0.66rem] font-semibold uppercase tracking-[0.1em]">More</span>
      </button>

      {mounted && createPortal(drawer, document.body)}
    </>
  );
}

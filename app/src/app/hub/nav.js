'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOut from './sign-out';
import { buttonReset } from '@/app/ui';

/**
 * The hub's top bar, built to match nav.site-nav on thencbo.org: fixed, a
 * translucent white ground with a blur, crest and wordmark on the left, small
 * uppercase links, a steel underline under the current page, and a steel CTA
 * in the last slot.
 *
 * Below the desktop breakpoint it becomes the site's mobile menu — a toggle
 * and a full-screen panel of large display-face links. Four links, a wordmark
 * and a button do not fit across a 390px phone; the public site solved that
 * with a hamburger, so the app does too rather than inventing a third
 * pattern.
 *
 * Client-side only so the current route can be underlined. It reads the
 * pathname and nothing else — the layout has already decided who gets here.
 */
const LINKS = [
  ['/hub', 'Home'],
  ['/hub/topics', 'Topics'],
  ['/hub/qa', 'Q&A'],
];

export default function HubNav({ canReview, manages }) {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);

  const links = canReview ? [...LINKS, ['/hub/admin', manages ? 'Admin' : 'Review']] : LINKS;
  const isCurrent = (href) => (href === '/hub' ? pathname === '/hub' : pathname.startsWith(href));

  // Close on navigation, and don't leave the page scrollable behind the panel.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    /* The panel is a sibling of <nav>, not a child, and that is load-bearing:
       backdrop-filter makes an element the containing block for fixed-position
       descendants, so inside the blurred bar `inset-0` resolves to the 72px
       nav box rather than the viewport — the panel renders as a sliver and the
       page shows through it. */
    <>
    <nav
      aria-label="Member hub"
      className="fixed inset-x-0 top-0 z-[200] border-b border-edge bg-white/90 shadow-brand-sm backdrop-blur-[12px]"
    >
      <div className="mx-auto flex h-nav w-full max-w-[1180px] items-center gap-4 px-5 sm:px-8 lg:px-12">
        <Link href="/hub" className="flex shrink-0 items-center gap-[0.65rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ncbo-crest.webp" alt="" width={40} height={40} className="h-10 w-10" />
          <span className="font-display text-[1.4rem] font-extrabold tracking-[0.16em] text-ink">
            NCBO
          </span>
        </Link>

        {/* ── desktop ─────────────────────────────────────────────────── */}
        <ul className="ml-auto hidden list-none items-center gap-[1.4rem] md:flex">
          {links.map(([href, label]) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isCurrent(href) ? 'page' : undefined}
                className={`relative block py-1 font-display text-[0.88rem] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  isCurrent(href)
                    ? 'text-ink after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[2px] after:bg-brand after:content-[""]'
                    : 'text-meta hover:text-ink'
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-4 hidden md:block">
          <SignOut />
        </div>

        {/* ── mobile toggle ───────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="hub-mobile-menu"
          className={`${buttonReset} relative z-[210] ml-auto h-[42px] w-[42px] md:hidden`}
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <span
            aria-hidden
            className={`absolute left-[9px] right-[9px] h-[2px] bg-ink transition-transform duration-[250ms] ${
              open ? 'top-[20px] rotate-45' : 'top-[14px]'
            }`}
          />
          <span
            aria-hidden
            className={`absolute left-[9px] right-[9px] top-[20px] h-[2px] bg-ink transition-opacity duration-200 ${
              open ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            aria-hidden
            className={`absolute left-[9px] right-[9px] h-[2px] bg-ink transition-transform duration-[250ms] ${
              open ? 'top-[20px] -rotate-45' : 'top-[26px]'
            }`}
          />
        </button>
      </div>

    </nav>

      {/* ── mobile panel ──────────────────────────────────────────────── */}
      {/* z below the bar, like the site's: the toggle stays above the panel
          so the same button closes it. */}
      <div
        id="hub-mobile-menu"
        className={`fixed inset-0 z-[150] flex flex-col justify-center gap-1 bg-page px-5 transition-transform duration-[350ms] md:hidden ${
          open ? 'translate-y-0' : 'invisible -translate-y-full'
        }`}
      >
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={isCurrent(href) ? 'page' : undefined}
            className={`border-b border-edge py-2 font-display text-[2rem] font-bold uppercase tracking-[0.04em] ${
              isCurrent(href) ? 'text-brand' : 'text-ink'
            }`}
          >
            {label}
          </Link>
        ))}
        <div className="mt-4 [&>a]:w-full">
          <SignOut />
        </div>
      </div>
    </>
  );
}

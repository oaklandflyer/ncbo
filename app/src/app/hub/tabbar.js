'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The phone's primary navigation: a sticky bar of destinations along the
 * bottom, below the md breakpoint only. Above it, the top bar's links are the
 * navigation and this is hidden.
 *
 * It replaces the hamburger panel the hub used to carry. A menu that has to
 * be opened before it can be read costs a tap and hides where you are; four
 * or five destinations fit across a 390px screen without one.
 *
 * Two details that are load-bearing on a real phone rather than in a
 * simulator:
 *
 *   · `env(safe-area-inset-bottom)` in the padding, so the row of labels
 *     clears the iOS home indicator instead of sitting under it.
 *   · a 44px minimum on every target — the size a fingertip actually is,
 *     and the floor both platform guidelines set.
 */

/* Line icons at 22px, drawn on the same 24-box so their weights match. The
   nav is the one place in the app with icons; they are stroked in
   currentColor so the active state needs no second copy. */
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  topics: 'M4 5.5h16M4 12h16M4 18.5h10',
  network: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9s1.4-6.6 3.9-9ZM3.4 9.4h17.2M3.4 14.6h17.2',
  qa: 'M12 16.5v-2.2c1.9 0 3.2-1.1 3.2-2.8S13.9 8.7 12 8.7 8.8 9.8 8.8 11.5M12 19.4h.01',
  profile: 'M12 12.4a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4ZM4.8 20.2c.6-3.3 3.6-5.2 7.2-5.2s6.6 1.9 7.2 5.2',
  review: 'm12 3 7.4 2.9v5.3c0 4.2-3 7.5-7.4 9.3-4.4-1.8-7.4-5.1-7.4-9.3V5.9L12 3Z',
  vault: 'M5 5.5h9.5l4.5 4.5v8.5H5v-13Zm0 4.7h14M9.5 5.5v4.7',
};

/* Review is deliberately not a sixth tab: six across a 390px screen leaves
   each one narrower than a fingertip, and moderators reach the queue from the
   button on Home and from the desktop nav. The prop stays in the signature so
   the layout doesn't have to change when that decision does. */
export default function TabBar({ canModerate }) {
  const pathname = usePathname() || '';

  const tabs = [
    ['/hub', 'Home', 'home'],
    ['/hub/network', 'Network', 'network'],
    /* Discussion is deliberately not a tab: it is the other half of the Q&A
       segmented control, and six tabs across a 390px screen leaves each one
       narrower than a fingertip. */
    ['/hub/qa', 'Q&A', 'qa'],
    ['/hub/resources', 'Vault', 'vault'],
    ['/hub/profile', 'Profile', 'profile'],
  ];

  const isCurrent = (href) =>
    (href === '/hub' ? pathname === '/hub' : pathname.startsWith(href));

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-edge bg-white/95 backdrop-blur-[12px] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex list-none items-stretch justify-around">
        {tabs.map(([href, label, icon]) => {
          const current = isCurrent(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-[3px] px-1 py-2 transition-colors ${
                  current ? 'text-brand' : 'text-meta'
                }`}
              >
                {/* The active tab gets a filled wash behind the icon rather
                    than a second icon set: one shape, two states. */}
                <span
                  className={`flex h-[26px] w-[34px] items-center justify-center rounded-full transition-colors ${
                    current ? 'bg-brand-wash' : ''
                  }`}
                >
                  <svg
                    aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={current ? 2.1 : 1.7}
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d={ICONS[icon]} />
                  </svg>
                </span>
                <span className="font-display text-[0.66rem] font-semibold uppercase tracking-[0.1em]">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

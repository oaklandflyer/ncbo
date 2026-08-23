'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon } from './icons';
import { NavBadge } from './badge';
import MoreSheet from './more-sheet';

/**
 * The phone's bar: four destinations, one action, and a drawer.
 *
 * Hub · Calendar · (+) · Network · More. The middle is a raised blue disc
 * rather than a fifth glyph, because it is the only control on the bar that
 * writes anything — a workout for whoever has the tracker, a competition
 * result for everybody else — and it has to be hittable without looking.
 *
 * Hidden at `lg` by CSS, the same way the sidebar is shown by it. Both read the
 * same model, so "what can this person reach" has one answer and two
 * renderings rather than two answers.
 */
export default function TabBar({ tabs, nav, aggregate, scopeSwitcher = null }) {
  const pathname = usePathname() || '';

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-edge bg-surface/95 backdrop-blur-[12px] lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex list-none items-stretch justify-around">
        {tabs.map((tab) => {
          /* The middle seat. A filled disc lifted above the bar rather than a
             fifth grey glyph: it is the only control here that writes
             anything, and on a phone held one-handed it is the one that has to
             be findable without looking. */
          if (tab.center) {
            return (
              <li key={tab.id} className="flex flex-1 justify-center">
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  className="flex min-h-[56px] flex-col items-center justify-center gap-[3px] px-1 py-2 text-brand"
                >
                  <span className="flex h-[38px] w-[38px] -translate-y-[7px] items-center justify-center rounded-full bg-brand text-white shadow-brand transition-colors hover:bg-brand-light">
                    <NavIcon name="plus" active size={22} />
                  </span>
                  <span className="-mt-[7px] font-display text-[0.66rem] font-semibold uppercase tracking-[0.1em]">
                    {/* "Log a result" does not fit a fifth of a phone. The
                        first word does, and the full label is on the link. */}
                    {tab.label.split(' ')[0]}
                  </span>
                </Link>
              </li>
            );
          }

          if (tab.id === 'more') {
            return (
              <li key="more" className="flex flex-1">
                <MoreSheet nav={nav} aggregate={aggregate} scopeSwitcher={scopeSwitcher} />
              </li>
            );
          }

          const active = tab.href === '/hub' ? pathname === '/hub' : pathname.startsWith(tab.href);
          return (
            <li key={tab.id} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-[3px] px-1 py-2 transition-colors ${
                  active ? 'text-brand' : 'text-meta'
                }`}
              >
                <span
                  className={`relative flex h-[26px] w-[34px] items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-brand-wash' : ''
                  }`}
                >
                  <NavIcon name={tab.icon} active={active} />
                  {tab.badge > 0 && (
                    <span className="pointer-events-none absolute -right-[6px] -top-[6px]">
                      <NavBadge count={tab.badge} subject={tab.label.toLowerCase()} className="border border-surface" />
                    </span>
                  )}
                </span>
                <span className="font-display text-[0.66rem] font-semibold uppercase tracking-[0.1em]">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

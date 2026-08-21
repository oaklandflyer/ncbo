'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon } from './icons';
import { NavBadge } from './badge';

/**
 * The desktop sidebar.
 *
 * Hidden below `lg` with CSS and nothing else. It is deliberately NOT gated on
 * a `useMediaQuery` hook: that reads the viewport during effects, so the first
 * client render disagrees with the server's and React throws a hydration
 * mismatch on exactly the component that is on every page. A media query in
 * the stylesheet has no such opinion at render time.
 */
export default function Sidebar({ nav, scopeSwitcher = null }) {
  const pathname = usePathname() || '';

  return (
    <aside className="fixed inset-y-0 left-0 z-[150] hidden w-[248px] flex-col overflow-y-auto border-r border-edge bg-surface pt-[60px] lg:flex">
      {scopeSwitcher && <div className="border-b border-edge px-4 py-3">{scopeSwitcher}</div>}

      <nav aria-label="Sections" className="flex-1 px-3 py-4">
        {nav.map((group) => (
          <div key={group.id} className="mb-6 last:mb-0">
            <p className="px-3 pb-2 font-display text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-meta">
              {group.label}
            </p>
            <ul className="list-none">
              {group.items.map((item) => {
                const active = item.href === '/hub'
                  ? pathname === '/hub'
                  : pathname.startsWith(item.href);
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-[40px] items-center gap-3 rounded-[6px] px-3 py-2 text-[0.95rem] transition-colors ${
                        active ? 'bg-brand-wash font-semibold text-brand' : 'text-body hover:bg-band'
                      }`}
                    >
                      <NavIcon name={item.icon} active={active} size={19} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <NavBadge count={item.badge} subject={item.label.toLowerCase()} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

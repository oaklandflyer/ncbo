'use client';

import { useMemo, useState } from 'react';
import { Badge, Card, Empty, Meta, field } from '@/app/ui';

/**
 * The shelf. Category chips across the top, cards below.
 *
 * Every card is a link off-site, so each one says where it is going and opens
 * in a new tab — a member reading the vault on a phone should not lose the
 * hub to a YouTube tab.
 */
const TYPE_LABEL = {
  youtube: 'Video',
  webinar: 'Webinar',
  pdf: 'PDF',
  spreadsheet: 'Sheet',
  article: 'Guide',
};

/** A small mark per type, so the shelf scans without reading every title. */
const TYPE_ICON = {
  youtube: 'm10 8.8 5.2 3.2-5.2 3.2V8.8ZM3.5 12c0-2.6.3-4 .6-4.6.3-.6.9-1 1.6-1.1C7.4 6.1 9.7 6 12 6s4.6.1 6.3.3c.7.1 1.3.5 1.6 1.1.3.6.6 2 .6 4.6s-.3 4-.6 4.6c-.3.6-.9 1-1.6 1.1-1.7.2-4 .3-6.3.3s-4.6-.1-6.3-.3a2 2 0 0 1-1.6-1.1c-.3-.6-.6-2-.6-4.6Z',
  pdf: 'M7 3.5h7L19 8v12.5H7V3.5ZM14 3.5V8h5',
  spreadsheet: 'M4 5h16v14H4V5Zm0 4.7h16M4 14.3h16M9.5 5v14',
  article: 'M5 4.5h14v15H5v-15Zm3 4h8M8 12h8M8 15.5h5',
  webinar: 'M3.5 5.5h17v10h-17v-10ZM8 20h8M12 15.5V20',
};

export default function Vault({ resources }) {
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');

  const categories = useMemo(
    () => [...new Set(resources.map((r) => r.category).filter(Boolean))].sort(),
    [resources],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      if (category && r.category !== category) return false;
      if (!q) return true;
      return `${r.title} ${r.description || ''} ${r.category || ''}`.toLowerCase().includes(q);
    });
  }, [resources, category, query]);

  return (
    <>
      <div>
        <label className="sr-only" htmlFor="vault-search">Search the vault</label>
        <input
          id="vault-search" type="search" value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search guides and videos"
          className={`${field} min-h-[44px]`}
        />
      </div>

      {categories.length > 0 && (
        <div className="-mx-5 mt-4 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2">
            {[['', 'All'], ...categories.map((c) => [c, c])].map(([value, label]) => {
              const active = category === value;
              return (
                <button
                  key={value || 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(value)}
                  className={`cursor-pointer appearance-none min-h-[44px] whitespace-nowrap rounded-full border px-4 font-display text-[0.76rem] font-bold uppercase tracking-[0.1em] transition ${
                    active
                      ? 'border-brand bg-brand text-white'
                      : 'border-edge bg-surface text-meta hover:border-brand hover:text-brand'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {shown.length ? (
        <ul className="mt-6 grid list-none gap-4 md:grid-cols-2">
          {shown.map((r) => (
            <li key={r.id}>
              {/* An external link, said plainly: new tab, no referrer leakage,
                  and the host in the footer so nobody taps blind. */}
              <a
                href={r.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block h-full rounded-[8px] border border-edge bg-surface p-6 transition duration-200 hover:-translate-y-[3px] hover:border-brand-deep hover:shadow-brand focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand-light"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-display text-[1.15rem] font-bold leading-[1.25] text-ink transition group-hover:text-brand">
                    {r.title}
                  </span>
                  <span
                    aria-hidden
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-edge bg-band text-brand-deep"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d={TYPE_ICON[r.type] || TYPE_ICON.article} />
                    </svg>
                  </span>
                </div>

                {r.description && (
                  <p className="mt-3 text-[0.97rem] leading-relaxed text-body">{r.description}</p>
                )}

                <Meta className="mt-4 border-t border-edge pt-3">
                  <Badge tone="forming">{TYPE_LABEL[r.type] || 'Guide'}</Badge>
                  <span aria-hidden className="text-fine">·</span>
                  <span>{r.category}</span>
                  <span aria-hidden className="text-fine">·</span>
                  <span className="truncate">
                    {(() => { try { return new URL(r.external_url).hostname.replace(/^www\./, ''); }
                              catch { return 'link'; } })()}
                  </span>
                </Meta>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <Empty>
            {resources.length
              ? 'Nothing here matches that yet.'
              : 'The vault is empty. Advisors and the exec team can add the first link.'}
          </Empty>
        </div>
      )}
    </>
  );
}

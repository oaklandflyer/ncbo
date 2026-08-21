import Link from 'next/link';

/**
 * Links, not buttons.
 *
 * A segmented control built from state cannot be linked to, bookmarked, opened
 * in a new tab, or sent to somebody. Two links styled as one control cost
 * nothing and behave like the web.
 */
export function Segmented({ current }) {
  const tabs = [
    ['/rankings/athletes', 'Athletes'],
    ['/rankings/clubs', 'Chapter Cup'],
  ];

  return (
    <div role="tablist" aria-label="Rankings" className="inline-flex rounded-full border border-edge bg-surface p-1">
      {tabs.map(([href, label]) => {
        const active = href === current;
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className={`rounded-full px-5 py-2 font-display text-[0.76rem] font-semibold uppercase tracking-[0.12em] transition-colors ${
              active ? 'bg-brand text-white' : 'text-meta hover:text-ink'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * How the points work, collapsed by default.
 *
 * A leaderboard nobody can do the arithmetic for is one nobody trusts, and one
 * that explains itself in a wall of text above the table is one nobody reads.
 * `<details>` is the native answer and needs no JavaScript.
 */
export function HowPointsWork({ children }) {
  return (
    <details className="rounded-[8px] border border-edge bg-surface px-5 py-4">
      <summary className="cursor-pointer font-display text-[0.86rem] font-bold uppercase tracking-[0.06em] text-ink">
        How points work
      </summary>
      <div className="mt-4 text-[0.96rem] leading-relaxed text-body">{children}</div>
    </details>
  );
}

/** Numerals that line up column-to-column, which is the whole point of a table. */
export const tabularNums = { fontVariantNumeric: 'tabular-nums' };

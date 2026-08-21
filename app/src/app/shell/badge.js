import { badgeLabel, badgeAriaLabel } from '@/lib/nav/navModel';

/**
 * A count on a nav item.
 *
 * Zero renders nothing at all rather than a "0" pip: an empty queue is not a
 * notification, and a badge that is always present stops being read.
 */
export function NavBadge({ count, subject = 'item', className = '' }) {
  const label = badgeLabel(count);
  if (!label) return null;

  return (
    <>
      <span
        aria-hidden
        className={`grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-[5px] font-display text-[0.62rem] font-bold leading-none text-white ${className}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {label}
      </span>
      {/* The numeral is decorative; the count reaches a screen reader in words. */}
      <span className="sr-only">{badgeAriaLabel(count, subject)}</span>
    </>
  );
}

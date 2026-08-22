/**
 * The three glyphs the workout screen needs, drawn inline.
 *
 * Lucide's shapes on Lucide's grid (24×24, 2px round strokes) but not Lucide's
 * package: three icons are not worth a dependency, and an icon library that
 * ships as a client component costs more bundle than the screen it decorates.
 * Anything wanting a fourth icon should reach for the library instead.
 */

function Icon({ size = 16, children, className = '' }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Superset link — two chain halves. A placeholder until supersets exist. */
export function LinkIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  );
}

/** The overflow menu's handle. */
export function MoreIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </Icon>
  );
}

/** The tick. Heavier than the Lucide default: it is read at arm's length. */
export function CheckIcon({ size = 16, className = '' }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

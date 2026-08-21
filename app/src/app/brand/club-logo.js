import { monogram, clubLabel } from '@/lib/monogram';

/**
 * A chapter's mark, or the monogram that stands in for it.
 *
 * Built first and used by every surface, so that no leaderboard, roster or
 * card does its own null check. A club with no logo is not an error state and
 * never will be: most chapters will not have uploaded one, and the ones that
 * never do should still look deliberate.
 *
 * The box is a fixed square either way. Reserving it only when a logo exists
 * is what makes a leaderboard's club names jump left and right down the
 * column, which is worse than an empty square would have been.
 *
 * A plain <img> rather than `next/image`: the source is an arbitrary Supabase
 * storage URL, so the optimiser would need that host in `remotePatterns` and
 * would then proxy and re-encode an image we already normalised to a 512px
 * PNG on the way in. There is nothing left for it to do.
 */

export default function ClubLogo({ club, size = 32, className = '' }) {
  const src = club?.logoUrl || club?.logo_url || club?.club_logo || null;
  const name = clubLabel(club) || 'this chapter';

  /* One box, one set of dimensions, whichever branch renders. Inline styles
     rather than Tailwind classes because the size is a prop: a template
     literal class name is a class Tailwind never sees at build time and so
     never emits. */
  const box = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: Math.max(4, Math.round(size * 0.18)),
  };

  if (src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt=""
        aria-hidden
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{ ...box, objectFit: 'contain' }}
        className={`shrink-0 bg-transparent ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden
      title={name}
      style={{ ...box, fontSize: Math.max(9, Math.round(size * 0.4)) }}
      className={`inline-flex shrink-0 select-none items-center justify-center bg-brand-wash font-display font-bold uppercase leading-none tracking-[0.02em] text-brand ${className}`}
    >
      {monogram(club)}
    </span>
  );
}

/**
 * The same mark at one size on a phone and another from `md` up.
 *
 * Two elements, one hidden at each breakpoint, rather than one element with a
 * responsive class: the size drives an inline width, a border radius and a
 * font size, and Tailwind cannot emit a class for a value that only exists at
 * render time. The browser requests the URL once regardless, so the second
 * copy costs a hidden node and nothing over the network.
 */
export function ClubLogoResponsive({ club, small = 24, large = 32, className = '' }) {
  return (
    <>
      <ClubLogo club={club} size={small} className={`md:hidden ${className}`} />
      <ClubLogo club={club} size={large} className={`hidden md:inline-flex ${className}`} />
    </>
  );
}

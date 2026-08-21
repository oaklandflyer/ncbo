import Image from 'next/image';
import { monogram, clubLabel } from '@/lib/monogram';
import { resolveSize } from './sizes';

/**
 * A chapter's mark, or the monogram that stands in for it.
 *
 * Used by every surface that draws a club, so that no leaderboard, roster or
 * card does its own null check. A club with no logo is not an error state and
 * never will be: most chapters will not have uploaded one, and the ones that
 * never do should still look deliberate.
 *
 * The box is a fixed square either way. Reserving it only when a logo exists
 * is what makes a leaderboard's club names jump left and right down the
 * column, which is worse than an empty square would have been.
 *
 * **Size is a variant, not a number.** `next/image` writes exactly one inline
 * property of its own, `color: transparent`, so the `h-*`/`w-*` classes decide
 * the rendered box and the `width`/`height` props serve only as the intrinsic
 * ratio the optimiser needs. Nothing here can be overridden by a caller's
 * class, because nothing here is inline.
 */
export default function ClubLogo({ club, size = 'sm', className = '' }) {
  const { box, radius, text } = resolveSize(size, 'ClubLogo');
  const src = club?.logoUrl || club?.logo_url || club?.club_logo || null;
  const name = clubLabel(club) || 'this chapter';

  /* A `blob:` or `data:` source is bytes the browser already holds: the upload
     form's own preview of the file somebody just picked. There is nothing for
     the optimiser to fetch, and `next/image` refuses the URL outright, so this
     one case is a plain <img>. Same classes, same box, so the preview and the
     saved mark are the same size on screen. */
  if (src && /^(blob|data):/.test(src)) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt=""
        aria-hidden
        className={`shrink-0 bg-transparent object-contain ${box} ${radius} ${className}`}
      />
    );
  }

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        aria-hidden
        /* The source is a 512px square PNG, normalised on upload. 96 is the
           intrinsic size handed to the optimiser: twice the largest box this
           renders at, so a 2x screen at `md` is still served real pixels and
           nothing downloads a 512px file to draw it at 40. */
        width={96}
        height={96}
        sizes="96px"
        className={`shrink-0 bg-transparent object-contain ${box} ${radius} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden
      title={name}
      className={`inline-flex shrink-0 select-none items-center justify-center bg-brand-wash font-display font-bold uppercase leading-none tracking-[0.02em] text-brand ${box} ${radius} ${text} ${className}`}
    >
      {monogram(club)}
    </span>
  );
}

import Image from 'next/image';

/*
 * The two NCBO marks, as the only place in the app that knows their paths and
 * their aspect ratios.
 *
 * Neither of these is a client component and neither needs to be: a logo has
 * no state and no handlers. Wrapping one in `'use client'` would drag the
 * whole subtree that renders it across the boundary for nothing.
 *
 * Both source SVGs declare `width="100%" height="100%"` and carry no intrinsic
 * size. The `width`/`height` props below are their viewBox extents, which is
 * what gives `next/image` a ratio to reserve; the rendered size is decided by
 * classes so a caller can make it responsive. Both are `unoptimized` because
 * Next's optimiser refuses SVG unless `dangerouslyAllowSVG` is set, and
 * turning that on to save a kilobyte on files we ship ourselves is a bad
 * trade.
 */

export const SEAL_SVG = '/brand/ncbo-seal.svg';
export const SEAL_PNG = '/brand/ncbo-seal.png';
export const WORDMARK_SVG = '/brand/ncbo-wordmark.svg';

/**
 * The lockup: "NCBO" over the two subtitle lines.
 *
 * Height comes from a class, not a prop. `next/image` writes exactly one
 * inline property of its own, `color: transparent`, so `h-*` and `w-auto`
 * decide the rendered box; the `width`/`height` props below are the intrinsic
 * ratio the optimiser needs and nothing more.
 *
 * The default is `h-10 w-auto`, which is 40px tall and 160px wide. Below about
 * 44px of total height the two subtitle lines stop being legible, so anywhere
 * this cannot have that much room should render the seal instead. `h-11` is
 * the ceiling; past it the lockup starts to dominate a 60px bar.
 */
export function Wordmark({ alt = 'NCBO', className = 'h-10 w-auto' }) {
  return (
    <Image
      src={WORDMARK_SVG}
      alt={alt}
      width={600}
      height={150}
      unoptimized
      priority
      aria-hidden={alt === '' ? true : undefined}
      className={className}
    />
  );
}

/**
 * The circular seal.
 *
 * The SVG is what the browser gets. The 512x512 PNG beside it exists for the
 * renderers that cannot read SVG: Satori behind the share card, and the PWA
 * manifest.
 */
export function Seal({ alt = 'NCBO', className = 'h-9 w-9' }) {
  return (
    <Image
      src={SEAL_SVG}
      alt={alt}
      width={300}
      height={300}
      unoptimized
      priority
      aria-hidden={alt === '' ? true : undefined}
      className={className}
    />
  );
}

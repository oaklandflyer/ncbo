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
 * size, so every call site passes explicit dimensions. That is also why the
 * wordmark is `unoptimized`: Next's image optimiser refuses SVG unless
 * `dangerouslyAllowSVG` is set, and turning that on to save a kilobyte on a
 * file we ship ourselves is a bad trade.
 */

export const SEAL_SVG = '/brand/ncbo-seal.svg';
export const SEAL_PNG = '/brand/ncbo-seal.png';
export const WORDMARK_SVG = '/brand/ncbo-wordmark.svg';

/** Native aspect of `ncbo-wordmark.svg` (viewBox 0 0 600 150). */
const WORDMARK_RATIO = 4;

/**
 * The lockup: "NCBO" over the two subtitle lines.
 *
 * `height` drives it, because every place it appears is a horizontal band of a
 * known height. `alt` defaults to the organisation's name and can be emptied
 * by a caller that already renders that name in text beside it, so a screen
 * reader does not hear "NCBO NCBO".
 */
export function Wordmark({ height = 32, alt = 'NCBO', className = '' }) {
  return (
    <Image
      src={WORDMARK_SVG}
      alt={alt}
      width={Math.round(height * WORDMARK_RATIO)}
      height={height}
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
 * renderers that cannot read SVG at all: Satori behind the share card, and the
 * PWA manifest.
 */
export function Seal({ size = 64, alt = 'NCBO', className = '' }) {
  return (
    <Image
      src={SEAL_SVG}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      priority
      aria-hidden={alt === '' ? true : undefined}
      className={className}
    />
  );
}

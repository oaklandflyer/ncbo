/**
 * The one size scale for square marks: club logos, monograms, avatars.
 *
 * Sizes are variants, never numbers. A numeric `size` prop has to become an
 * inline `style`, because Tailwind cannot emit a class for a value that only
 * exists at render time, and an inline style then outranks every class anybody
 * later adds to fix it. That is how a leaderboard mark ended up with
 * `width:24px;height:24px` welded to it and no way to make it responsive.
 *
 * Taken from the audit's §1.6.B map, with one change: the audit folds the
 * corner radius into `box`, which works for a rounded square and breaks for a
 * round avatar, since two competing `rounded-*` classes in one string resolve
 * by stylesheet order rather than by which was written last. Radius is its own
 * field so each caller states the shape it wants.
 *
 * `md` is the only responsive step, and it is the leaderboard's: 40px on a
 * phone, 48px from `md` up, one element either way.
 */
export const SIZES = {
  xs: { box: 'h-8 w-8',                   radius: 'rounded-[6px]',  text: 'text-[11px]' },
  sm: { box: 'h-10 w-10',                 radius: 'rounded-[8px]',  text: 'text-[13px]' },
  md: { box: 'h-10 w-10 md:h-12 md:w-12', radius: 'rounded-[8px]',  text: 'text-[13px] md:text-[15px]' },
  lg: { box: 'h-16 w-16',                 radius: 'rounded-[10px]', text: 'text-[20px]' },
};

export const SIZE_NAMES = Object.keys(SIZES);

/**
 * The variant, or a loud failure.
 *
 * A component that silently falls back to `md` when handed `size={24}` is a
 * component that keeps the old call sites working and hides the bug. Throwing
 * in development surfaces it on the first render; production still draws
 * something rather than blanking the page it is on.
 */
export function resolveSize(size, componentName) {
  const variant = SIZES[size];
  if (variant) return variant;
  const message =
    `${componentName}: size must be one of ${SIZE_NAMES.join(', ')}, got ${JSON.stringify(size)}. `
    + 'Numeric sizes are gone: they can only be applied as an inline style, which outranks '
    + 'every class that later tries to correct it.';
  if (process.env.NODE_ENV !== 'production') throw new Error(message);
  console.error(`[ncbo] ${message}`);
  return SIZES.md;
}

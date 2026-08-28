/**
 * What Home draws while its data is in flight.
 *
 * The point of a skeleton is not decoration, it is height. Each of these
 * reserves the space the real thing will occupy, so when the stream arrives
 * the page fills in rather than jumping — the layout shift is what makes a
 * streaming page feel worse than a blocking one, and it is entirely avoidable
 * when you know how tall the answer is.
 *
 * Deliberately literal Tailwind colours rather than the theme tokens the rest
 * of the app uses. `bg-zinc-800` is a shade between the dark theme's surface
 * and its borders that has no token, and a placeholder is the one thing that
 * should not read as a real surface. In the light theme it is still a grey
 * block, which is what a loading placeholder is.
 */

const BLOCK = 'animate-pulse rounded-lg bg-zinc-800/60 dark:bg-zinc-800';

/** One widget's worth of space. */
export function WidgetSkeleton() {
  return <div className={`${BLOCK} h-32`} aria-hidden="true" />;
}

/** The widget row: three across on a wide screen, one on a phone. */
export function WidgetRowSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading your chapter’s standing">
      <WidgetSkeleton />
      <WidgetSkeleton />
      <WidgetSkeleton />
    </div>
  );
}

/** The stat strip under the hero. Shorter, because stats are one line. */
export function StatsSkeleton() {
  return (
    <div className="mt-9 flex max-w-2xl gap-6" role="status" aria-label="Loading">
      <div className={`${BLOCK} h-14 w-24`} />
      <div className={`${BLOCK} h-14 w-24`} />
    </div>
  );
}

/**
 * A section of the page below the fold: heading plus a list.
 *
 * `rows` is how many list items to reserve. Three is the usual answer and
 * matches the shortest real panel, so an arriving section more often grows
 * than shrinks — and growth below the fold moves nothing anybody is reading.
 */
export function SectionSkeleton({ rows = 3 }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8" role="status" aria-label="Loading">
      <div className={`${BLOCK} mb-5 h-6 w-48`} />
      <div className="grid gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`${BLOCK} h-32`} />
        ))}
      </div>
    </section>
  );
}

import Link from 'next/link';
import { formatMinutes, formatVolume, daysOutLabel } from '@/lib/workoutSummary';

/**
 * The three widgets the home screen opens with.
 *
 * A widget answers one question in one glance, on a phone, without scrolling:
 * where is my chapter, what is next, and what did I last do. Everything below
 * them is still the reading material it always was — this is the part somebody
 * checks while walking between classes.
 *
 * They are deliberately dumb. Each takes plain values and renders them, which
 * is what let them be laid out against real numbers (a 1,450 point leader, a
 * 9,425 lb session) before any of the queries behind them existed, and what
 * keeps the page the only file that knows how to fetch anything.
 *
 * Colour comes from the app's tokens rather than literal Tailwind palettes:
 * `bg-surface` is white in light and zinc-900 in dark, `text-meta` is slate
 * grey and then zinc-400, `text-brand` is the steel blue and then blue-500.
 * One set of class names, two themes, no `dark:` variant per element.
 */

export function Widget({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-[10px] border border-edge bg-surface p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-[0.7rem] font-bold uppercase tracking-[0.16em] text-meta">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The widget row itself: one column on a phone, three across from `sm`. */
export function WidgetGrid({ children }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** 1st, 2nd, 3rd, 11th. */
export function ordinal(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  const tens = num % 100;
  if (tens >= 11 && tens <= 13) return `${num}th`;
  return `${num}${{ 1: 'st', 2: 'nd', 3: 'rd' }[num % 10] || 'th'}`;
}

const points = (value) => Math.round(Number(value) || 0).toLocaleString('en-US');

/**
 * The Chapter Cup.
 *
 * Rank first and at size, because it is the only number here anybody repeats
 * out loud. The gap to the leader is the second line rather than a footnote:
 * "2nd" on its own is a standing, and "165 behind" is a reason to enter a
 * show. A chapter in the lead gets its margin instead, which is the same
 * sentence pointed the other way.
 */
export function ChapterCupWidget({ season, rank, chapter, points: total, leader, contributed }) {
  const behind = leader && rank > 1 ? Math.round(leader.points - total) : null;
  const ahead = rank === 1 && leader?.runnerUpPoints != null
    ? Math.round(total - leader.runnerUpPoints)
    : null;

  return (
    <Widget
      title={`Chapter Cup · ${season}`}
      action={
        <Link href="/rankings/clubs" className="font-display text-[0.7rem] font-bold uppercase tracking-[0.12em] text-brand">
          Table
        </Link>
      }
    >
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[2.6rem] font-extrabold leading-none text-ink">
          {ordinal(rank)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[1.05rem] font-bold uppercase leading-tight tracking-[0.02em] text-ink">
            {chapter}
          </span>
          <span className="block text-[0.85rem] tabular-nums text-meta">{points(total)} pts</span>
        </span>
      </div>

      <p className="mt-3 border-t border-edge pt-3 text-[0.88rem] text-body">
        {behind != null && (
          <>
            <span className="font-semibold tabular-nums text-ink">{points(behind)} pts</span>
            {' '}behind {leader.chapter}
          </>
        )}
        {ahead != null && (
          <>
            <span className="font-semibold tabular-nums text-ink">{points(ahead)} pts</span>
            {' '}clear of second
          </>
        )}
        {behind == null && ahead == null && 'Standings update as results are verified.'}
      </p>

      {contributed > 0 && (
        <p className="mt-2 text-[0.85rem] text-meta">
          You contributed <span className="font-semibold tabular-nums text-brand">{points(contributed)} pts</span>
        </p>
      )}
    </Widget>
  );
}

/**
 * Next up.
 *
 * The countdown is the widget. A date tells somebody when a thing is; "In 24
 * days" tells them whether to do something about it today, and registration
 * deadlines are missed by people who read the date and did the subtraction
 * wrong.
 */
export function NextUpWidget({ title, when, days, where, href, kind = 'Next up' }) {
  if (!title) {
    return (
      <Widget title={kind}>
        <p className="text-[0.9rem] text-meta">
          Nothing on the calendar yet. Your chapter&rsquo;s events appear here once your lead
          publishes them.
        </p>
      </Widget>
    );
  }

  const body = (
    <>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[2.6rem] font-extrabold leading-none text-ink tabular-nums">
          {days != null && days >= 0 ? days : '—'}
        </span>
        <span className="font-display text-[0.7rem] font-bold uppercase leading-tight tracking-[0.14em] text-meta">
          {days === 0 ? 'Today' : days === 1 ? 'Day out' : 'Days out'}
        </span>
      </div>

      <p className="mt-3 border-t border-edge pt-3 font-display text-[1.05rem] font-bold uppercase leading-tight tracking-[0.02em] text-ink">
        {title}
      </p>
      <p className="mt-1 text-[0.85rem] text-meta">
        {when}
        {where && <> · {where}</>}
      </p>
    </>
  );

  return (
    <Widget
      title={kind}
      action={
        <span className="font-display text-[0.7rem] font-bold uppercase tracking-[0.12em] text-brand">
          {daysOutLabel(days)}
        </span>
      }
    >
      {href ? <Link href={href} className="block">{body}</Link> : body}
    </Widget>
  );
}

/**
 * Training.
 *
 * The button is the point of the widget and it is full width, because starting
 * a workout is a thing done standing up with one hand. The summary above it is
 * there to answer "what did I do last time", which is the question that
 * decides what goes on the bar today.
 */
export function TrainingWidget({ last, lifetime, href = '/hub/workout' }) {
  return (
    <Widget
      title="Training"
      action={
        lifetime > 0 ? (
          <span className="font-display text-[0.7rem] font-bold uppercase tracking-[0.12em] text-meta tabular-nums">
            {formatVolume(lifetime)} lb lifetime
          </span>
        ) : null
      }
    >
      {last ? (
        <>
          <p className="font-display text-[1.05rem] font-bold uppercase leading-tight tracking-[0.02em] text-ink">
            {sessionDate(last.startTime)}
          </p>
          <p className="mt-1 text-[0.85rem] tabular-nums text-meta">
            {[formatMinutes(last.minutes), `${formatVolume(last.volume)} lb`, `${last.sets} sets`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {last.top && (
            <p className="mt-2 truncate text-[0.85rem] text-body">
              Top set{' '}
              <span className="font-semibold tabular-nums text-ink">
                {last.top.name} {last.top.weight} × {last.top.reps}
              </span>
            </p>
          )}
        </>
      ) : (
        <p className="text-[0.9rem] text-meta">
          No workouts logged yet. The first one takes about ten seconds to start.
        </p>
      )}

      <Link
        href={href}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-[8px] bg-brand px-4 font-display text-[0.82rem] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-brand-light"
      >
        Start empty workout
      </Link>
    </Widget>
  );
}

/** "Tue, Aug 18" — the same shape the rest of the app uses for dates. */
function sessionDate(value) {
  if (!value) return 'Last workout';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return 'Last workout';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

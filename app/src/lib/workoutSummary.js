import { completedOnly, workoutTotals } from './workout.js';

/**
 * Reading a finished workout back, for the screens that summarise one.
 *
 * `@/lib/workout` is about editing a live workout; this is about describing a
 * dead one. Both are pure and neither imports the other's concerns, which is
 * what lets the Hub's Training widget and the tracker share the definition of
 * "volume" instead of each computing it slightly differently.
 *
 * Everything here tolerates a malformed row. `workout_data` is a JSONB
 * document written by a client, and while the server sanitises what it stores,
 * a widget on the home screen is the wrong place to discover a row that
 * predates that.
 */

/** Minutes between start and end, or null for a session that never finished. */
export function sessionMinutes(session) {
  const start = new Date(session?.start_time || '').getTime();
  const end = new Date(session?.end_time || '').getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

/** "53m", "1h 12m". Long enough to be exact, short enough for a stat tile. */
export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * The heaviest single set of a session, as the thing worth naming.
 *
 * Heaviest weight wins, and reps break the tie. Not estimated one-rep max:
 * that is a formula with an opinion in it, and a widget that says "Bench 255
 * × 1" is reporting what happened while one that says "1RM 262" is arguing.
 */
export function topSet(workoutData) {
  let best = null;
  for (const exercise of completedOnly(workoutData)) {
    for (const set of exercise.sets) {
      const weight = Number(set.weight) || 0;
      const reps = Number(set.reps) || 0;
      if (weight <= 0) continue;
      if (!best || weight > best.weight || (weight === best.weight && reps > best.reps)) {
        best = { name: exercise.exercise_name || 'Exercise', weight, reps };
      }
    }
  }
  return best;
}

/** "Bench Press 255 × 1", or null when nothing was loaded. */
export function topSetLabel(workoutData) {
  const best = topSet(workoutData);
  if (!best) return null;
  return `${best.name} ${best.weight} × ${best.reps}`;
}

/** Everything the Training widget needs from one row, in one pass. */
export function sessionSummary(session) {
  if (!session) return null;
  const data = Array.isArray(session.workout_data) ? session.workout_data : [];
  const totals = workoutTotals(data);
  return {
    id: session.id || null,
    startTime: session.start_time || null,
    minutes: sessionMinutes(session),
    volume: totals.volume,
    sets: totals.sets,
    exercises: totals.exercises,
    top: topSet(data),
  };
}

/** Every pound ever moved, across whatever sessions were handed over. */
export function lifetimeVolume(sessions) {
  return (sessions || []).reduce(
    (total, s) => total + workoutTotals(Array.isArray(s?.workout_data) ? s.workout_data : []).volume,
    0,
  );
}

/**
 * Whole days from today to a date, in the viewer's own timezone.
 *
 * Midday rather than midnight for a date-only value, which is the same trick
 * the rest of the app uses: `new Date('2026-09-15')` is UTC midnight, and
 * anywhere west of Greenwich that is the 14th.
 */
export function daysOut(value, now = new Date()) {
  if (!value) return null;
  const iso = String(value);
  const target = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (!Number.isFinite(target.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((startOfTarget - startOfToday) / 86400000);
}

/** "Today", "Tomorrow", "In 24 days", "3 days ago". */
export function daysOutLabel(days) {
  if (days === null || days === undefined) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} ago`;
  return `In ${days} days`;
}

/** Pounds, grouped, with no decimals. 9425 reads as 9,425. */
export function formatVolume(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

/**
 * The workout document, and the pure functions that change it.
 *
 * Separate from the store on purpose. The store is the React binding and the
 * localStorage persistence; this is the shape of a workout and the rules for
 * editing one, which is the part worth testing without a renderer or a
 * browser. `test/workout.test.js` exercises every function here.
 *
 * The shape mirrors `workout_sessions.workout_data` exactly, so what the store
 * holds is what the database stores, with no mapping layer to disagree about:
 *
 *   [{ exercise_id, exercise_name, sets: [{ weight, reps, completed }] }]
 *
 * `exercise_name` is carried alongside the id deliberately. An exercise
 * renamed in the catalogue must not rewrite what somebody did last March.
 */

/** A blank set. Weight and reps are null, not 0: nobody lifted zero. */
export function emptySet() {
  return { weight: null, reps: null, completed: false };
}

/**
 * An exercise added to a workout, with one set ready to fill in.
 *
 * Starting with a set rather than none is the difference between tapping an
 * exercise and being able to type, versus tapping an exercise and then having
 * to find "add set" before anything happens.
 */
export function newExercise(exercise) {
  return {
    exercise_id: exercise?.id ?? null,
    exercise_name: exercise?.name ?? 'Exercise',
    sets: [emptySet()],
  };
}

/** Immutably replace one set's fields. Out-of-range indexes are a no-op. */
export function applySetUpdate(exercises, exerciseIndex, setIndex, patch) {
  const list = Array.isArray(exercises) ? exercises : [];
  const target = list[exerciseIndex];
  if (!target) return list;
  if (!target.sets?.[setIndex]) return list;

  const sets = target.sets.map((set, i) => (
    i === setIndex ? { ...set, ...normaliseSet(patch) } : set
  ));
  return list.map((ex, i) => (i === exerciseIndex ? { ...ex, sets } : ex));
}

/**
 * Numbers arrive from `<input>` as strings, and an empty input is "".
 *
 * `Number('')` is 0, so a naive cast turns a cleared field into a set of zero
 * reps at zero weight, which then counts as a real set on every screen that
 * reads it. Empty means null, and null means unanswered.
 */
function normaliseSet(patch = {}) {
  const out = { ...patch };
  for (const key of ['weight', 'reps']) {
    if (!(key in out)) continue;
    const raw = out[key];
    if (raw === '' || raw === null || raw === undefined) { out[key] = null; continue; }
    const n = Number(raw);
    out[key] = Number.isFinite(n) ? n : null;
  }
  if ('completed' in out) out.completed = Boolean(out.completed);
  return out;
}

/** Append a blank set to one exercise. */
export function appendSet(exercises, exerciseIndex) {
  const list = Array.isArray(exercises) ? exercises : [];
  if (!list[exerciseIndex]) return list;
  return list.map((ex, i) => (
    i === exerciseIndex ? { ...ex, sets: [...(ex.sets || []), emptySet()] } : ex
  ));
}

/** Drop one set. The last set of an exercise is kept: an exercise with no
    sets is a row that does nothing and cannot be typed into. */
export function removeSet(exercises, exerciseIndex, setIndex) {
  const list = Array.isArray(exercises) ? exercises : [];
  const target = list[exerciseIndex];
  if (!target || (target.sets || []).length <= 1) return list;
  return list.map((ex, i) => (
    i === exerciseIndex ? { ...ex, sets: ex.sets.filter((_, s) => s !== setIndex) } : ex
  ));
}

/**
 * What is worth saving.
 *
 * A finished workout keeps only the sets somebody actually ticked. The blank
 * trailing set that every exercise carries for typing into is scaffolding, not
 * a record, and an exercise left with nothing ticked was opened and abandoned.
 */
export function completedOnly(exercises) {
  return (Array.isArray(exercises) ? exercises : [])
    .map((ex) => ({ ...ex, sets: (ex.sets || []).filter((s) => s.completed) }))
    .filter((ex) => ex.sets.length > 0);
}

/** Totals for the header. Volume is the number a lifter actually looks at. */
export function workoutTotals(exercises) {
  const done = completedOnly(exercises);
  let sets = 0;
  let volume = 0;
  for (const ex of done) {
    for (const set of ex.sets) {
      sets += 1;
      volume += (Number(set.weight) || 0) * (Number(set.reps) || 0);
    }
  }
  return { exercises: done.length, sets, volume };
}

/** "1:04:12", from two ISO strings. Null start means no elapsed time. */
export function elapsed(startTime, now = Date.now()) {
  if (!startTime) return null;
  const started = new Date(startTime).getTime();
  if (!Number.isFinite(started)) return null;
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * The workout document, made safe to store.
 *
 * The client sends this. Everything in it is therefore a claim, and the
 * database's only structural check is `jsonb_typeof(workout_data) = 'array'`,
 * which a hostile or simply broken client passes trivially with
 * `[{"anything": "at all"}]`.
 *
 * So the server rebuilds the document from scratch rather than validating in
 * place: only the six fields that belong in it survive, each coerced to the
 * type it is supposed to be. A field nobody expected cannot ride along into
 * storage and surface later in whatever screen renders it.
 *
 * Bounded on purpose. A workout is not a place to store a megabyte, and
 * `workout_data` has no size limit of its own.
 */
const MAX_EXERCISES = 60;
const MAX_SETS = 60;
const MAX_NAME = 120;

export function sanitiseWorkoutData(input) {
  if (!Array.isArray(input)) return [];

  return input.slice(0, MAX_EXERCISES).map((ex) => ({
    exercise_id: isUuid(ex?.exercise_id) ? ex.exercise_id : null,
    exercise_name: String(ex?.exercise_name ?? 'Exercise').slice(0, MAX_NAME),
    sets: (Array.isArray(ex?.sets) ? ex.sets : []).slice(0, MAX_SETS).map((set) => ({
      /* The same rule as the client, applied again here: an empty input is
         null, not zero. `Number('')` is 0, so a cleared field would otherwise
         be stored as a real set of zero reps at zero weight. */
      weight: finiteOrNull(set?.weight),
      reps: finiteOrNull(set?.reps),
      completed: set?.completed === true,
    })),
  })).filter((ex) => ex.sets.length > 0);
}

function finiteOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  /* Rejects NaN and Infinity, and anything a lifter could not have done. */
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null;
  return n;
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** An ISO timestamp, or null. Used to refuse a start time from the future. */
export function isoOrNull(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

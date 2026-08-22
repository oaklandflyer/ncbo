import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptySet, newExercise, applySetUpdate, appendSet, removeSet,
  completedOnly, workoutTotals, elapsed, sanitiseWorkoutData, isoOrNull,
} from '../src/lib/workout.js';

/*
 * The document these produce is written straight into
 * `workout_sessions.workout_data`, so its shape is a schema contract and not
 * an implementation detail. That is what most of this checks.
 */

const bench = { id: 'e1', name: 'Barbell Bench Press' };
const squat = { id: 'e2', name: 'Barbell Back Squat' };

test('a new exercise matches the JSONB shape exactly', () => {
  const ex = newExercise(bench);
  assert.deepEqual(Object.keys(ex).sort(), ['exercise_id', 'exercise_name', 'sets']);
  assert.equal(ex.exercise_id, 'e1');
  assert.equal(ex.exercise_name, 'Barbell Bench Press');
  assert.deepEqual(Object.keys(ex.sets[0]).sort(), ['completed', 'reps', 'weight']);
});

test('it starts with one set, so an exercise can be typed into immediately', () => {
  assert.equal(newExercise(bench).sets.length, 1);
});

test('a blank set is null weight and null reps, never zero', () => {
  /* Zero is a real number somebody could have lifted. Null means unanswered,
     and every screen that counts sets depends on the difference. */
  assert.deepEqual(emptySet(), { weight: null, reps: null, completed: false });
});

test('the name is carried alongside the id', () => {
  /* So renaming a catalogue entry does not rewrite what somebody did. */
  assert.equal(newExercise(bench).exercise_name, 'Barbell Bench Press');
  assert.equal(newExercise(null).exercise_name, 'Exercise');
  assert.equal(newExercise(null).exercise_id, null);
});

test('updating a set does not mutate the input', () => {
  const before = [newExercise(bench)];
  const after = applySetUpdate(before, 0, 0, { weight: 100, reps: 5 });
  assert.equal(before[0].sets[0].weight, null, 'input was mutated');
  assert.equal(after[0].sets[0].weight, 100);
});

test('an empty input clears to null rather than becoming zero', () => {
  /* Number('') is 0. A naive cast turns a cleared field into a set of zero
     reps at zero weight, which then counts as a real set everywhere. */
  const list = applySetUpdate([newExercise(bench)], 0, 0, { weight: 100, reps: 5 });
  const cleared = applySetUpdate(list, 0, 0, { weight: '' });
  assert.equal(cleared[0].sets[0].weight, null);
  assert.equal(cleared[0].sets[0].reps, 5, 'an unrelated field was touched');
});

test('numeric strings from an input are stored as numbers', () => {
  const list = applySetUpdate([newExercise(bench)], 0, 0, { weight: '102.5', reps: '8' });
  assert.strictEqual(list[0].sets[0].weight, 102.5);
  assert.strictEqual(list[0].sets[0].reps, 8);
});

test('junk becomes null rather than NaN', () => {
  /* NaN survives JSON.stringify as null anyway; making it explicit means the
     value in the store matches the value in the database. */
  const list = applySetUpdate([newExercise(bench)], 0, 0, { weight: 'heavy' });
  assert.strictEqual(list[0].sets[0].weight, null);
});

test('a patch can tick completed without restating weight and reps', () => {
  let list = applySetUpdate([newExercise(bench)], 0, 0, { weight: 100, reps: 5 });
  list = applySetUpdate(list, 0, 0, { completed: true });
  assert.deepEqual(list[0].sets[0], { weight: 100, reps: 5, completed: true });
});

test('an out-of-range index is a no-op, not a crash', () => {
  const list = [newExercise(bench)];
  assert.equal(applySetUpdate(list, 9, 0, { reps: 5 }), list);
  assert.equal(applySetUpdate(list, 0, 9, { reps: 5 }), list);
  assert.doesNotThrow(() => applySetUpdate(null, 0, 0, { reps: 5 }));
});

test('adding a set appends a blank one to the right exercise', () => {
  const list = appendSet([newExercise(bench), newExercise(squat)], 1);
  assert.equal(list[0].sets.length, 1);
  assert.equal(list[1].sets.length, 2);
  assert.deepEqual(list[1].sets[1], emptySet());
});

test('the last set of an exercise cannot be removed', () => {
  /* An exercise with no sets is a row that does nothing and cannot be typed
     into. Removing the exercise is a different action. */
  const list = [newExercise(bench)];
  assert.equal(removeSet(list, 0, 0), list);
  const two = appendSet(list, 0);
  assert.equal(removeSet(two, 0, 0)[0].sets.length, 1);
});

test('finishing keeps only ticked sets, and drops abandoned exercises', () => {
  let list = [newExercise(bench), newExercise(squat)];
  list = applySetUpdate(list, 0, 0, { weight: 100, reps: 5, completed: true });
  list = appendSet(list, 0);
  list = applySetUpdate(list, 0, 1, { weight: 100, reps: 5 }); // typed, not ticked

  const saved = completedOnly(list);
  assert.equal(saved.length, 1, 'the untouched exercise should be dropped');
  assert.equal(saved[0].exercise_name, 'Barbell Bench Press');
  assert.equal(saved[0].sets.length, 1, 'the un-ticked set should be dropped');
});

test('totals count only ticked sets, and volume is weight times reps', () => {
  let list = [newExercise(bench)];
  list = applySetUpdate(list, 0, 0, { weight: 100, reps: 5, completed: true });
  list = appendSet(list, 0);
  list = applySetUpdate(list, 0, 1, { weight: 100, reps: 5 });
  assert.deepEqual(workoutTotals(list), { exercises: 1, sets: 1, volume: 500 });
});

test('totals survive a set with nulls in it', () => {
  let list = [newExercise(bench)];
  list = applySetUpdate(list, 0, 0, { completed: true });
  assert.deepEqual(workoutTotals(list), { exercises: 1, sets: 1, volume: 0 });
});

test('elapsed formats under and over an hour', () => {
  const start = '2026-08-22T10:00:00.000Z';
  const at = (mins, secs = 0) => new Date(start).getTime() + (mins * 60 + secs) * 1000;
  assert.equal(elapsed(start, at(0, 42)), '0:42');
  assert.equal(elapsed(start, at(12, 5)), '12:05');
  assert.equal(elapsed(start, at(64, 12)), '1:04:12');
});

test('elapsed never goes negative on a clock that disagrees', () => {
  const start = '2026-08-22T10:00:00.000Z';
  assert.equal(elapsed(start, new Date(start).getTime() - 60000), '0:00');
});

test('elapsed handles a missing or unparseable start', () => {
  assert.equal(elapsed(null), null);
  assert.equal(elapsed('not a date'), null);
});

/*
 * The server-side sanitiser.
 *
 * Everything it receives came from a browser, and the database's only
 * structural check is `jsonb_typeof(workout_data) = 'array'` — which
 * `[{"anything": "at all"}]` satisfies. So this rebuilds the document rather
 * than validating it in place, and these tests are about what it refuses to
 * carry through.
 */

test('it rebuilds the document, dropping fields nobody asked for', () => {
  const dirty = [{
    exercise_id: null,
    exercise_name: 'Bench',
    sets: [{ weight: 100, reps: 5, completed: true, secret: 'do not store me' }],
    injected: { anything: 'at all' },
  }];
  const clean = sanitiseWorkoutData(dirty);
  assert.deepEqual(Object.keys(clean[0]).sort(), ['exercise_id', 'exercise_name', 'sets']);
  assert.deepEqual(Object.keys(clean[0].sets[0]).sort(), ['completed', 'reps', 'weight']);
});

test('an empty string is null, not zero, on the server too', () => {
  /* The same Number('') === 0 trap as the client. Checked in both places
     because the client is not the only thing that can call the action. */
  const clean = sanitiseWorkoutData([
    { exercise_name: 'Bench', sets: [{ weight: '', reps: '', completed: true }] },
  ]);
  assert.strictEqual(clean[0].sets[0].weight, null);
  assert.strictEqual(clean[0].sets[0].reps, null);
});

test('NaN, Infinity and negatives become null', () => {
  const clean = sanitiseWorkoutData([{
    exercise_name: 'Bench',
    sets: [
      { weight: 'heavy', reps: 5 },
      { weight: Infinity, reps: 5 },
      { weight: -50, reps: 5 },
      { weight: 1e9, reps: 5 },
    ],
  }]);
  for (const set of clean[0].sets) assert.strictEqual(set.weight, null);
});

test('completed is only ever a real boolean', () => {
  /* "false", 0 and 1 are all things a hand-built request could send. Anything
     that is not exactly true is not a completed set. */
  const clean = sanitiseWorkoutData([{
    exercise_name: 'Bench',
    sets: [{ completed: 'true' }, { completed: 1 }, { completed: true }, { completed: 'false' }],
  }]);
  assert.deepEqual(clean[0].sets.map((s) => s.completed), [false, false, true, false]);
});

test('a forged exercise_id that is not a uuid becomes null', () => {
  const clean = sanitiseWorkoutData([
    { exercise_id: "'; drop table exercises; --", exercise_name: 'Bench', sets: [{ reps: 5 }] },
  ]);
  assert.strictEqual(clean[0].exercise_id, null);
});

test('a real uuid survives', () => {
  const id = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
  const clean = sanitiseWorkoutData([{ exercise_id: id, exercise_name: 'Bench', sets: [{ reps: 5 }] }]);
  assert.strictEqual(clean[0].exercise_id, id);
});

test('names are bounded, and so are the arrays', () => {
  /* workout_data has no size limit of its own, and a JSONB column will
     happily store a megabyte of somebody else's idea of a workout. */
  const clean = sanitiseWorkoutData([{
    exercise_name: 'x'.repeat(5000),
    sets: Array.from({ length: 500 }, () => ({ reps: 1 })),
  }]);
  assert.equal(clean[0].exercise_name.length, 120);
  assert.equal(clean[0].sets.length, 60);

  const many = sanitiseWorkoutData(
    Array.from({ length: 500 }, () => ({ exercise_name: 'Bench', sets: [{ reps: 1 }] })),
  );
  assert.equal(many.length, 60);
});

test('an exercise with no sets is dropped rather than stored empty', () => {
  const clean = sanitiseWorkoutData([
    { exercise_name: 'Bench', sets: [] },
    { exercise_name: 'Squat', sets: [{ reps: 5 }] },
    { exercise_name: 'Rows' },
  ]);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].exercise_name, 'Squat');
});

test('junk in, empty array out, never a throw', () => {
  /* The action inserts whatever comes back, so a throw here would be a 500
     on the one screen somebody is mid-workout on. */
  for (const input of [null, undefined, 'a string', 42, {}, [null], [undefined], [[]]]) {
    assert.doesNotThrow(() => sanitiseWorkoutData(input), `threw on ${JSON.stringify(input)}`);
    assert.ok(Array.isArray(sanitiseWorkoutData(input)));
  }
});

test('isoOrNull parses what it can and refuses what it cannot', () => {
  assert.equal(isoOrNull('2026-08-22T10:00:00.000Z'), '2026-08-22T10:00:00.000Z');
  assert.equal(isoOrNull('not a date'), null);
  assert.equal(isoOrNull(null), null);
  assert.equal(isoOrNull(''), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptySet, newExercise, applySetUpdate, appendSet, removeSet,
  completedOnly, workoutTotals, elapsed,
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

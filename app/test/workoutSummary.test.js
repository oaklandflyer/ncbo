import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sessionMinutes, formatMinutes, topSet, topSetLabel, sessionSummary,
  lifetimeVolume, daysOut, daysOutLabel, formatVolume,
} from '../src/lib/workoutSummary.js';
import { THEME_KEY, normaliseTheme, resolveTheme, applyTheme } from '../src/lib/theme.js';

/* The session the Hub's Training widget was designed against: "Push", Aug 18,
   53 minutes, 9,425 lb, topping out at a single at 255. */
const push = {
  id: 'a1',
  start_time: '2026-08-18T17:02:00.000Z',
  end_time: '2026-08-18T17:55:00.000Z',
  status: 'completed',
  workout_data: [
    {
      exercise_id: null,
      exercise_name: 'Bench Press (Barbell)',
      sets: [
        { weight: 185, reps: 10, completed: true },
        { weight: 225, reps: 5, completed: true },
        { weight: 255, reps: 1, completed: true },
        { weight: 275, reps: 1, completed: false },
      ],
    },
    {
      exercise_id: null,
      exercise_name: 'Incline Bench Press (Dumbbell)',
      sets: [
        { weight: 80, reps: 10, completed: true },
        { weight: 80, reps: 10, completed: true },
        { weight: 80, reps: 10, completed: true },
      ],
    },
    {
      exercise_id: null,
      exercise_name: 'Overhead Press (Dumbbell)',
      sets: [
        { weight: 70, reps: 12, completed: true },
        { weight: 70, reps: 11, completed: true },
        { weight: 70, reps: 10, completed: true },
      ],
    },
    {
      exercise_id: null,
      exercise_name: 'Cable Fly',
      sets: [
        { weight: 45, reps: 11, completed: true },
        { weight: 45, reps: 11, completed: true },
        { weight: 45, reps: 11, completed: true },
      ],
    },
  ],
};

test('a finished session summarises to what the widget shows', () => {
  const s = sessionSummary(push);
  assert.equal(s.minutes, 53);
  assert.equal(formatMinutes(s.minutes), '53m');
  assert.equal(s.sets, 12);
  assert.equal(s.exercises, 4);
  /* 3230 bench + 2400 incline + 2310 press + 1485 fly */
  assert.equal(s.volume, 9425);
  assert.equal(formatVolume(s.volume), '9,425');
});

test('the top set is the heaviest one actually completed', () => {
  /* The 275 was loaded and not finished, so it is not what happened. */
  assert.deepEqual(topSet(push.workout_data), {
    name: 'Bench Press (Barbell)', weight: 255, reps: 1,
  });
  assert.equal(topSetLabel(push.workout_data), 'Bench Press (Barbell) 255 × 1');
});

test('reps break a tie between equal weights', () => {
  const data = [{
    exercise_name: 'Squat (Barbell)',
    sets: [
      { weight: 315, reps: 3, completed: true },
      { weight: 315, reps: 5, completed: true },
    ],
  }];
  assert.equal(topSet(data).reps, 5);
});

test('a bodyweight-only session has no top set rather than a zero one', () => {
  const data = [{
    exercise_name: 'Pull Up',
    sets: [{ weight: null, reps: 12, completed: true }],
  }];
  assert.equal(topSet(data), null);
  assert.equal(topSetLabel(data), null);
});

test('a session still running has no duration', () => {
  assert.equal(sessionMinutes({ start_time: push.start_time, end_time: null }), null);
  assert.equal(formatMinutes(null), null);
});

test('durations past an hour read in hours', () => {
  assert.equal(formatMinutes(59), '59m');
  assert.equal(formatMinutes(60), '1h');
  assert.equal(formatMinutes(72), '1h 12m');
});

test('a malformed row summarises to zeroes instead of throwing', () => {
  assert.equal(sessionSummary({ id: 'x', workout_data: null }).volume, 0);
  assert.equal(sessionSummary(null), null);
  assert.equal(lifetimeVolume(null), 0);
});

test('lifetime volume adds the sessions up', () => {
  assert.equal(lifetimeVolume([push, push, push]), 28275);
});

test('days out is counted in whole local days', () => {
  const now = new Date(2026, 7, 22, 23, 30);       // Aug 22, 2026, 11:30pm
  assert.equal(daysOut('2026-09-15', now), 24);    // the Fall Classic deadline
  assert.equal(daysOut('2026-08-22', now), 0);
  assert.equal(daysOut('2026-08-23', now), 1);
  assert.equal(daysOut('2026-08-19', now), -3);
  assert.equal(daysOut(null, now), null);
});

test('days out reads as words, and past dates say so', () => {
  assert.equal(daysOutLabel(24), 'In 24 days');
  assert.equal(daysOutLabel(1), 'Tomorrow');
  assert.equal(daysOutLabel(0), 'Today');
  assert.equal(daysOutLabel(-1), '1 day ago');
  assert.equal(daysOutLabel(-3), '3 days ago');
});

/* ── the theme ──────────────────────────────────────────────────────────── */

test('anything unrecognised falls back to following the system', () => {
  assert.equal(normaliseTheme('dark'), 'dark');
  assert.equal(normaliseTheme(null), 'system');
  assert.equal(normaliseTheme('midnight'), 'system');
});

test('a stated preference wins, and system defers to the device', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  /* The head script and this function must agree on the same key, or a
     preference is written in one place and read from another. */
  assert.equal(THEME_KEY, 'ncbo.theme.v1');
});

test('applying a theme sets both the class and the colour scheme', () => {
  const classes = new Set();
  const el = {
    style: {},
    classList: {
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
    },
  };

  applyTheme(el, 'dark');
  assert.ok(classes.has('dark'));
  assert.equal(el.style.colorScheme, 'dark');

  applyTheme(el, 'light');
  assert.ok(!classes.has('dark'), 'a white scrollbar on a black page is this line');
  assert.equal(el.style.colorScheme, 'light');

  assert.doesNotThrow(() => applyTheme(null, 'dark'));
});

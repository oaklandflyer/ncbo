'use client';

import { useEffect, useState, useTransition } from 'react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { elapsed, workoutTotals } from '@/lib/workout';
import { saveWorkoutSession } from './actions';
import ExerciseBlock from './set-rows';
import ExercisePicker from './exercise-picker';

/* Two resets rather than the shared `buttonReset`, and the difference is one
   declaration. `bg-transparent` lands after the colour utilities in Tailwind's
   output, so it quietly wins over any `bg-*` set on the same button — which is
   why a blue "Finish" came out grey. Buttons that paint themselves use the
   reset without it; buttons that are text only keep it, because without
   preflight a bare <button> is the browser's own grey. */
const BTN = 'cursor-pointer appearance-none border-0 bg-transparent p-0';
const BTN_SOLID = 'cursor-pointer appearance-none border-0 p-0';

/**
 * The workout screen.
 *
 * Black ground, one blue accent, and rows tight enough that the set above the
 * one being typed is still on screen. Everything that is not a number a lifter
 * is reading or a control they are tapping mid-set is grey and small.
 *
 * The whole thing waits on `hasHydrated`. The server renders with an empty
 * store and the browser rehydrates from localStorage a moment later, so
 * drawing "start a workout" before the store is ready shows that button to
 * somebody who is mid-workout and then swaps it out underneath them, which is
 * indistinguishable from having lost their session.
 */
export default function WorkoutScreen({ catalogue }) {
  const hasHydrated = useWorkoutStore((s) => s.hasHydrated);
  const isActive = useWorkoutStore((s) => s.isActive);
  const startTime = useWorkoutStore((s) => s.startTime);
  const exercises = useWorkoutStore((s) => s.exercises);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const discardWorkout = useWorkoutStore((s) => s.discardWorkout);

  const [picking, setPicking] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [result, setResult] = useState({});
  const [saving, startSaving] = useTransition();

  /* The most recently ticked set, so the rest bar can be drawn under it.
     Held here rather than in the store: which row a bar is under is a fact
     about this screen, not about the workout, and the store is what gets
     saved. */
  const [lastTick, setLastTick] = useState(null);

  /* The header clock, ticking. `elapsed` is a pure read of the start time, so
     without something forcing a render it shows the minute the page loaded
     for as long as the page is open. */
  const [, tick] = useState(0);
  useEffect(() => {
    if (!isActive) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  if (!hasHydrated) {
    return <p className="px-1 py-6 text-[0.9rem] text-zinc-500" role="status">Loading your workout…</p>;
  }

  if (!isActive) {
    return (
      <div className="px-1 py-6">
        <h2 className="font-body text-[1.05rem] font-bold normal-case tracking-normal text-zinc-100">No workout running</h2>
        <p className="mt-2 max-w-[46ch] text-[0.9rem] leading-relaxed text-zinc-400">
          Start one and it stays on this device until you finish it. Locking your phone
          or reloading the page will not lose your sets.
        </p>
        <button
          type="button"
          onClick={startWorkout}
          className={`${BTN_SOLID} mt-5 w-full rounded-md bg-blue-500 py-3 text-center text-[0.85rem] font-bold uppercase tracking-[0.1em] text-white hover:bg-blue-400`}
        >
          Start empty workout
        </button>
        <Message ok={result.ok} error={result.error} />
      </div>
    );
  }

  const totals = workoutTotals(exercises);

  /* Where the rest bar goes. The tick that started the clock knows its own
     row, and when that is gone — a reload mid-rest, an untick — the last
     finished set in the list is the right answer and the only one derivable
     from the workout itself. */
  const tickedStillDone = lastTick
    && exercises[lastTick.exerciseIndex]?.sets?.[lastTick.setIndex]?.completed === true;
  const restPos = tickedStillDone ? lastTick : lastCompleted(exercises);

  /**
   * Finish, save, and only then clear.
   *
   * The order matters and it is the opposite of the obvious one. `finishWorkout`
   * returns the payload AND empties the store, so if the insert then fails the
   * workout is gone with nowhere to retry from. So the payload is built from
   * the live state first, saved, and the store cleared only once the row
   * exists. A failed save leaves everything exactly where it was.
   */
  function onFinish() {
    setResult({});
    const payload = {
      start_time: startTime,
      workout_data: exercises,
    };

    startSaving(async () => {
      const res = await saveWorkoutSession(payload);
      if (res?.error) {
        setResult({ error: res.error });
        return;
      }
      finishWorkout();
      setResult({ ok: `Saved. ${res.sets} set${res.sets === 1 ? '' : 's'} logged.` });
    });
  }

  return (
    <>
      {/* Parks under the app's top bar rather than at the top of the viewport,
          so the clock and Finish stay reachable however far down the list
          somebody has scrolled. */}
      <div className="sticky top-[60px] z-10 -mx-3 mb-1 flex items-center gap-3 border-b border-zinc-900 bg-zinc-950/95 px-4 py-2 backdrop-blur-[6px] sm:-mx-5 sm:px-6">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-zinc-500">
            Workout
          </p>
          <p className="text-[1.05rem] font-bold tabular-nums leading-tight text-zinc-100">
            {elapsed(startTime) || '0:00'}
          </p>
        </div>

        <button
          type="button"
          onClick={onFinish}
          disabled={saving || totals.sets === 0}
          className={`${BTN_SOLID} ml-auto rounded-md px-4 py-2 text-[0.78rem] font-bold uppercase tracking-[0.1em] ${
            saving || totals.sets === 0
              ? 'bg-zinc-800 text-zinc-500'
              : 'bg-blue-500 text-white hover:bg-blue-400'
          }`}
        >
          {saving ? 'Saving…' : 'Finish'}
        </button>
      </div>

      <p className="px-1 pb-2 text-[0.74rem] tabular-nums text-zinc-500">
        {totals.exercises} exercise{totals.exercises === 1 ? '' : 's'} · {totals.sets} set
        {totals.sets === 1 ? '' : 's'} · {totals.volume.toLocaleString()} lb
      </p>

      <Message error={result.error} ok={result.ok} />

      {exercises.length === 0 ? (
        <p className="px-1 py-8 text-center text-[0.9rem] text-zinc-500">
          Nothing logged yet. Add your first exercise.
        </p>
      ) : (
        <div className="divide-y divide-zinc-900">
          {exercises.map((ex, i) => (
            <ExerciseBlock
              key={`${ex.exercise_id || 'x'}-${i}`}
              exercise={ex}
              index={i}
              restAt={restPos?.exerciseIndex === i ? restPos.setIndex : null}
              onTick={(setIndex) => setLastTick({ exerciseIndex: i, setIndex })}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPicking(true)}
        className={`${BTN_SOLID} mt-3 w-full rounded-md bg-zinc-900 py-3 text-center text-[0.82rem] font-bold uppercase tracking-[0.1em] text-blue-500 hover:bg-zinc-800`}
      >
        + Add Exercise
      </button>

      <p className="mt-4 px-1 text-[0.78rem] leading-relaxed text-zinc-600">
        {totals.sets === 0
          ? 'Tick at least one set before finishing. Un-ticked sets are not saved.'
          : 'Only ticked sets are saved. Nobody else can see this, not your lead and not an admin.'}
      </p>

      {confirmDiscard ? (
        <div className="mt-3 rounded-md border border-red-900 bg-red-950/40 px-4 py-3">
          <p className="text-[0.88rem] text-zinc-200">
            Discard this workout? Nothing is saved and it cannot be recovered.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => { discardWorkout(); setConfirmDiscard(false); }}
              className={`${BTN_SOLID} rounded-md bg-red-600 px-3 py-2 text-[0.78rem] font-bold uppercase tracking-[0.1em] text-white hover:bg-red-500`}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className={`${BTN_SOLID} rounded-md bg-zinc-800 px-3 py-2 text-[0.78rem] font-bold uppercase tracking-[0.1em] text-zinc-200 hover:bg-zinc-700`}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDiscard(true)}
          className={`${BTN} mt-3 w-full py-2 text-center text-[0.78rem] font-bold uppercase tracking-[0.1em] text-red-500 hover:text-red-400`}
        >
          Discard workout
        </button>
      )}

      {/* Clears the phone tab bar, so the last control is never underneath it. */}
      <div aria-hidden className="h-16" />

      {picking && (
        <ExercisePicker
          catalogue={catalogue}
          onPick={(ex) => { addExercise(ex); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

/** Saved / failed, in the screen's own palette rather than the light one. */
function Message({ error, ok }) {
  if (!error && !ok) return null;
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`mb-2 px-1 text-[0.85rem] ${error ? 'text-red-400' : 'text-green-400'}`}
    >
      {error || ok}
    </p>
  );
}

/** The last finished set in the workout, in document order, or null. */
function lastCompleted(exercises) {
  for (let i = exercises.length - 1; i >= 0; i -= 1) {
    const sets = exercises[i]?.sets || [];
    for (let s = sets.length - 1; s >= 0; s -= 1) {
      if (sets[s]?.completed) return { exerciseIndex: i, setIndex: s };
    }
  }
  return null;
}

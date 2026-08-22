'use client';

import { useState, useTransition } from 'react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { elapsed, workoutTotals } from '@/lib/workout';
import { saveWorkoutSession } from './actions';
import ExerciseBlock from './set-rows';
import ExercisePicker from './exercise-picker';
import RestTimer from './rest-timer';
import {
  Card, Meta, Empty, btnPrimary, btnGhost, btnSmall, fineprint, FormMessage,
} from '@/app/ui';

/**
 * The workout screen.
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

  if (!hasHydrated) {
    return (
      <Card className="p-6">
        <p className={fineprint} role="status">Loading your workout…</p>
      </Card>
    );
  }

  if (!isActive) {
    return (
      <Card className="p-6">
        <h2 className="font-display text-[1.1rem] font-bold uppercase tracking-[0.04em] text-ink">
          No workout running
        </h2>
        <Meta className="mt-2">
          Start one and it stays on this device until you finish it. Locking your phone
          or reloading the page will not lose your sets.
        </Meta>
        <button type="button" onClick={startWorkout} className={`${btnPrimary} mt-5`}>
          Start empty workout
        </button>
        <FormMessage ok={result.ok} error={result.error} />
      </Card>
    );
  }

  const totals = workoutTotals(exercises);

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
      <div className="grid gap-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-[1.1rem] font-bold uppercase tracking-[0.04em] text-ink">
              Workout running
            </h2>
            <Meta>{elapsed(startTime) || '0:00'}</Meta>
          </div>
          <Meta className="mt-1">
            {totals.exercises} exercise{totals.exercises === 1 ? '' : 's'} · {totals.sets} set
            {totals.sets === 1 ? '' : 's'} · {totals.volume.toLocaleString()} lbs
          </Meta>
        </Card>

        {exercises.length === 0 ? (
          <Empty>Nothing logged yet. Add your first exercise.</Empty>
        ) : (
          exercises.map((ex, i) => (
            <ExerciseBlock key={`${ex.exercise_id || 'x'}-${i}`} exercise={ex} index={i} />
          ))
        )}

        <button type="button" onClick={() => setPicking(true)} className={`${btnPrimary} w-full`}>
          Add exercise
        </button>

        <Card className="p-5">
          <button
            type="button"
            onClick={onFinish}
            disabled={saving || totals.sets === 0}
            className={`${btnPrimary} w-full`}
          >
            {saving ? 'Saving…' : 'Finish and save'}
          </button>
          <p className={`mt-3 ${fineprint}`}>
            {totals.sets === 0
              ? 'Tick at least one set before finishing. Un-ticked sets are not saved.'
              : 'Only ticked sets are saved. Nobody else can see this, not your lead and not an admin.'}
          </p>

          {confirmDiscard ? (
            <div className="mt-4 rounded-[8px] border border-danger px-4 py-3">
              <p className="text-[0.9rem] text-body">
                Discard this workout? Nothing is saved and it cannot be recovered.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { discardWorkout(); setConfirmDiscard(false); }}
                  className={`${btnGhost} ${btnSmall} border-danger text-danger`}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className={`${btnGhost} ${btnSmall}`}
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              className={`${btnGhost} ${btnSmall} mt-3`}
            >
              Discard workout
            </button>
          )}

          <FormMessage error={result.error} ok={result.ok} />
        </Card>

        {/* Clears the timer's fixed footer, so the last card is never hidden
            underneath it. */}
        <div aria-hidden className="h-24" />
      </div>

      {picking && (
        <ExercisePicker
          catalogue={catalogue}
          onPick={(ex) => { addExercise(ex); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}

      <RestTimer />
    </>
  );
}

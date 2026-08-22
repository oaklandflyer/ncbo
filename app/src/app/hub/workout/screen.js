'use client';

import { useWorkoutStore } from '@/store/useWorkoutStore';
import { elapsed } from '@/lib/workout';
import { Card, Meta, Empty, btnPrimary, btnGhost, btnSmall, fineprint } from '@/app/ui';

/**
 * The skeleton for phase 1: start a workout, or see that one is running.
 *
 * The whole screen waits on `hasHydrated`, and that is not caution for its own
 * sake. The server renders this with an empty store and the browser rehydrates
 * from localStorage a moment later, so rendering "Start a workout" before the
 * store is ready would show that button to somebody who is mid-workout, and
 * React would then swap it out underneath them. Holding still for one frame is
 * the difference between a tracker you can trust and one that appears to have
 * lost your session.
 */
export default function WorkoutScreen({ catalogue }) {
  const hasHydrated = useWorkoutStore((s) => s.hasHydrated);
  const isActive = useWorkoutStore((s) => s.isActive);
  const startTime = useWorkoutStore((s) => s.startTime);
  const exercises = useWorkoutStore((s) => s.exercises);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const discardWorkout = useWorkoutStore((s) => s.discardWorkout);

  /* Same height as the card below, so the page does not jump when the real
     state arrives. */
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
        <p className={`mt-4 ${fineprint}`}>
          {catalogue.length} exercises in the catalogue.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[1.1rem] font-bold uppercase tracking-[0.04em] text-ink">
          Workout running
        </h2>
        {/* Rendered once, not ticking. A live timer is a `setInterval` and a
            re-render every second, and phase 1 has nothing that needs it. */}
        <Meta>Started {elapsed(startTime) || 'just now'} ago</Meta>
      </div>

      {exercises.length === 0 ? (
        <div className="mt-4">
          <Empty>No exercises yet. Adding them is phase 2.</Empty>
        </div>
      ) : (
        <ul className="mt-4 grid list-none gap-2">
          {exercises.map((ex, i) => (
            <li key={`${ex.exercise_id || 'x'}-${i}`} className="text-[0.95rem] text-body">
              {ex.exercise_name}
              <span className="text-meta"> · {ex.sets.length} set{ex.sets.length === 1 ? '' : 's'}</span>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={discardWorkout} className={`${btnGhost} ${btnSmall} mt-5`}>
        Discard workout
      </button>
      <p className={`mt-3 ${fineprint}`}>
        Finishing and saving to your history is phase 2. Nothing is written to the
        database yet.
      </p>
    </Card>
  );
}

'use client';

import { useWorkoutStore } from '@/store/useWorkoutStore';
import { buttonReset } from '@/app/ui';

/**
 * One exercise and its sets.
 *
 * Built for a phone held in one hand between sets, so the rules are:
 * every control is at least 44px, the two numbers are the widest things on
 * the row, and ticking a set is a single tap on a target big enough to hit
 * without looking.
 *
 * `inputMode="decimal"` rather than `type="number"`: a number input on iOS
 * brings up a keypad with no decimal point on some locales, and its spinner
 * arrows are a 12px tap target next to the field you actually want.
 */
export default function ExerciseBlock({ exercise, index }) {
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const addSet = useWorkoutStore((s) => s.addSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const removeExercise = useWorkoutStore((s) => s.removeExercise);

  return (
    <div className="rounded-[8px] border border-edge bg-surface">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <h3 className="min-w-0 flex-1 truncate font-display text-[1rem] font-bold uppercase tracking-[0.02em] text-ink">
          {exercise.exercise_name}
        </h3>
        <button
          type="button"
          onClick={() => removeExercise(index)}
          aria-label={`Remove ${exercise.exercise_name}`}
          className={`${buttonReset} min-h-[40px] px-2 font-display text-[0.7rem] font-bold uppercase tracking-[0.12em] text-meta hover:text-danger`}
        >
          Remove
        </button>
      </div>

      {/* A header row, so the two number columns are labelled once rather than
          on every input. Sets get numerous; labels do not need to. */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <span className="w-7 font-display text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-meta">Set</span>
        <span className="flex-1 font-display text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-meta">lbs</span>
        <span className="flex-1 font-display text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-meta">Reps</span>
        <span className="w-11" />
        <span className="w-8" />
      </div>

      <ul className="list-none px-4 pb-3">
        {exercise.sets.map((set, s) => (
          <li key={s} className="flex items-center gap-2 py-1">
            <span className="w-7 font-display text-[0.9rem] font-bold tabular-nums text-meta">{s + 1}</span>

            <input
              inputMode="decimal"
              enterKeyHint="next"
              aria-label={`Set ${s + 1} weight in pounds`}
              value={set.weight ?? ''}
              onChange={(e) => updateSet(index, s, { weight: e.target.value })}
              className={`min-h-[44px] w-full flex-1 rounded-[6px] border px-2 text-center text-[1.05rem] tabular-nums ${
                set.completed ? 'border-transparent bg-brand-wash text-brand' : 'border-edge bg-page text-ink'
              }`}
            />

            <input
              inputMode="numeric"
              enterKeyHint="done"
              aria-label={`Set ${s + 1} reps`}
              value={set.reps ?? ''}
              onChange={(e) => updateSet(index, s, { reps: e.target.value })}
              className={`min-h-[44px] w-full flex-1 rounded-[6px] border px-2 text-center text-[1.05rem] tabular-nums ${
                set.completed ? 'border-transparent bg-brand-wash text-brand' : 'border-edge bg-page text-ink'
              }`}
            />

            {/* The whole point of the screen. 44px square, filled when done,
                and it is what starts the rest clock. */}
            <button
              type="button"
              role="switch"
              aria-checked={set.completed}
              aria-label={`Mark set ${s + 1} complete`}
              onClick={() => updateSet(index, s, { completed: !set.completed })}
              className={`${buttonReset} flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border ${
                set.completed
                  ? 'border-brand bg-brand text-white'
                  : 'border-edge bg-page text-meta hover:border-brand'
              }`}
            >
              <Check done={set.completed} />
            </button>

            <button
              type="button"
              onClick={() => removeSet(index, s)}
              disabled={exercise.sets.length <= 1}
              aria-label={`Remove set ${s + 1}`}
              className={`${buttonReset} h-11 w-8 shrink-0 text-center text-[1.1rem] leading-none ${
                exercise.sets.length <= 1 ? 'text-fine opacity-40' : 'text-meta hover:text-danger'
              }`}
            >
              &minus;
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => addSet(index)}
        className={`${buttonReset} min-h-[44px] w-full border-t border-edge font-display text-[0.74rem] font-bold uppercase tracking-[0.14em] text-brand hover:bg-band`}
      >
        + Add set
      </button>
    </div>
  );
}

function Check({ done }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 10.5 8 14.5 16 6"
        stroke="currentColor"
        strokeWidth={done ? 2.6 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={done ? 1 : 0.35}
      />
    </svg>
  );
}

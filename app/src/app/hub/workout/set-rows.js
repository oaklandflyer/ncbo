'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import RestBar from './rest-timer';
import { LinkIcon, MoreIcon, CheckIcon } from './icons';

/**
 * One exercise and its sets, laid out the way a lifting app lays them out.
 *
 * Five columns, the same five on every row and in the header above them:
 *
 *   SET · PREVIOUS · LB · REPS · ✓
 *
 * The widths are fixed rather than fluid because the columns have to line up
 * down the whole screen — a grid that sizes to its content puts the tick in a
 * different place on the row with a four digit volume, and the one control
 * that gets tapped without looking is the one that must never move.
 *
 * Dense on purpose: three exercises' worth of sets on a phone screen beats a
 * comfortable two, because the thing being compared is always the set above.
 *
 * `inputMode="decimal"` rather than `type="number"`: a number input on iOS
 * brings up a keypad with no decimal point on some locales, and its spinner
 * arrows are a 12px tap target next to the field you actually want.
 */

/* Two resets rather than the shared `buttonReset`, and the difference is one
   declaration. `bg-transparent` lands after the colour utilities in Tailwind's
   output, so it quietly wins over any `bg-*` set on the same button — which is
   why a blue "Finish" came out grey. Buttons that paint themselves use the
   reset without it; buttons that are text only keep it, because without
   preflight a bare <button> is the browser's own grey. */
const BTN = 'cursor-pointer appearance-none border-0 bg-transparent p-0';
const BTN_SOLID = 'cursor-pointer appearance-none border-0 p-0';

/* One string, used by the header and every row, so they cannot drift. */
const GRID = 'grid grid-cols-[1.9rem_minmax(0,1fr)_3.6rem_3.6rem_2.1rem] items-center gap-1.5';

const INPUT =
  'h-9 w-full rounded-md border-none text-center text-[0.92rem] font-semibold tabular-nums '
  + 'outline-none focus:outline-none focus:ring-0 placeholder:text-zinc-600';

export default function ExerciseBlock({ exercise, index, restAt = null, onTick }) {
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const addSet = useWorkoutStore((s) => s.addSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const removeExercise = useWorkoutStore((s) => s.removeExercise);

  const sets = exercise.sets || [];

  return (
    <div className="py-2">
      <ExerciseHeader
        name={exercise.exercise_name}
        canRemoveSet={sets.length > 1}
        onRemoveSet={() => removeSet(index, sets.length - 1)}
        onRemoveExercise={() => removeExercise(index)}
      />

      {/* Labelled once, at the top, rather than on every input. Sets get
          numerous; labels do not need to. */}
      <div className={`${GRID} px-1 pb-1 pt-2 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-zinc-500`}>
        <span className="text-center">Set</span>
        <span className="text-center">Previous</span>
        <span className="text-center">Lb</span>
        <span className="text-center">Reps</span>
        <span />
      </div>

      <ul className="list-none">
        {sets.map((set, s) => (
          <li key={s}>
            <div
              className={`${GRID} rounded-md px-1 py-0.5 ${set.completed ? 'bg-green-900/30' : ''}`}
            >
              <span className="text-center text-[0.85rem] font-bold tabular-nums text-zinc-300">
                {s + 1}
              </span>

              {/* Ghost text: what this set was last time, un-tappable and
                  deliberately quiet. It is a reference, not a control. */}
              <span className="truncate text-center text-[0.78rem] tabular-nums text-zinc-500">
                {previousLabel(sets, s)}
              </span>

              <input
                inputMode="decimal"
                enterKeyHint="next"
                placeholder="—"
                aria-label={`Set ${s + 1} weight in pounds`}
                value={set.weight ?? ''}
                onChange={(e) => updateSet(index, s, { weight: e.target.value })}
                className={`${INPUT} ${set.completed ? 'bg-transparent text-zinc-100' : 'bg-zinc-800 text-zinc-100'}`}
              />

              <input
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="—"
                aria-label={`Set ${s + 1} reps`}
                value={set.reps ?? ''}
                onChange={(e) => updateSet(index, s, { reps: e.target.value })}
                className={`${INPUT} ${set.completed ? 'bg-transparent text-zinc-100' : 'bg-zinc-800 text-zinc-100'}`}
              />

              {/* The whole point of the screen, and what starts the rest
                  clock. Solid green once ticked, so a finished row reads at a
                  glance from the colour alone. */}
              <button
                type="button"
                role="switch"
                aria-checked={set.completed}
                aria-label={`Mark set ${s + 1} complete`}
                onClick={() => {
                  const next = !set.completed;
                  updateSet(index, s, { completed: next });
                  if (next) onTick?.(s);
                }}
                className={`${BTN_SOLID} flex h-8 w-8 items-center justify-center rounded-md ${
                  set.completed
                    ? 'bg-green-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <CheckIcon />
              </button>
            </div>

            {/* The rest bar belongs to the set that started it, so it is
                rendered inside that row's list item rather than floated over
                the screen. The parent decides which row that is. */}
            {restAt === s && <RestBar />}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => addSet(index)}
        className={`${BTN} mt-1 w-full py-2 text-center text-[0.78rem] font-bold uppercase tracking-[0.1em] text-blue-500 hover:text-blue-400`}
      >
        + Add Set
      </button>
    </div>
  );
}

/**
 * The exercise name, in the app's one loud colour, and the two icons that sit
 * beside it in every lifting app.
 *
 * The chain link is a placeholder: supersets are not built yet, and a disabled
 * control that says so is better than an icon that silently does nothing. The
 * three dots are real — they carry the destructive actions that used to be a
 * "Remove" word in the header and a minus sign on every row, both of which
 * spent width the number columns needed.
 */
function ExerciseHeader({ name, canRemoveSet, onRemoveSet, onRemoveExercise }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  /* A menu that only closes by tapping its own button is a menu that gets
     left open behind a keyboard. */
  useEffect(() => {
    if (!open) return undefined;
    function away(e) {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    }
    function esc(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative flex items-center gap-1 px-1">
      <h3 className="min-w-0 flex-1 truncate font-body text-[0.98rem] font-bold normal-case leading-tight tracking-normal text-blue-500">
        {name}
      </h3>

      <button
        type="button"
        disabled
        title="Supersets are not built yet"
        aria-label={`Superset ${name} (not available yet)`}
        className={`${BTN} flex h-8 w-8 items-center justify-center rounded-md text-zinc-600`}
      >
        <LinkIcon size={17} />
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name} options`}
        className={`${BTN} flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100`}
      >
        <MoreIcon size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!canRemoveSet}
            onClick={() => { onRemoveSet(); setOpen(false); }}
            className={`${BTN} block w-full px-3 py-2 text-left text-[0.85rem] ${
              canRemoveSet ? 'text-zinc-200 hover:bg-zinc-800' : 'text-zinc-600'
            }`}
          >
            Remove last set
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { onRemoveExercise(); setOpen(false); }}
            className={`${BTN} block w-full px-3 py-2 text-left text-[0.85rem] text-red-500 hover:bg-zinc-800`}
          >
            Remove exercise
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * What to show under PREVIOUS.
 *
 * A set carries `previous` once the history read exists — this renders it as
 * given, so lighting that column up is a server change and no UI change at
 * all. Until then the honest stand-in is the last set actually finished on
 * this exercise today, which is what somebody is comparing against anyway
 * when they decide what to put on the bar.
 *
 * A dash when there is nothing to compare with. An empty cell reads as a
 * layout bug; a dash reads as "first set".
 */
function previousLabel(sets, index) {
  const own = sets[index];
  if (typeof own?.previous === 'string' && own.previous) return own.previous;

  for (let i = index - 1; i >= 0; i -= 1) {
    const set = sets[i];
    if (!set?.completed) continue;
    if (set.weight) return `${set.weight} lb × ${set.reps ?? 0}`;
    if (set.reps) return `${set.reps} reps`;
  }
  return '—';
}

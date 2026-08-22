'use client';

import { useMemo, useState } from 'react';

/* Two resets rather than the shared `buttonReset`, and the difference is one
   declaration. `bg-transparent` lands after the colour utilities in Tailwind's
   output, so it quietly wins over any `bg-*` set on the same button — which is
   why a blue "Finish" came out grey. Buttons that paint themselves use the
   reset without it; buttons that are text only keep it, because without
   preflight a bare <button> is the browser's own grey. */
const BTN = 'cursor-pointer appearance-none border-0 bg-transparent p-0';
const BTN_SOLID = 'cursor-pointer appearance-none border-0 p-0';

/**
 * Pick an exercise, grouped by muscle.
 *
 * A sheet rather than a `<select>`: there are thirty of these and growing, and
 * a native picker gives no search and no grouping. Filtered in the browser
 * because the catalogue arrived with the page, so typing costs nothing.
 *
 * Every row is 48px. This is tapped mid-workout, with chalk on, by somebody
 * not looking carefully.
 */
export default function ExercisePicker({ catalogue, onPick, onClose }) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? catalogue.filter((e) => `${e.name} ${e.muscle_group || ''}`.toLowerCase().includes(q))
      : catalogue;

    const byMuscle = new Map();
    for (const ex of matches) {
      const key = ex.muscle_group || 'Other';
      if (!byMuscle.has(key)) byMuscle.set(key, []);
      byMuscle.get(key).push(ex);
    }
    return [...byMuscle.entries()];
  }, [catalogue, query]);

  return (
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add an exercise"
        className="flex max-h-[85vh] w-full max-w-[520px] flex-col rounded-t-[16px] border border-zinc-800 bg-zinc-950 font-body text-zinc-100 sm:rounded-[12px]"
      >
        <div className="border-b border-zinc-900 p-3">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            className="h-11 w-full rounded-md border-none bg-zinc-800 px-3 text-[0.95rem] text-zinc-100 outline-none placeholder:text-zinc-500 focus:outline-none focus:ring-0"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {groups.length === 0 ? (
            <p className="p-4 text-center text-[0.86rem] text-zinc-500">
              Nothing matches that. An admin adds new exercises to the catalogue.
            </p>
          ) : groups.map(([muscle, list]) => (
            <div key={muscle} className="mb-3">
              <p className="px-3 pb-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-zinc-500">
                {muscle}
              </p>
              <ul className="list-none">
                {list.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => onPick(ex)}
                      className={`${BTN} flex min-h-[44px] w-full items-center rounded-md px-3 text-left text-[0.92rem] font-semibold text-blue-500 hover:bg-zinc-900`}
                    >
                      {ex.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-900 p-3">
          <button
            type="button"
            onClick={onClose}
            className={`${BTN_SOLID} w-full rounded-md bg-zinc-900 py-3 text-center text-[0.8rem] font-bold uppercase tracking-[0.1em] text-zinc-300 hover:bg-zinc-800`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { field, btnGhost, btnSmall, buttonReset, fineprint } from '@/app/ui';

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
      className="fixed inset-0 z-[400] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add an exercise"
        className="flex max-h-[85vh] w-full max-w-[520px] flex-col rounded-t-[16px] border border-edge bg-surface sm:rounded-[12px]"
      >
        <div className="border-b border-edge p-4">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            className={`${field} min-h-[44px]`}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {groups.length === 0 ? (
            <p className={`p-4 text-center ${fineprint}`}>
              Nothing matches that. An admin adds new exercises to the catalogue.
            </p>
          ) : groups.map(([muscle, list]) => (
            <div key={muscle} className="mb-3">
              <p className="px-3 pb-1 font-display text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-meta">
                {muscle}
              </p>
              <ul className="list-none">
                {list.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => onPick(ex)}
                      className={`${buttonReset} flex min-h-[48px] w-full items-center rounded-[6px] px-3 text-left text-[1rem] text-body hover:bg-band`}
                    >
                      {ex.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-edge p-3">
          <button type="button" onClick={onClose} className={`${btnGhost} ${btnSmall} w-full`}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

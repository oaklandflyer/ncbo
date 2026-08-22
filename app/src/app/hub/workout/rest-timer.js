'use client';

import { useEffect, useState } from 'react';
import { useWorkoutStore, REST_SECONDS } from '@/store/useWorkoutStore';
import { buttonReset } from '@/app/ui';

/**
 * The rest clock, pinned above the tab bar.
 *
 * It reads an absolute end time from the store and derives the remaining
 * seconds on each tick. That is the important part: a countdown held as
 * "62 seconds left" stops being true the moment the tab is backgrounded,
 * because nothing decrements it while the phone is asleep. Somebody who locks
 * their screen mid-rest and comes back should see the right number, and with
 * an end timestamp they do.
 *
 * The interval exists only to re-render. It is not the source of truth, so a
 * dropped tick costs a frame rather than a second.
 */
export default function RestTimer() {
  const restEndsAt = useWorkoutStore((s) => s.restEndsAt);
  const startRest = useWorkoutStore((s) => s.startRest);
  const clearRest = useWorkoutStore((s) => s.clearRest);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!restEndsAt) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [restEndsAt]);

  if (!restEndsAt) return null;

  const remaining = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
  const done = remaining === 0;
  const pct = Math.min(100, Math.max(0, (remaining / REST_SECONDS) * 100));

  return (
    <div
      role="timer"
      aria-live="off"
      className="fixed inset-x-0 bottom-[76px] z-[300] px-4 lg:bottom-4 lg:left-[264px] lg:right-4"
    >
      <div className={`overflow-hidden rounded-[10px] border shadow-brand ${
        done ? 'border-brand bg-brand text-white' : 'border-edge bg-surface'
      }`}
      >
        {/* A bar rather than only a number: mid-set, at arm's length, the
            proportion is readable in a way two digits are not. */}
        <div className="h-1 w-full bg-band">
          <div
            className={`h-full transition-[width] duration-200 ease-linear ${done ? 'bg-white' : 'bg-brand'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <span className={`font-display text-[1.35rem] font-extrabold tabular-nums ${done ? 'text-white' : 'text-ink'}`}>
            {done ? 'Rest over' : format(remaining)}
          </span>

          <span className={`text-[0.82rem] ${done ? 'text-white/80' : 'text-meta'}`}>
            {done ? 'Next set' : 'Resting'}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {/* +30 rather than a picker: adding time is the only adjustment
                anybody makes mid-rest, and it has to work with one thumb. */}
            <button
              type="button"
              onClick={() => startRest(remaining + 30)}
              className={`${buttonReset} min-h-[40px] rounded-[6px] px-3 font-display text-[0.76rem] font-bold uppercase tracking-[0.1em] ${
                done ? 'text-white' : 'text-brand'
              }`}
            >
              +30s
            </button>
            <button
              type="button"
              onClick={clearRest}
              aria-label="Dismiss rest timer"
              className={`${buttonReset} min-h-[40px] rounded-[6px] px-3 font-display text-[0.76rem] font-bold uppercase tracking-[0.1em] ${
                done ? 'text-white' : 'text-meta'
              }`}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function format(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

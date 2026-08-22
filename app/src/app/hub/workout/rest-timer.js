'use client';

import { useEffect, useState } from 'react';
import { useWorkoutStore, REST_SECONDS } from '@/store/useWorkoutStore';

/* Two resets rather than the shared `buttonReset`, and the difference is one
   declaration. `bg-transparent` lands after the colour utilities in Tailwind's
   output, so it quietly wins over any `bg-*` set on the same button — which is
   why a blue "Finish" came out grey. Buttons that paint themselves use the
   reset without it; buttons that are text only keep it, because without
   preflight a bare <button> is the browser's own grey. */
const BTN = 'cursor-pointer appearance-none border-0 bg-transparent p-0';
const BTN_SOLID = 'cursor-pointer appearance-none border-0 p-0';

/**
 * The rest clock, inline.
 *
 * It used to be a card pinned above the tab bar, which is the obvious place
 * and the wrong one: a floating bar covers the sets underneath it and gives no
 * answer to "rest from which set?" on a screen where three exercises are
 * open at once. Strong puts the bar in the list, directly under the set that
 * started it, so the countdown is attached to the thing it counts. This is
 * that: the caller renders it after the row it belongs to.
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
export default function RestBar() {
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
      className="relative my-1 overflow-hidden rounded-md bg-blue-500 py-1 text-center font-bold text-white"
    >
      {/* The fill drains right to left behind the digits. Mid-set, at arm's
          length, the proportion is readable in a way two digits are not. */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 bg-blue-400 transition-[width] duration-200 ease-linear"
        style={{ width: `${pct}%` }}
      />

      <div className="relative flex items-center justify-between px-2 text-[0.78rem] tracking-[0.06em]">
        <button
          type="button"
          onClick={() => startRest(remaining + 30)}
          className={`${BTN} px-2 py-1 font-bold text-white/90 tabular-nums`}
        >
          +30s
        </button>

        <span className="tabular-nums">
          {done ? 'REST OVER' : `REST ${format(remaining)}`}
        </span>

        <button
          type="button"
          onClick={clearRest}
          aria-label="Skip rest"
          className={`${BTN} px-2 py-1 font-bold text-white/90`}
        >
          SKIP
        </button>
      </div>
    </div>
  );
}

function format(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

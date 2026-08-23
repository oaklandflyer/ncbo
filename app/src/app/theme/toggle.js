'use client';

import { useTheme } from './provider';

/**
 * Light · Dark · System, as one segmented control.
 *
 * Three states rather than a switch, because a two-state toggle cannot say
 * "follow my phone" — and on a phone that is the setting most people actually
 * want, since it is the one that is right at both 9am and 11pm.
 *
 * It is a radio group in the accessibility tree: three buttons that each toggle
 * are three things a screen reader has to read separately to work out which is
 * on. `aria-checked` on a radio says which one is on in a single stop.
 */
const OPTIONS = [
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['system', 'System'],
];

export default function ThemeToggle() {
  const { preference, setTheme, ready } = useTheme();

  return (
    <div>
      <p className="pb-2 font-display text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-meta">
        Theme
      </p>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="grid grid-cols-3 gap-1 rounded-[8px] border border-edge bg-raised/60 p-1"
      >
        {OPTIONS.map(([value, label]) => {
          /* Before the storage read lands nothing is marked selected, rather
             than `system` being marked and then jumping. One frame of no
             highlight reads as loading; a highlight that moves reads as the
             app changing its mind. */
          const on = ready && preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTheme(value)}
              className={`cursor-pointer appearance-none rounded-[6px] border-0 px-2 py-2 font-display text-[0.72rem] font-bold uppercase tracking-[0.12em] transition-colors ${
                on ? 'bg-surface text-brand shadow-brand-sm' : 'bg-transparent text-meta hover:text-ink'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

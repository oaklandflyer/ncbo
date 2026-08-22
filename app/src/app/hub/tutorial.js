'use client';

import { useEffect, useState } from 'react';
import { Seal } from '@/app/brand/marks';
import { btnPrimary, buttonReset, fineprint } from '@/app/ui';

/**
 * The first-run welcome, once per device.
 *
 * Three things about how this is built, each of them a bug it would otherwise
 * have had:
 *
 *  1. **It renders nothing on the first client pass.** `localStorage` does not
 *     exist on the server, so reading it during render is a hydration mismatch
 *     on the busiest page in the app. The read happens in an effect, and until
 *     it answers this draws nothing — better a beat of nothing than a welcome
 *     card that flashes for everybody who has already dismissed it.
 *
 *  2. **Every access is wrapped.** Safari in private mode throws on
 *     `localStorage` rather than returning null, and a throw here would take
 *     down the whole dashboard for the sake of a tooltip.
 *
 *  3. **Dismissing writes before it closes.** If the write fails the overlay
 *     still closes, because refusing to let somebody past a welcome screen is
 *     a worse outcome than showing it again next time.
 *
 * Per device, not per account, and the copy says so: it is a hint about where
 * things are, not a record of anything.
 */
const KEY = 'has_seen_tutorial';

function seen() {
  try {
    return window.localStorage.getItem(KEY) === 'true';
  } catch {
    /* Private mode, or site data blocked. Treat as seen: somebody who cannot
       persist the dismissal would be shown this on every single page load. */
    return true;
  }
}

function remember() {
  try {
    window.localStorage.setItem(KEY, 'true');
  } catch {
    /* Nothing to do. The overlay closes regardless. */
  }
}

const STEPS = [
  ['Calendar', 'What your chapter has coming up, straight from the calendar your lead already keeps.'],
  ['Network', 'Everybody in NCBO, by chapter or by where they are from. Tap a name for their profile.'],
  ['Rankings', 'Where you and your chapter stand. Logging a verified result is what moves it.'],
  ['Q&A', 'Ask anything. Answers come from coaching advisors and from members who have done it.'],
];

export default function Tutorial({ extraSteps = [] }) {
  /* null = not yet known. Three states, not two: unknown, show, hide. */
  const [show, setShow] = useState(null);

  useEffect(() => { setShow(!seen()); }, []);

  if (show !== true) return null;

  function dismiss() {
    remember();
    setShow(false);
  }

  const steps = [...STEPS, ...extraSteps];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      className="fixed inset-0 z-[500] flex items-end justify-center bg-ink/50 p-4 backdrop-blur-[2px] sm:items-center"
    >
      <div className="w-full max-w-[520px] rounded-[12px] border border-edge bg-surface p-6 shadow-brand sm:p-8">
        <div className="flex items-center gap-3">
          <Seal alt="" className="h-10 w-10" />
          <h2
            id="tutorial-title"
            className="font-display text-[1.3rem] font-extrabold uppercase leading-none tracking-[0.02em] text-ink"
          >
            Welcome to NCBO
          </h2>
        </div>

        <p className="mt-4 text-[1rem] leading-relaxed text-body">
          You are in. Here is where everything lives, and you can get back to this from
          any screen once you have found it.
        </p>

        <ul className="mt-5 grid list-none gap-3">
          {steps.map(([name, what]) => (
            <li key={name} className="border-l-2 border-brand pl-4">
              <p className="font-display text-[0.9rem] font-bold uppercase tracking-[0.04em] text-ink">
                {name}
              </p>
              <p className={`mt-1 ${fineprint}`}>{what}</p>
            </li>
          ))}
        </ul>

        <button type="button" onClick={dismiss} className={`${btnPrimary} mt-6 w-full`} autoFocus>
          Got it
        </button>

        <p className={`mt-3 text-center ${fineprint}`}>
          This is per device, so it may say hello again on your phone.
        </p>

        {/* A second way out, because a modal with one button is a trap if that
            button ever fails to render. */}
        <button
          type="button"
          onClick={dismiss}
          className={`${buttonReset} mt-2 w-full text-center ${fineprint} underline underline-offset-2`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

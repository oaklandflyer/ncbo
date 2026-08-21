'use client';

import { useEffect, useState } from 'react';
import { btnPrimary, btnSmall, buttonReset, fineprint } from '@/app/ui';

/**
 * The install prompt.
 *
 * Three things it has to get right, none of which are obvious:
 *
 *   · It must not appear in an already-installed copy. `display-mode:
 *     standalone` is how a PWA knows it is one — without that check, every
 *     member who installed it would be told to install it.
 *   · Chrome fires `beforeinstallprompt` and lets you call `prompt()` later.
 *     iOS Safari fires nothing and has no API, so the only honest thing to
 *     offer there is the Share-sheet instructions.
 *   · A dismissal has to stick. It is remembered in localStorage, wrapped in
 *     try/catch because private mode throws on write.
 */
const KEY = 'ncbo.install.dismissed';

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (standalone) return undefined;

    try { if (localStorage.getItem(KEY)) return undefined; } catch { /* private mode */ }

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
      && !/crios|fxios/i.test(window.navigator.userAgent);

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    /* Safari never fires the event, so the banner is shown on its own after a
       beat — long enough that it doesn't land on top of a page still
       painting. */
    let timer;
    if (isIos) {
      setIos(true);
      timer = setTimeout(() => setShow(true), 1200);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* nothing to do */ }
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!show) return null;

  return (
    <div
      role="complementary"
      aria-label="Install the NCBO app"
      /* Above the tab bar on a phone, so it never covers navigation. */
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+58px)] z-[250] px-4 md:bottom-5 md:left-auto md:right-5 md:max-w-[380px] md:px-0"
    >
      <div className="rounded-[8px] border border-edge bg-surface p-5 shadow-brand">
        <div className="flex items-start justify-between gap-4">
          <p className="font-display text-[1rem] font-extrabold uppercase leading-tight text-ink">
            Install the NCBO App to your homescreen for the best experience.
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className={`${buttonReset} -mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-meta transition hover:text-ink`}
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {ios ? (
          <p className={`mt-3 ${fineprint}`}>
            Tap the Share button in Safari, then <b className="font-semibold text-body">Add to
            Home Screen</b>. It opens full-screen, without the address bar.
          </p>
        ) : (
          <>
            <p className={`mt-3 ${fineprint}`}>
              It opens full-screen and loads faster, with no address bar in the way.
            </p>
            <button type="button" onClick={install} className={`${btnPrimary} ${btnSmall} mt-4`}>
              Install
            </button>
          </>
        )}
      </div>
    </div>
  );
}

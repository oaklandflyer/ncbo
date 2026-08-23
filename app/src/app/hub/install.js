'use client';

import { useEffect, useState } from 'react';
import {
  detectPlatform, isStandalone, needsManualInstall, dismissalActive,
} from '@/lib/install';
import { btnPrimary, btnGhost, btnSmall, buttonReset, fineprint } from '@/app/ui';

/**
 * "Install the app", for the browsers that will not say it themselves.
 *
 * Chrome on Android promotes installation on its own: it fires
 * `beforeinstallprompt`, shows a mini-infobar and carries an Install item in
 * its menu. **Safari does none of that and offers no API to ask with.** So on
 * an iPhone the app is only ever installed by somebody who already knew about
 * Share ▸ Add to Home Screen — which is nobody — and this component is the
 * whole of the difference.
 *
 * It matters more than a nicety now: iOS grants push notifications only to an
 * installed PWA, so an iPhone member who never installs can never be notified.
 *
 * Two shapes, one behaviour:
 *
 *   `banner` — the interruption. Dismissible, and the dismissal lapses after
 *              thirty days rather than never: "not now" is not "never".
 *   `inline` — a row in the More sheet and on the profile, which never
 *              disappears, so somebody who dismissed the banner (or who has
 *              just been told push needs an installed app) still has a way in.
 */
const KEY = 'ncbo.install.dismissed';

export default function InstallPrompt({ variant = 'banner' }) {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState('other');
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    if (isStandalone()) return undefined;

    const detected = detectPlatform({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      platform: navigator.platform,
    });
    setPlatform(detected);

    /* The inline row is a setting, not an interruption: it ignores the
       dismissal and shows as soon as we know the app is not installed. */
    if (variant === 'inline') {
      setShow(true);
    } else {
      let dismissed = false;
      try { dismissed = dismissalActive(localStorage.getItem(KEY)); } catch { /* private mode */ }
      if (dismissed) return undefined;
    }

    /* Chromium hands over its own prompt, which is a real install button
       rather than instructions. Captured whatever the variant, so the inline
       row on a Mac in Chrome can offer the button too. */
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      if (variant === 'banner') setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    /* Safari fires nothing, ever, so the banner has to decide for itself to
       appear. After a beat, so it does not land on a page still painting. */
    let timer;
    if (variant === 'banner' && needsManualInstall(detected)) {
      timer = setTimeout(() => setShow(true), 1200);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, [variant]);

  function dismiss() {
    setShow(false);
    /* The timestamp, not a flag: `dismissalActive` needs to know when, and the
       old code wrote "1", which is why a dismissal used to be forever. */
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* nothing to do */ }
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    if (variant === 'banner') dismiss();
    else setShow(false);
  }

  if (!show) return null;

  const steps = <Steps platform={platform} />;

  if (variant === 'inline') {
    return (
      <div>
        <p className="pb-2 font-display text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-meta">
          Install the app
        </p>
        <div className="rounded-[8px] border border-edge bg-raised/60 px-4 py-3">
          <p className="text-[0.95rem] text-body">Keep NCBO on your home screen</p>
          <div className={`mt-1 ${fineprint}`}>{steps}</div>
          {deferred && (
            <button type="button" onClick={install} className={`${btnGhost} ${btnSmall} mt-3`}>
              Install
            </button>
          )}
        </div>
      </div>
    );
  }

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
            {platform === 'macos-safari'
              ? 'Keep the NCBO App in your Dock.'
              : 'Install the NCBO App to your homescreen for the best experience.'}
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

        <div className={`mt-3 ${fineprint}`}>{steps}</div>

        {deferred && (
          <button type="button" onClick={install} className={`${btnPrimary} ${btnSmall} mt-4`}>
            Install
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * What to actually do, per platform.
 *
 * Named controls in the order the person will meet them, because "add to home
 * screen" is only obvious to somebody who has done it before. The notification
 * line is on the iOS branches on purpose: it is the one platform where
 * installing is a prerequisite rather than a preference, and saying so is what
 * turns a nag into a reason.
 */
function Steps({ platform }) {
  if (platform === 'ios-safari') {
    return (
      <>
        Tap <Control>Share</Control> at the bottom of Safari, then{' '}
        <Control>Add to Home Screen</Control>. It opens full-screen, and it is the only
        way an iPhone can send you notifications.
      </>
    );
  }

  if (platform === 'ios-other') {
    return (
      <>
        Open this page in <Control>Safari</Control>, tap <Control>Share</Control>, then{' '}
        <Control>Add to Home Screen</Control>. iOS only installs from Safari, and only an
        installed copy can send you notifications.
      </>
    );
  }

  if (platform === 'macos-safari') {
    return (
      <>
        In Safari&rsquo;s menu bar, choose <Control>File ▸ Add to Dock</Control>. It opens in
        its own window, without the address bar.
      </>
    );
  }

  return <>It opens full-screen and loads faster, with no address bar in the way.</>;
}

function Control({ children }) {
  return <b className="font-semibold text-body">{children}</b>;
}

/**
 * Which install instructions this browser needs, if any.
 *
 * Pure, and separated from the component for the same reason `navModel` is:
 * every interesting case here is a user-agent string that cannot be reproduced
 * in a test by rendering React, and the one that actually bites — an iPad
 * claiming to be a Mac — is invisible until somebody with an iPad complains.
 *
 * The asymmetry this exists for: **Chrome on Android promotes installation by
 * itself.** It fires `beforeinstallprompt`, shows its own mini-infobar, and
 * carries an "Install app" item in its menu. Safari does none of that and has
 * no API to ask with — on iOS the only route is Share ▸ Add to Home Screen,
 * and if the page does not say so, nothing does. Which is why iPhone members
 * were never offered the app at all, and why they in particular could not
 * receive push: iOS grants the permission only to an installed PWA.
 */

/** Already installed? Then never promote anything. */
export function isStandalone(win = typeof window === 'undefined' ? null : window) {
  if (!win) return false;
  /* `navigator.standalone` is the iOS-only one and the only one iOS sets on an
     added-to-home-screen copy in older versions. Both are checked because
     neither covers every platform on its own. */
  return Boolean(
    win.matchMedia?.('(display-mode: standalone)')?.matches
    || win.navigator?.standalone === true,
  );
}

/**
 * @returns {'ios-safari'|'ios-other'|'macos-safari'|'other'}
 */
export function detectPlatform({ userAgent = '', maxTouchPoints = 0, platform = '' } = {}) {
  const ua = String(userAgent);

  /* An iPad on iPadOS 13+ reports itself as "Macintosh; Intel Mac OS X" with
     Safari's engine string, and is indistinguishable from a desktop Mac by
     user agent alone. Touch points are the discriminator everybody ends up
     using: a Mac reports 0, an iPad reports 5. Without this an iPad gets the
     Add to Dock line, which is not a thing it has. */
  const touchMac = /macintosh/i.test(ua) && Number(maxTouchPoints) > 1;
  const iPhoneish = /iphone|ipad|ipod/i.test(ua) || /^iP(hone|ad|od)/i.test(String(platform));
  const ios = iPhoneish || touchMac;

  /* Every browser on iOS is WebKit and every one of them says "Safari" at the
     end of its user agent, so Safari is what is left after the wrappers are
     excluded. CriOS is Chrome, FxiOS Firefox, EdgiOS Edge, OPT/OPR Opera. */
  const wrapped = /crios|fxios|edgios|opr\/|opt\/|yabrowser|duckduckgo/i.test(ua);
  const chromium = /chrome|chromium|android/i.test(ua);
  const safari = /safari/i.test(ua) && !wrapped && (!chromium || touchMac || iPhoneish);

  if (ios) return safari ? 'ios-safari' : 'ios-other';
  if (/macintosh/i.test(ua) && safari) return 'macos-safari';
  return 'other';
}

/** Does this platform need instructions rather than a button? */
export function needsManualInstall(platform) {
  return platform !== 'other';
}

/**
 * Is a previous dismissal still in force?
 *
 * Time-limited rather than permanent. "Not now" on a phone in a lecture is not
 * "never", and a banner dismissed once in September should be allowed to ask
 * again — otherwise the answer to "why does nobody have the app installed" is
 * a single tap somebody made months ago.
 *
 * A value that will not parse counts as no dismissal: the storage key is
 * two versions old or somebody edited it, and the safe direction is to ask
 * again rather than to go silent forever.
 */
export const DISMISSAL_DAYS = 30;

export function dismissalActive(raw, now = Date.now(), days = DISMISSAL_DAYS) {
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at) || at <= 0) return false;
  return now - at < days * 24 * 60 * 60 * 1000;
}

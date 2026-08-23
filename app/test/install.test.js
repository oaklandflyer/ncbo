import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPlatform, needsManualInstall, dismissalActive, isStandalone,
} from '../src/lib/install.js';

/* Real user agents. Written out rather than fabricated, because every bug this
   module has is a browser that lies about what it is. */
const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.111 Mobile/15E148 Safari/604.1',
  iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15',
  ipadSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
};

test('an iPhone in Safari gets the Share-sheet instructions', () => {
  assert.equal(detectPlatform({ userAgent: UA.iphoneSafari, maxTouchPoints: 5 }), 'ios-safari');
});

test('Chrome and Firefox on iOS are iOS, not Chrome', () => {
  /* Both are WebKit in a wrapper and both end their UA with "Safari". They can
     add to the home screen too, from their own share menus, so they are a
     separate case rather than an unsupported one. */
  assert.equal(detectPlatform({ userAgent: UA.iphoneChrome, maxTouchPoints: 5 }), 'ios-other');
  assert.equal(detectPlatform({ userAgent: UA.iphoneFirefox, maxTouchPoints: 5 }), 'ios-other');
});

test('an iPad claiming to be a Mac is still an iPad', () => {
  /* The bug this whole module exists to make testable: iPadOS 13+ sends a
     desktop user agent, so the only thing separating an iPad from a Mac is
     that a Mac has no touch screen. */
  assert.equal(detectPlatform({ userAgent: UA.ipadSafari, maxTouchPoints: 5 }), 'ios-safari');
  assert.equal(detectPlatform({ userAgent: UA.macSafari, maxTouchPoints: 0 }), 'macos-safari');
});

test('desktop Safari gets Add to Dock, and desktop Chrome gets neither', () => {
  assert.equal(detectPlatform({ userAgent: UA.macSafari, maxTouchPoints: 0 }), 'macos-safari');
  assert.equal(detectPlatform({ userAgent: UA.macChrome, maxTouchPoints: 0 }), 'other');
});

test('Android and Windows fall through to the browser\'s own prompt', () => {
  /* `other` is not "unsupported": it is "the browser promotes this itself",
     which is exactly what Safari never does. */
  assert.equal(detectPlatform({ userAgent: UA.androidChrome, maxTouchPoints: 5 }), 'other');
  assert.equal(detectPlatform({ userAgent: UA.windowsEdge, maxTouchPoints: 0 }), 'other');
});

test('every Safari case needs instructions; nothing else does', () => {
  for (const ua of [UA.iphoneSafari, UA.iphoneChrome, UA.macSafari]) {
    const platform = detectPlatform({ userAgent: ua, maxTouchPoints: ua === UA.macSafari ? 0 : 5 });
    assert.equal(needsManualInstall(platform), true, ua);
  }
  assert.equal(needsManualInstall(detectPlatform({ userAgent: UA.androidChrome })), false);
});

test('an empty or unknown user agent is treated as an ordinary browser', () => {
  assert.equal(detectPlatform(), 'other');
  assert.equal(detectPlatform({ userAgent: '', maxTouchPoints: 0 }), 'other');
});

test('a dismissal lapses after thirty days, and junk counts as none', () => {
  const now = Date.UTC(2026, 7, 23);
  const day = 24 * 60 * 60 * 1000;

  assert.equal(dismissalActive(String(now - day), now), true);
  assert.equal(dismissalActive(String(now - 31 * day), now), false);
  /* "1" is what the old code wrote, and it must not read as a dismissal made
     in 1970 — nor as one that never expires. */
  assert.equal(dismissalActive('1', now), false);
  assert.equal(dismissalActive('not-a-date', now), false);
  assert.equal(dismissalActive(null, now), false);
});

test('an installed copy is never promoted, by either signal', () => {
  const installed = { matchMedia: () => ({ matches: true }), navigator: {} };
  const iosInstalled = { matchMedia: () => ({ matches: false }), navigator: { standalone: true } };
  const browser = { matchMedia: () => ({ matches: false }), navigator: { standalone: false } };

  assert.equal(isStandalone(installed), true);
  assert.equal(isStandalone(iosInstalled), true);
  assert.equal(isStandalone(browser), false);
  /* Server-side, where there is no window at all. */
  assert.equal(isStandalone(null), false);
});

/**
 * The theme preference, as three pure functions.
 *
 * Pure and separate from React on purpose: the same rules run in three places
 * that share no runtime — a blocking script in the document head, a client
 * provider, and `test/theme.test.js`. Anything that decided "is it dark" in
 * only one of those would eventually disagree with the other two, and a
 * disagreement here is the flash of the wrong theme on every page load.
 */

/** Where the preference lives. Versioned like the workout store's key. */
export const THEME_KEY = 'ncbo.theme.v1';

/** What a person can choose. `system` follows the OS and is the default. */
export const THEMES = ['light', 'dark', 'system'];

/** Anything unrecognised — a cleared key, a hand-edited value — is `system`. */
export function normaliseTheme(value) {
  return THEMES.includes(value) ? value : 'system';
}

/**
 * The preference plus what the OS says, resolved to what to actually paint.
 *
 * @param {string}  preference  'light' | 'dark' | 'system'
 * @param {boolean} systemDark  matchMedia('(prefers-color-scheme: dark)')
 * @returns {'light'|'dark'}
 */
export function resolveTheme(preference, systemDark) {
  const pref = normaliseTheme(preference);
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

/**
 * Put the resolved theme on the document.
 *
 * The class is what Tailwind's `dark:` variant reads; `colorScheme` is what
 * the browser reads for form controls, scrollbars and overscroll. Setting one
 * without the other gives a dark page with a white scrollbar.
 */
export function applyTheme(documentElement, resolved) {
  if (!documentElement) return;
  documentElement.classList.toggle('dark', resolved === 'dark');
  documentElement.style.colorScheme = resolved;
}

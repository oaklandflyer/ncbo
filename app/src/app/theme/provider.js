'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { THEME_KEY, applyTheme, normaliseTheme, resolveTheme } from '@/lib/theme';

/**
 * The theme, for the parts of the app that let somebody change it.
 *
 * A context rather than `next-themes` because the whole of it is forty lines
 * and the interesting half — not flashing — is the inline script in the head,
 * which any library would have made us think about anyway.
 *
 * The state starts at `system` on both the server and the first client render,
 * and only then reads localStorage in an effect. That ordering is the point:
 * initialising from storage would make the first client render disagree with
 * the server's HTML, which is a hydration error. The document is already
 * showing the right colours by then — the script saw to that before paint —
 * so this is only catching React up with what the DOM already says.
 */
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState('system');
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(query.matches);

    let stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      /* Storage can be unavailable — private mode, blocked cookies. The theme
         then works for this page load and is forgotten, which is fine. */
    }
    setPreference(normaliseTheme(stored));
    setReady(true);

    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  /* Skipped until the storage read has happened. Without the guard this runs
     once with the default `system` and would overwrite a stored `light` on a
     dark-preferring device for one frame. */
  useEffect(() => {
    if (!ready) return;
    applyTheme(document.documentElement, resolveTheme(preference, systemDark));
  }, [preference, systemDark, ready]);

  const setTheme = useCallback((next) => {
    const value = normaliseTheme(next);
    setPreference(value);
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {
      /* See above. Not being able to remember it is not a reason to refuse. */
    }
  }, []);

  const value = useMemo(() => ({
    preference,
    resolved: resolveTheme(preference, systemDark),
    setTheme,
    ready,
  }), [preference, systemDark, setTheme, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * @returns {{preference: string, resolved: 'light'|'dark', setTheme: Function, ready: boolean}}
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  /* A safe default rather than a throw: a control rendered outside the
     provider should be inert, not take the page down. */
  return ctx || { preference: 'system', resolved: 'light', setTheme: () => {}, ready: false };
}

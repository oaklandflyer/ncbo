import { THEME_KEY } from '@/lib/theme';

/**
 * The anti-flash script.
 *
 * It runs before the browser paints anything, so the first frame is already
 * the right theme. Everything else about the theme is React, and React is too
 * late: the server has no idea what this device prefers, so markup rendered
 * without this arrives light, paints, and then flips — which is worse on a
 * phone in a dark room than having no dark mode at all.
 *
 * Deliberately tiny and deliberately duplicated from `@/lib/theme`. It cannot
 * import at this point in the document, and a try/catch around the whole thing
 * matters: `localStorage` throws outright in a locked-down browser, and an
 * uncaught throw here would take the page's first script with it.
 */
const SOURCE = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});
var d=p==='dark'||((p==='system'||!p)&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark',d);
document.documentElement.style.colorScheme=d?'dark':'light';
}catch(e){}})();`;

export default function ThemeScript() {
  /* `beforeInteractive` from next/script is for third-party code and is not
     allowed outside the root layout's <head>; a plain inline tag is the
     documented way to do exactly this and it is what next-themes emits too.
     The markup is a constant defined above — no input reaches it. */
  return <script dangerouslySetInnerHTML={{ __html: SOURCE }} />;
}

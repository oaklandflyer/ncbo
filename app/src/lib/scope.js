/**
 * Which club a `/club/*` screen is about.
 *
 * A lead has exactly one answer and never sees a chooser. An admin supports
 * every chapter, so they get a switcher in the header and the same screens —
 * rather than a parallel set of admin-only pages that would drift from the
 * ones leads actually use, and would be the copy nobody tests.
 */
export function resolveClubScope(viewer, requested) {
  const led = viewer?.ledClubIds || [];

  if (viewer?.isAdmin) {
    /* An admin may ask for any club. An unrecognised or absent id falls back
       to a club they lead, then to nothing — never to "the first club in the
       table", which would silently put somebody on a page about a chapter
       they did not choose. */
    return {
      clubId: requested || led[0] || null,
      canSwitch: true,
      reason: requested ? 'requested' : (led[0] ? 'own' : 'none'),
    };
  }

  if (!requested || led.includes(requested)) {
    return { clubId: requested || led[0] || null, canSwitch: false, reason: led.length ? 'own' : 'none' };
  }

  /* A lead asking for somebody else's club gets their own, not an error page.
     The request is almost always a stale link rather than an attack, and the
     database refuses the data either way. */
  return { clubId: led[0] || null, canSwitch: false, reason: 'denied' };
}

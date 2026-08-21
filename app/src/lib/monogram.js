/**
 * A chapter's initials, for when it has no logo.
 *
 * Its own module, with no JSX in it, for the same reason `navModel` is: this
 * is the branch every chapter takes today, and it is worth a test that runs
 * under plain `node --test` rather than one that needs a renderer.
 *
 * The one hard requirement is that it never returns nothing. An empty box in
 * a leaderboard reads as a broken image, not as a chapter that has not
 * uploaded anything yet.
 */

/** Whichever club field the caller happens to hold, chapter name first. */
export function clubLabel(club) {
  return club?.chapter || club?.shortName || club?.short_name
      || club?.name || club?.club_name || '';
}

export function monogram(club) {
  const letters = String(clubLabel(club))
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return letters || 'NC';
}

/**
 * Somebody's initials, up to two letters.
 *
 * The same eight lines were copy-pasted into four components. Here it is once,
 * beside `monogram`, testable without a renderer, with the same guarantee: it
 * never returns an empty string, because a blank circle reads as a broken
 * avatar rather than as a person.
 */
export function initials(name) {
  const letters = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return letters || 'M';
}

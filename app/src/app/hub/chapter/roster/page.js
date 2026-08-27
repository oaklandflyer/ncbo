import { redirect } from 'next/navigation';

/**
 * The chapter roster lives at `/club/roster`.
 *
 * A redirect rather than a second screen. This app already learned that
 * lesson: `/hub/roster` redirects here too, and the roster page itself carries
 * the note explaining why — "an admin-only copy of this screen is how two
 * rosters come to exist, and the one leads actually use is never the one that
 * gets fixed." Building a third would have split the club-lead controls across
 * two pages, and the bug reports would have arrived against whichever one the
 * fixes had not landed on.
 *
 * The path is kept because it is the one this work was specified against, and
 * because it reads better than the route it points at. Every link to it works.
 */
export default function ChapterRoster() {
  redirect('/club/roster');
}

import { redirect } from 'next/navigation';

/**
 * Moved to `/club/applications`.
 *
 * This route used to *be* the membership queue, and for one release it
 * redirected to `/club/entries` — the results queue — which quietly took the
 * approval screen off the app entirely. Pointing it at the queue it was named
 * for keeps every link a lead was ever sent working.
 *
 * `?club=` is carried across rather than dropped: an admin's link to one
 * chapter's queue is mostly that parameter, and a redirect that loses it lands
 * them on whichever chapter the switcher last remembered.
 */
export default async function MovedPage({ searchParams }) {
  const params = await searchParams;
  const club = params?.club;
  redirect(club ? `/club/applications?club=${encodeURIComponent(club)}` : '/club/applications');
}

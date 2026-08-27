'use server';

import { loadPublicProfile as read } from './read';

/**
 * The profile popup's read, as a server action.
 *
 * The implementation lives in `./read.js` so the full profile page — a Server
 * Component — can call it directly instead of going through an action. This
 * file is the client-callable door onto the same function, for the popup.
 */
export async function loadPublicProfile(userId) {
  return read(userId);
}

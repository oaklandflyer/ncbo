import { redirect } from 'next/navigation';

/**
 * Moved to `/club/entries`.
 *
 * A redirect rather than a deletion: every link anyone saved, every message a
 * lead sent, and every bookmark still works. Costs one file and removes a
 * whole class of "it 404s for me" support.
 */
export default function MovedPage() {
  redirect('/club/entries');
}

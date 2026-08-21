import { redirect } from 'next/navigation';

/**
 * Moved to `/rankings/athletes`.
 *
 * A redirect rather than a deletion: every link anyone saved, every message a
 * lead sent, and every bookmark still works.
 */
export default function MovedPage() {
  redirect('/rankings/athletes');
}

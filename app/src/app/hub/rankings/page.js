import { redirect } from 'next/navigation';

/**
 * Moved to `/rankings/clubs`.
 *
 * A redirect rather than a deletion: every link anyone saved, every message a
 * lead sent, and every bookmark still works.
 *
 * It landed on `/rankings/athletes` until beta said the app over-emphasised
 * individuals. "Rankings", unqualified, now means the Chapter Cup — which is
 * the competition NCBO actually runs — and the athlete table is one tap away
 * on the control at the top of it.
 */
export default function MovedPage() {
  redirect('/rankings/clubs');
}

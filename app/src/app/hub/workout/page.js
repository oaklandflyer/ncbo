import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import WorkoutScreen from './screen';

export const metadata = { title: 'Workout · NCBO' };

/**
 * The workout tracker, dark launched.
 *
 * Admin-only for now, and checked here as well as in `navModel`. The nav gate
 * hides the door; this one locks it. A dark launch that only removes the link
 * is a feature anybody can reach by typing the path, which is fine for a
 * harmless screen and not a habit worth forming.
 *
 * A Server Component that renders a client one: the catalogue is a database
 * read and belongs here, the live workout is browser state and belongs there.
 */
export default async function WorkoutPage() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);

  if (!viewer.signedIn) redirect('/login');
  if (!viewer.profile) return null;
  if (!viewer.isAdmin) redirect('/hub');

  /* Fetched once and handed down rather than searched per keystroke: it is a
     few dozen rows, it changes rarely, and a round trip per character on gym
     wifi is the difference between a picker and a wait. */
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, muscle_group')
    .order('muscle_group')
    .order('name');

  return (
    /* Full-bleed black, breaking out of the hub's light ground on purpose.
       This is the one screen used with the phone in one hand under gym
       lighting, and the surrounding card-and-hairline chrome is width and
       brightness it cannot spare. The shell's own bars stay put; everything
       below them is the tracker. */
    <div className="min-h-[calc(100vh-60px)] bg-zinc-950 font-body text-[0.95rem] leading-normal text-zinc-100 antialiased">
      <div className="mx-auto w-full max-w-[640px] px-3 pb-24 pt-3 sm:px-5">
        <WorkoutScreen catalogue={exercises || []} />
      </div>
    </div>
  );
}

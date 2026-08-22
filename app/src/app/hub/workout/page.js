import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section } from '@/app/ui';
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
    <Page>
      <PageHero
        eyebrow="Training"
        title="Workout."
        lead="Log what you actually did, set by set. Nobody else can see it, not your lead and not an admin."
      />
      <Section>
        <WorkoutScreen catalogue={exercises || []} />
      </Section>
    </Page>
  );
}

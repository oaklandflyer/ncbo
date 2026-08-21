import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { resolveClubScope } from '@/lib/scope';
import { Page, PageHero, Section, Empty } from '@/app/ui';
import CalendarSettings from './settings';

export const metadata = { title: 'Calendar setup · NCBO' };

export default async function ClubCalendarSettings({ searchParams }) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn) redirect('/login');
  if (!viewer.profile) return null;
  if (!viewer.isClubLead && !viewer.isAdmin) redirect('/hub');

  const params = await searchParams;
  const scope = resolveClubScope(viewer, params?.club);
  if (!scope.clubId) {
    return (
      <Page>
        <PageHero eyebrow="Club lead" title="Calendar setup." />
        <Section><Empty>Pick a chapter from the switcher.</Empty></Section>
      </Page>
    );
  }

  const { data: club } = await supabase
    .from('clubs').select('id, name, gcal_id, gcal_timezone, gcal_published')
    .eq('id', scope.clubId).maybeSingle();

  return (
    <Page>
      <PageHero
        eyebrow="Club lead"
        title="Calendar setup."
        lead="Point the app at the Google Calendar your chapter already keeps. Members see it read-only, so there is nothing to maintain twice."
      />
      <Section>
        {club ? <CalendarSettings club={club} /> : <Empty>That chapter could not be loaded.</Empty>}
      </Section>
    </Page>
  );
}

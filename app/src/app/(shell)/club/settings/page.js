import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { resolveClubScope } from '@/lib/scope';
import { Page, PageHero, Section, SectionTitle, Meta, Empty } from '@/app/ui';
import ClubLogoForm from './logo-form';
import CalendarSettings from './settings';

export const metadata = { title: 'Club settings · NCBO' };

/**
 * Everything a lead configures about their chapter, on one screen.
 *
 * This was `/club/calendar`, which named the only thing on it. A second thing
 * arrived, so the page is named for what it is and the old URL redirects
 * permanently from `next.config.mjs`.
 *
 * A Server Component: it reads the club and hands it to two forms, and the
 * only client code on the page is the state those two forms genuinely need.
 */
export default async function ClubSettings({ searchParams }) {
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
        <PageHero eyebrow="Club lead" title="Club settings." />
        <Section><Empty>Pick a chapter from the switcher.</Empty></Section>
      </Page>
    );
  }

  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, logo_url, gcal_id, gcal_timezone, gcal_published')
    .eq('id', scope.clubId).maybeSingle();

  if (!club) {
    return (
      <Page>
        <PageHero eyebrow="Club lead" title="Club settings." />
        <Section><Empty>That chapter could not be loaded.</Empty></Section>
      </Page>
    );
  }

  return (
    <Page>
      <PageHero
        eyebrow="Club lead"
        title="Club settings."
        lead="How your chapter appears across the app, and where its schedule comes from."
      />

      <Section>
        <ClubLogoForm club={club} />
      </Section>

      {/* Beneath the logo rather than above it: the logo is a one-off a lead
          does once, and the calendar is the thing they come back to. */}
      <Section>
        <SectionTitle>Calendar</SectionTitle>
        <Meta className="-mt-3 mb-6 max-w-[620px]">
          Point the app at the Google Calendar your chapter already keeps. Members see it
          read-only, so there is nothing to maintain twice.
        </Meta>
        <CalendarSettings club={club} />
      </Section>
    </Page>
  );
}

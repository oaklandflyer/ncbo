import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { resolveClubScope } from '@/lib/scope';
import { Page, PageHero, Section, SectionTitle, Meta, Empty } from '@/app/ui';
import ClubLogoForm from './logo-form';
import CalendarSettings from './settings';
import ChapterLeadsForm from './leads-form';

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

  /* The lead entries alongside the club. A failure costs the panel, never the
     page: the RPC refuses anybody who does not lead this chapter, and an admin
     arriving via `?club=` on a chapter they do not lead is a legitimate reader
     that `is_admin()` lets through. */
  const [{ data: club }, { data: leadEntries, error: leadError }] = await Promise.all([
    supabase
      .from('clubs')
      .select('id, name, logo_url, gcal_id, gcal_timezone, gcal_published')
      .eq('id', scope.clubId).maybeSingle(),
    supabase.rpc('get_club_lead_entries', { target_club: scope.clubId }),
  ]);

  if (leadError) {
    console.error('[ncbo] club lead entries failed', {
      code: leadError.code, message: leadError.message,
    });
  }

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

      {/* Above the calendar, because this is the one somebody arrives here to
          fix: the "Led by …" line on the Network directory is the most public
          thing a chapter says about itself, and it has been naming people who
          were never on the app. */}
      <Section>
        <SectionTitle count={leadEntries?.length || null}>Chapter leads</SectionTitle>
        <Meta className="-mt-3 mb-6 max-w-[620px]">
          The names members see under your chapter on the Network tab. Only entries with a
          live account are shown there — add a lead by promoting them from your roster.
        </Meta>
        <ChapterLeadsForm
          clubId={scope.clubId}
          entries={leadEntries || []}
          isAdmin={viewer.isAdmin}
        />
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

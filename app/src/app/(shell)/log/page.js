import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { affiliationLabel } from '@/lib/membership';
import { Page, PageHero, Section, Empty } from '@/app/ui';
import LogForm from './form';

export const metadata = { title: 'Log a result · NCBO' };

/**
 * A route, not a modal.
 *
 * Logging a result is a form with eight fields and a member search, which on a
 * phone deserves the whole screen. A modal also cannot be linked to, and the
 * commonest way this gets opened is a lead sending "log it here" in a group
 * chat.
 */
export default async function LogPage() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn) redirect('/login');
  if (!viewer.profile) return null;

  const membership = viewer.membership;
  const chapter = membership
    ? affiliationLabel({ university_short_name: membership.shortName })
    : null;

  return (
    <Page>
      <PageHero
        eyebrow="Competition log"
        title="Log a result."
        lead="Everything you enter goes to your club lead to verify. You can share the card before they get to it."
      />
      <Section>
        {membership ? (
          <LogForm clubId={membership.clubId} chapter={chapter} />
        ) : (
          <Empty>
            You are not on a chapter roster yet, and a result has to score for somebody. Apply to
            your chapter from your profile first.
          </Empty>
        )}
      </Section>
    </Page>
  );
}

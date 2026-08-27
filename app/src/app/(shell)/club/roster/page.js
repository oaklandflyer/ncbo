import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { resolveClubScope } from '@/lib/scope';
import { Page, PageHero, Section, SectionTitle, Empty } from '@/app/ui';
import RosterTable from '@/app/hub/roster/roster-table';

export const metadata = { title: 'Roster · NCBO' };

/**
 * The chapter roster, scoped by the switcher for admins.
 *
 * Reuses the existing roster table rather than growing a second one. An
 * admin-only copy of this screen is how two rosters come to exist, and the one
 * leads actually use is never the one that gets fixed.
 */
export default async function ClubRoster({ searchParams }) {
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
        <PageHero eyebrow="Club lead" title="Roster." />
        <Section><Empty>Pick a chapter from the switcher.</Empty></Section>
      </Page>
    );
  }

  const [{ data: members, error }, { data: club }] = await Promise.all([
    supabase.rpc('get_club_roster', { target_club: scope.clubId }),
    supabase.from('club_directory').select('club_name, short_name, approver_count').eq('id', scope.clubId).maybeSingle(),
  ]);

  const chapter = club?.short_name || club?.club_name || 'this chapter';

  return (
    <Page>
      <PageHero
        eyebrow={viewer.isAdmin && !viewer.ledClubIds.includes(scope.clubId) ? 'Admin view' : 'Club lead'}
        title={`${chapter} roster.`}
        lead="Your members and their addresses, and the controls to manage who is on this roster. Visible to you and to NCBO admins only, never to other members."
      />
      <Section>
        <SectionTitle count={members?.length || null}>Members</SectionTitle>
        {error ? (
          <Empty>That roster is not yours to open.</Empty>
        ) : members?.length ? (
          <RosterTable members={members} canPromote viewerId={viewer.userId} />
        ) : (
          <Empty>Nobody on this roster yet.</Empty>
        )}
      </Section>
    </Page>
  );
}

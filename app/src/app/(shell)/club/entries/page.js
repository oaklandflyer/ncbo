import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { resolveClubScope } from '@/lib/scope';
import { Page, PageHero, Section, SectionTitle, Empty } from '@/app/ui';
import { ShowGroup } from './queue';

export const metadata = { title: 'Verify results · NCBO' };

/**
 * The verification queue, standing on its own.
 *
 * A peer of the roster rather than a tab inside it: this is the screen a lead
 * opens with a purpose, usually from a badge, and burying it one level down is
 * how a queue goes unworked for a fortnight.
 */
export default async function ClubEntries({ searchParams }) {
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
        <PageHero eyebrow="Club lead" title="Verify results." />
        <Section><Empty>Pick a chapter from the switcher to see its queue.</Empty></Section>
      </Page>
    );
  }

  const [{ data: rows }, { data: club }] = await Promise.all([
    supabase.from('competition_entries')
      .select('id, show_name, division, class, placing, won_overall, date, profiles!competition_entries_profile_id_fkey(display_name), competition_handlers(entry_id)')
      .eq('club_id', scope.clubId)
      .eq('status', 'pending')
      .order('date', { ascending: false }),
    supabase.from('club_directory').select('club_name, short_name').eq('id', scope.clubId).maybeSingle(),
  ]);

  /* Grouped by show, because a lead verifies a whole show at once: they were
     there, or they have the results page open, and going show by show is how
     the job is actually done. */
  const groups = new Map();
  for (const r of rows || []) {
    if (!groups.has(r.show_name)) groups.set(r.show_name, []);
    groups.get(r.show_name).push({
      id: r.id,
      athlete: r.profiles?.display_name || 'A member',
      division: r.division,
      class: r.class,
      placing: r.placing,
      won_overall: r.won_overall,
      handlers: (r.competition_handlers || []).length,
    });
  }

  const chapter = club?.short_name || club?.club_name || 'your chapter';
  const waiting = rows?.length || 0;

  return (
    <Page>
      <PageHero
        eyebrow={viewer.isAdmin && !viewer.ledClubIds.includes(scope.clubId) ? 'Admin view' : 'Club lead'}
        title={`${chapter} results.`}
        lead={
          waiting
            ? 'Nothing here scores until you approve it. Sending one back needs a reason, because that reason is the only feedback the athlete gets.'
            : 'Nothing waiting. New results land here when your members log them.'
        }
      />
      <Section>
        <SectionTitle count={waiting ? `${waiting} waiting` : null}>Pending</SectionTitle>
        {waiting === 0 ? (
          <Empty>No results waiting at {chapter}.</Empty>
        ) : (
          <ul className="grid list-none gap-4">
            {[...groups.entries()].map(([show, entries]) => (
              <li key={show}><ShowGroup show={show} clubId={scope.clubId} entries={entries} /></li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}

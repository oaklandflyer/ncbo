import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section, SectionTitle, Empty, Card, Meta, Badge, btnGhost, btnSmall, fineprint } from '@/app/ui';
import ApplicationCard from './card';

export const metadata = { title: 'Applications · NCBO' };

/**
 * The club lead's approval queue.
 *
 * This replaces the admin queue, and the change is not cosmetic. The person
 * who can tell whether a name belongs at Pitt is at Pitt; an admin scanning a
 * list of nine schools cannot, and being the fallback approver is what made
 * the old queue back up in exactly the weeks it mattered.
 *
 * An admin can still open any club's queue from here, for support. They are
 * deliberately not notified about any of them.
 */
export default async function ClubQueue({ searchParams }) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.profile) redirect('/login');

  if (!viewer.isClubLead && !viewer.isAdmin) redirect('/hub');

  const params = await searchParams;

  /* A lead sees the clubs they lead; an admin picks from all of them. */
  let options = viewer.ledClubs;
  if (viewer.isAdmin) {
    const { data } = await supabase
      .from('club_directory')
      .select('id, club_name, short_name, pending_count, approver_count')
      .order('short_name');
    options = (data || []).map((c) => ({
      id: c.id,
      name: c.club_name,
      shortName: c.short_name,
      pending: c.pending_count,
      approvers: c.approver_count,
    }));
  }

  const clubId = params?.club || options[0]?.id || null;

  if (!clubId) {
    return (
      <Page>
        <PageHero eyebrow="Club lead" title="Applications." />
        <Section>
          <Empty>
            You do not lead a club yet. An NCBO admin appoints club leads, and a lead can
            name co-leads from their own roster.
          </Empty>
        </Section>
      </Page>
    );
  }

  /* Escalation is idempotent and cheap, so it runs on the queue render rather
     than waiting for a scheduler this project does not have yet. A lead
     opening the page is also the moment the count is about to be looked at. */
  await supabase.rpc('escalate_stale_applications');

  const [{ data: applications, error }, { data: club }] = await Promise.all([
    supabase.rpc('get_club_queue', { target_club: clubId }),
    supabase
      .from('club_directory')
      .select('id, club_name, short_name, member_count, approver_count')
      .eq('id', clubId)
      .maybeSingle(),
  ]);

  const chapter = club?.short_name || club?.club_name || 'your chapter';
  const waiting = applications?.length || 0;

  return (
    <Page>
      <PageHero
        eyebrow={viewer.isAdmin && !viewer.ledClubIds.includes(clubId) ? 'Admin view' : 'Club lead'}
        title={`${chapter} applications.`}
        lead={
          waiting
            ? 'Everything they told us at signup is on the card. Approve, deny, or ask them something before you decide.'
            : 'Nobody is waiting right now. New applications land here, and you get one summary a day rather than a ping each time.'
        }
        actions={
          <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/roster">
            Open roster
          </Link>
        }
      />

      {/* The warning that matters most, and the one a lead will not think to
          look for. Leadership turns over in May and December; a chapter that
          drops to one approver freezes every new signup the moment that person
          graduates. */}
      {club && club.approver_count <= 1 && (
        <Section>
          <Card className="border-l-[3px] border-l-danger p-5">
            <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.03em] text-ink">
              This club has one approver
            </p>
            <p className="mt-2 text-[0.95rem] text-body">
              That is you. When you graduate or hand over, nobody can approve a new member
              at {chapter} until an admin appoints someone. Name a co-lead from your roster
              now, while it costs you one click.
            </p>
            <Link className={`${btnGhost} ${btnSmall} mt-4 inline-block bg-surface`} href="/hub/roster">
              Name a co-lead
            </Link>
          </Card>
        </Section>
      )}

      {viewer.isAdmin && options.length > 1 && (
        <Section band>
          <SectionTitle>Every chapter</SectionTitle>
          <p className={`mb-4 max-w-[620px] ${fineprint}`}>
            You can open any queue for support. You are not the default approver for any of
            them and you are not notified about them, on purpose: the lead who knows the
            applicant is the one who should decide.
          </p>
          <ul className="flex list-none flex-wrap gap-2">
            {options.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/hub/club/queue?club=${c.id}`}
                  className={`${btnGhost} ${btnSmall} ${c.id === clubId ? 'bg-brand-wash' : 'bg-surface'}`}
                >
                  {c.shortName || c.name}
                  {c.pending > 0 && ` · ${c.pending}`}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section>
        <SectionTitle count={waiting ? `${waiting} waiting` : null}>
          Waiting for you
        </SectionTitle>

        {error && (
          <Empty>
            That queue is not yours to open. If you think it should be, ask an NCBO admin.
          </Empty>
        )}

        {!error && waiting === 0 && (
          <Empty>Nobody is waiting at {chapter} right now.</Empty>
        )}

        {!error && waiting > 0 && (
          <ul className="grid list-none gap-4">
            {applications.map((a) => (
              <li key={a.membership_id}>
                <ApplicationCard application={a} clubId={clubId} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}

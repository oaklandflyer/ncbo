import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { resolveClubScope } from '@/lib/scope';
import { isDefaultApproverFor } from '@/lib/review';
import {
  Page, PageHero, Section, SectionTitle, Empty, Card, Badge, Meta,
  btnGhost, btnSmall, fineprint,
} from '@/app/ui';
import ApplicationCard from './card';

export const metadata = { title: 'Applications · NCBO' };

/**
 * The membership queue, back on a screen of its own.
 *
 * It had one at `/hub/club/queue` until the nav rebuild pointed that route at
 * `/club/entries`, which verifies *results*. The two queues are not the same
 * queue, and for the stretch they shared a route the membership one could not
 * be reached at all: applications arrived `pending`, nothing rendered them,
 * and every applicant sat in the Network under "No club yet" — which reads
 * `active_memberships` and so shows exactly the people nobody had approved.
 *
 * A peer of the roster and the results queue, scoped the same way: a lead sees
 * their chapter, an admin sees any chapter through the switcher, and the
 * database refuses anything either of them is not entitled to.
 */
export default async function ClubApplications({ searchParams }) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn) redirect('/login');
  if (!viewer.profile) return null;
  if (!viewer.isClubLead && !viewer.isAdmin) redirect('/hub');

  const params = await searchParams;
  const scope = resolveClubScope(viewer, params?.club);

  /* Every chapter with somebody waiting, scoped to what this viewer may act
     on. A lead has one and rarely looks at it; an admin has the whole list,
     and it is the only way to find a chapter with no lead of its own — the
     case where an admin is the sole possible approver and nobody would think
     to switch to it. */
  const { data: elsewhere } = await supabase.rpc('pending_applications_by_club');
  const waitingElsewhere = (elsewhere || []).filter((c) => c.club_id !== scope.clubId);

  if (!scope.clubId) {
    return (
      <Page>
        <PageHero
          eyebrow={viewer.isAdmin ? 'Admin' : 'Club lead'}
          title="Applications."
          lead="Pick a chapter from the switcher, or open one of the queues below."
        />
        <Section>
          <SectionTitle count={waitingElsewhere.length || null}>Waiting</SectionTitle>
          <ChapterQueues chapters={waitingElsewhere} />
        </Section>
      </Page>
    );
  }

  /* Idempotent, and cheap enough to run on a render: anything pending past 72
     hours moves to the co-lead, past 144 to Club Relations. Written to be
     called from a scheduler as well; there isn't one yet, and a queue that
     only escalates when somebody opens it still escalates. */
  await supabase.rpc('escalate_stale_applications');

  const [{ data: applications, error }, { data: club }] = await Promise.all([
    supabase.rpc('get_club_queue', { target_club: scope.clubId }),
    supabase.from('club_directory')
      .select('club_name, short_name, approver_count').eq('id', scope.clubId).maybeSingle(),
  ]);

  const chapter = club?.short_name || club?.club_name || 'this chapter';
  const waiting = applications?.length || 0;
  const mine = isDefaultApproverFor(viewer, scope.clubId);

  return (
    <Page>
      <PageHero
        eyebrow={mine ? 'Club lead' : 'Admin view'}
        title={`${chapter} applications.`}
        lead={
          waiting
            ? 'Until one of these is approved there is no membership, so they are on no roster and appear in the Network with no chapter at all.'
            : 'Nobody waiting. New signups at this chapter land here.'
        }
      />

      <Section>
        <SectionTitle count={waiting ? `${waiting} waiting` : null}>Pending</SectionTitle>

        {/* The single-approver warning 0016 asks for. A chapter down to one
            approver is a chapter one graduation away from a queue nobody can
            work, which is the state this whole screen exists to end. */}
        {club?.approver_count === 1 && (
          <Card className="mb-4 p-5">
            <p className={fineprint}>
              One person can act on this queue. Name a co-lead from the roster before
              the term turns over, or these applications stop being decided by anybody.
            </p>
          </Card>
        )}

        {error ? (
          <Empty>That queue is not yours to open.</Empty>
        ) : waiting === 0 ? (
          <Empty>No applications waiting at {chapter}.</Empty>
        ) : (
          <ul className="grid list-none gap-4">
            {(applications || []).map((a) => (
              <li key={a.membership_id}>
                <ApplicationCard application={a} clubId={scope.clubId} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {waitingElsewhere.length > 0 && (
        <Section band>
          <SectionTitle count={waitingElsewhere.length}>Other chapters waiting</SectionTitle>
          <ChapterQueues chapters={waitingElsewhere} />
        </Section>
      )}
    </Page>
  );
}

/**
 * The chapters with somebody waiting, as links that carry `?club=`.
 *
 * The same parameter the switcher writes, so opening one from here and picking
 * it from the switcher land on the identical screen rather than two.
 */
function ChapterQueues({ chapters }) {
  if (!chapters.length) return <Empty>No applications waiting anywhere you can act.</Empty>;

  return (
    <ul className="grid list-none gap-3">
      {chapters.map((c) => (
        <li key={c.club_id}>
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="font-display text-[1.05rem] font-bold uppercase tracking-[0.02em] text-ink">
                {c.short_name || c.club_name}
              </p>
              <Meta className="mt-1">
                <span>{c.pending} waiting</span>
                {c.escalated > 0 && <Badge tone="forming">{c.escalated} escalated</Badge>}
                {/* Nobody at the chapter can approve these. It is the only row
                    on this list where an admin is not a courtesy. */}
                {c.approver_count === 0 && <Badge tone="pending">No lead yet</Badge>}
              </Meta>
            </div>
            <Link className={`${btnGhost} ${btnSmall}`} href={`/club/applications?club=${c.club_id}`}>
              Open
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}

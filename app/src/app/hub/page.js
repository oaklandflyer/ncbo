import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { canReview } from '@/lib/review';
import { affiliationLabel } from '@/lib/membership';
import { getViewerContext } from '@/lib/viewer';
import {
  Page, PageHero, Section, SectionTitle, DarkTile,
  Stat, Stats, Badge, Empty, Meta, btnGhost, btnSmall,
} from '@/app/ui';

/**
 * Club home — where a member lands after signing in.
 *
 * Their own club first, the league second. Members without a club (staff, or
 * a student whose school has no club yet) get the league view only.
 */
export default async function Hub() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  const profile = viewer.profile;

  // The layout redirects too, but layouts and pages render in parallel — this
  // page still runs, and would crash on profile.role before the layout's
  // redirect lands. Fail closed here as well.
  if (!profile) redirect('/login');

  const canAnswer = viewer.canModerateContent;
  const membership = viewer.membership;

  const [clubmates, openQuestions, pendingCount] = await Promise.all([
    /* The roster audit, on the busiest screen in the app. This used to read
       `profiles.club_id`, which is how an admin or a coaching advisor ended up
       counted as a clubmate. It reads `member_directory` now, whose club comes
       from an active membership and from nothing else. */
    membership?.clubId
      ? supabase.from('member_directory')
          .select('id, display_name, club_role, division, is_alumni, alumni_since, member_verified')
          .eq('club_id', membership.clubId)
          .order('display_name')
      : Promise.resolve({ data: null }),
    canAnswer
      ? supabase.from('question_feed').select('id', { count: 'exact', head: true }).eq('answered', false)
      : Promise.resolve({ count: 0 }),
    /* Applications waiting on this person, club-scoped. An admin is not the
       default approver for anybody's queue, so this is empty for them unless
       they also lead a club — which is the point. */
    viewer.isClubLead
      ? supabase.from('club_memberships').select('id', { count: 'exact', head: true })
          .eq('status', 'pending').in('club_id', viewer.ledClubIds)
      : Promise.resolve({ count: 0 }),
  ]);

  const roster = clubmates.data || [];
  const roleLabel = (role) => (
    { club_lead: 'Club lead', co_lead: 'Co-lead' }[role] || 'Member'
  );
  const firstName = String(profile.display_name || 'member').split(/\s+/)[0];

  return (
    <Page>
      <PageHero
        eyebrow={membership ? affiliationLabel({ university_short_name: membership.shortName }) : 'NCBO'}
        title={membership?.clubName || `Welcome back, ${firstName}.`}
        lead={
          membership?.clubName
            ? 'Your chapter, then the league. Everything the network is talking about is a click away.'
            : viewer.pendingMembership
              ? 'Your application is with your club lead. The league board is open to you in the meantime.'
              : 'You are not at a chapter yet. The league board, the club directory and the Q&A board are open to you all the same.'
        }
        actions={
          canReview(viewer) && pendingCount.count > 0 ? (
            <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/club/queue">
              {pendingCount.count} waiting
            </Link>
          ) : null
        }
      >
        {/* The site's stat treatment: a steel rule, a display numeral, a small
            label. Only facts we actually have — no zero-filled dashboard. */}
        {(roster.length > 0 || pendingCount.count > 0 || openQuestions.count > 0) && (
          <div className="mt-9 max-w-2xl">
            <Stats>
              {roster.length > 0 && (
                <Stat value={roster.length} label={roster.length === 1 ? 'Club member' : 'Club members'} />
              )}
              {canAnswer && openQuestions.count > 0 && (
                <Stat value={openQuestions.count} label="Questions open" />
              )}
              {canReview(viewer) && pendingCount.count > 0 && (
                <Stat value={pendingCount.count} label="Awaiting approval" />
              )}
            </Stats>
          </div>
        )}
      </PageHero>

      {/* The league sits on the band, the way alternating sections do on the
          public site, with the two boards as the dark photo-tile surfaces. */}
      <Section band>
        <SectionTitle>The league</SectionTitle>
        <div className="grid gap-5 md:grid-cols-2">
          <DarkTile href="/hub/topics" Component={Link} kicker="Channels" title="Topics">
            Every club in one room. Short posts, named or anonymous.
          </DarkTile>
          <DarkTile href="/hub/qa" Component={Link} kicker="Ask the network" title="Q&A">
            Advisors and the exec team answer. Answers stay on the board.
          </DarkTile>
        </div>
      </Section>

      <Section>
        {roster.length > 0 ? (
          <>
            <SectionTitle
              count={`${roster.length} member${roster.length === 1 ? '' : 's'}`}
              action={
                viewer.isClubLead || viewer.isAdmin ? (
                  <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/roster">
                    Manage roster
                  </Link>
                ) : null
              }
            >
              Your club
            </SectionTitle>

            {/* Table on desktop, cards below sm — a three-column table on a
                phone either overflows or squeezes to nothing. */}
            <div className="hidden overflow-hidden rounded-[8px] border border-edge bg-surface sm:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-edge bg-band/60">
                    {['Member', 'Role', 'Division'].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 font-display text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-meta"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster.map((m) => (
                    <tr key={m.id} className="border-b border-edge/70 last:border-0 transition hover:bg-band/50">
                      <td className="px-6 py-4 font-display text-[1.05rem] font-bold uppercase tracking-[0.02em] text-ink">
                        {m.display_name || <span className="font-body normal-case text-fine">No name yet</span>}
                      </td>
                      <td className="px-6 py-4">
                        {m.club_role === 'member'
                          ? <span className="text-[0.92rem] text-meta">Member</span>
                          : <Badge tone="active">{roleLabel(m.club_role)}</Badge>}
                      </td>
                      <td className="px-6 py-4 text-[0.92rem] text-body">
                        {m.division || <span className="text-fine">Not set</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="grid list-none gap-3 sm:hidden">
              {roster.map((m) => (
                <li key={m.id} className="rounded-[8px] border border-edge bg-surface px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-display text-[1.05rem] font-bold uppercase text-ink">
                      {m.display_name || <span className="font-body normal-case text-fine">No name yet</span>}
                    </span>
                    {m.club_role !== 'member' && <Badge tone="active">{roleLabel(m.club_role)}</Badge>}
                  </div>
                  {m.division && <Meta className="mt-1">{m.division}</Meta>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <SectionTitle>Your club</SectionTitle>
            <Empty>
              {viewer.pendingMembership
                ? 'Your application is with your club lead. They usually get to it within a few days, and you will see your chapter here once they do.'
                : 'You are not at a chapter yet. If your school has one, you can apply from your profile; if it does not, we will tell you when that changes.'}
            </Empty>
          </>
        )}
      </Section>
    </Page>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { canReview, reviewScope } from '@/lib/review';
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
  const profile = await getProfile(supabase);

  // The layout redirects too, but layouts and pages render in parallel — this
  // page still runs, and would crash on profile.role before the layout's
  // redirect lands. Fail closed here as well.
  if (!profile) redirect('/login');

  const canAnswer = profile.role === 'advisor' || profile.role === 'admin';
  const scope = reviewScope(profile);

  const [clubmates, openQuestions, pendingCount] = await Promise.all([
    profile.club_id
      ? supabase.from('profiles')
          .select('id, display_name, role, division')
          .eq('club_id', profile.club_id)
          .order('display_name')
      : Promise.resolve({ data: null }),
    canAnswer
      ? supabase.from('question_feed').select('*', { count: 'exact', head: true }).eq('answered', false)
      : Promise.resolve({ count: 0 }),
    canReview(profile)
      ? (scope.kind === 'school'
          ? supabase.from('profiles').select('*', { count: 'exact', head: true })
              .eq('status', 'pending').eq('school_id', scope.schoolId)
          : supabase.from('profiles').select('*', { count: 'exact', head: true })
              .eq('status', 'pending'))
      : Promise.resolve({ count: 0 }),
  ]);

  const roster = clubmates.data || [];
  const roleLabel = (role) => (role === 'member' ? 'Member' : role.replace('_', ' '));
  const firstName = String(profile.display_name || 'member').split(/\s+/)[0];

  return (
    <Page>
      <PageHero
        eyebrow={profile.schools?.name || 'NCBO'}
        title={profile.clubs?.name || `Welcome back, ${firstName}.`}
        lead={
          profile.clubs?.name
            ? 'Your club, then the league. Everything the network is talking about is a click away.'
            : 'You’re not attached to a club yet — the league board is open to you all the same.'
        }
        actions={
          canReview(profile) && pendingCount.count > 0 ? (
            <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/admin">
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
              {canReview(profile) && pendingCount.count > 0 && (
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
            <SectionTitle count={`${roster.length} member${roster.length === 1 ? '' : 's'}`}>
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
                        {m.role === 'member'
                          ? <span className="text-[0.92rem] text-meta">Member</span>
                          : <Badge tone="active">{roleLabel(m.role)}</Badge>}
                      </td>
                      <td className="px-6 py-4 text-[0.92rem] text-body">
                        {m.division || <span className="text-fine">—</span>}
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
                    {m.role !== 'member' && <Badge tone="active">{roleLabel(m.role)}</Badge>}
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
              No club on your account yet. An NCBO admin attaches you to one — the league
              board is open in the meantime.
            </Empty>
          </>
        )}
      </Section>
    </Page>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { canReview, reviewScope } from '@/lib/review';
import { Page, PageHeader, SectionTitle, Card, CardLink, Empty, Pill, Meta } from './ui';

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

  return (
    <Page>
      <PageHeader
        eyebrow={profile.schools?.name || 'NCBO'}
        title={profile.clubs?.name || `Welcome back, ${profile.display_name || 'member'}.`}
      >
        {profile.clubs?.name
          ? `${profile.schools?.name} · ${roster.length} member${roster.length === 1 ? '' : 's'}`
          : 'You’re not attached to a club yet — the league board is open to you all the same.'}
      </PageHeader>

      {/* Things waiting on this person, if any. Nothing renders when there is
          nothing to do, rather than a row of zeroes. */}
      {(pendingCount.count > 0 || openQuestions.count > 0) && (
        <div className="mb-9 grid gap-3 sm:grid-cols-2">
          {canReview(profile) && pendingCount.count > 0 && (
            <CardLink href="/hub/admin" Component={Link} className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-display text-2xl font-extrabold leading-none text-ink">
                  {pendingCount.count}
                </span>
                <span className="mt-1 block text-[0.9rem] text-silver">
                  account{pendingCount.count === 1 ? '' : 's'} waiting for approval
                </span>
              </span>
              <span className="font-display text-sm uppercase tracking-[0.12em] text-steel transition group-hover:text-steel-light">
                Review →
              </span>
            </CardLink>
          )}

          {canAnswer && openQuestions.count > 0 && (
            <CardLink href="/hub/qa" Component={Link} className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-display text-2xl font-extrabold leading-none text-ink">
                  {openQuestions.count}
                </span>
                <span className="mt-1 block text-[0.9rem] text-silver">
                  question{openQuestions.count === 1 ? '' : 's'} waiting for an answer
                </span>
              </span>
              <span className="font-display text-sm uppercase tracking-[0.12em] text-steel transition group-hover:text-steel-light">
                Open →
              </span>
            </CardLink>
          )}
        </div>
      )}

      {roster.length > 0 && (
        <section className="mb-10">
          <SectionTitle count={`${roster.length} member${roster.length === 1 ? '' : 's'}`}>
            Your club
          </SectionTitle>

          {/* A table on a phone either overflows or squeezes to nothing, so it
              becomes a list of cards below sm. Same data, twice, one visible. */}
          <div className="hidden overflow-hidden rounded-xl border border-line sm:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-navy-2/60">
                  {['Member', 'Role', 'Division'].map((h) => (
                    <th key={h} className="px-5 py-3 font-display text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.map((m) => (
                  <tr key={m.id} className="border-t border-line/70 transition hover:bg-navy-1">
                    <td className="px-5 py-3 text-[0.95rem] text-ink">
                      {m.display_name || <span className="text-muted">No name yet</span>}
                    </td>
                    <td className="px-5 py-3">
                      {m.role === 'member'
                        ? <span className="text-[0.9rem] text-muted">Member</span>
                        : <Pill tone="role">{roleLabel(m.role)}</Pill>}
                    </td>
                    <td className="px-5 py-3 text-[0.9rem] text-silver-dim">{m.division || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid list-none gap-2 sm:hidden">
            {roster.map((m) => (
              <li key={m.id} className="rounded-lg border border-line bg-navy-1 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[0.95rem] text-ink">
                    {m.display_name || <span className="text-muted">No name yet</span>}
                  </span>
                  {m.role !== 'member' && <Pill tone="role">{roleLabel(m.role)}</Pill>}
                </div>
                {m.division && <Meta className="mt-1">{m.division}</Meta>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>The league</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <CardLink href="/hub/topics" Component={Link}>
            <h3 className="font-display text-xl font-bold uppercase tracking-[0.06em] text-ink transition group-hover:text-steel-light">
              Topics
            </h3>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-silver-dim">
              Channels across every club. Short posts, named or anonymous.
            </p>
            <span className="mt-4 inline-block font-display text-[0.78rem] uppercase tracking-[0.14em] text-steel">
              Go to topics →
            </span>
          </CardLink>

          <CardLink href="/hub/qa" Component={Link}>
            <h3 className="font-display text-xl font-bold uppercase tracking-[0.06em] text-ink transition group-hover:text-steel-light">
              Q&amp;A
            </h3>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-silver-dim">
              Ask the advisors and exec team. Answers stay on the board.
            </p>
            <span className="mt-4 inline-block font-display text-[0.78rem] uppercase tracking-[0.14em] text-steel">
              Go to Q&amp;A →
            </span>
          </CardLink>
        </div>
      </section>

      {roster.length === 0 && !profile.club_id && (
        <div className="mt-6">
          <Empty>
            No club on your account yet. An NCBO admin attaches you to one — the league
            board above is open in the meantime.
          </Empty>
        </div>
      )}
    </Page>
  );
}

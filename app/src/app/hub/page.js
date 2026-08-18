import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { canReview, reviewScope } from '@/lib/review';

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

  return (
    <main className="page wrap">
      <div className="page-head">
        <p className="eyebrow">{profile.schools?.name || 'NCBO'}</p>
        <h1>{profile.clubs?.name || `Welcome back, ${profile.display_name || 'member'}.`}</h1>
        <p>
          {profile.clubs?.name
            ? `${profile.schools?.name} · ${roster.length} member${roster.length === 1 ? '' : 's'}`
            : 'You’re not attached to a club yet — the league board is open to you all the same.'}
        </p>
      </div>

      {canReview(profile) && pendingCount.count > 0 && (
        <div className="notice" style={{ marginBottom: '1.2rem' }}>
          <b>{pendingCount.count} account{pendingCount.count === 1 ? '' : 's'} waiting for approval.</b>{' '}
          <Link href="/hub/admin" style={{ color: 'var(--steel-light)', textDecoration: 'underline' }}>
            Review them →
          </Link>
        </div>
      )}

      {canAnswer && openQuestions.count > 0 && (
        <div className="notice" style={{ marginBottom: '1.2rem' }}>
          <b>{openQuestions.count} question{openQuestions.count === 1 ? '' : 's'} waiting for an answer.</b>{' '}
          <Link href="/hub/qa" style={{ color: 'var(--steel-light)', textDecoration: 'underline' }}>
            Open the board →
          </Link>
        </div>
      )}

      {roster.length > 0 && (
        <>
          <p className="eyebrow" style={{ marginBottom: '0.9rem' }}>Your club</p>
          <div className="tablewrap" style={{ marginBottom: '2rem' }}>
            <table>
              <thead><tr><th>Member</th><th>Role</th><th>Division</th></tr></thead>
              <tbody>
                {roster.map((m) => (
                  <tr key={m.id}>
                    <td>{m.display_name || <span className="muted">No name yet</span>}</td>
                    <td>
                      {m.role === 'member'
                        ? <span className="muted">Member</span>
                        : <span className="rolechip">{m.role.replace('_', ' ')}</span>}
                    </td>
                    <td>{m.division || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="eyebrow" style={{ marginBottom: '0.9rem' }}>The league</p>
      <div className="stack">
        <div className="card">
          <h3>Topics</h3>
          <p className="lead" style={{ fontSize: '0.95rem', marginTop: '0.3rem' }}>
            Channels across every club. Short posts, named or anonymous.
          </p>
          <Link className="btn btn-ghost btn-sm" href="/hub/topics" style={{ marginTop: '0.9rem' }}>
            Go to topics
          </Link>
        </div>
        <div className="card">
          <h3>Q&amp;A</h3>
          <p className="lead" style={{ fontSize: '0.95rem', marginTop: '0.3rem' }}>
            Ask the advisors and exec team. Answers stay on the board.
          </p>
          <Link className="btn btn-ghost btn-sm" href="/hub/qa" style={{ marginTop: '0.9rem' }}>
            Go to Q&amp;A
          </Link>
        </div>
      </div>
    </main>
  );
}

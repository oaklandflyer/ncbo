import Link from 'next/link';
import { createClient, getProfile } from '@/lib/supabase/server';

export default async function Hub() {
  const supabase = await createClient();
  const profile = await getProfile(supabase);

  const [{ count: openQuestions }, { data: channels }] = await Promise.all([
    supabase.from('question_feed').select('*', { count: 'exact', head: true }).eq('answered', false),
    supabase.from('channels').select('slug, name').order('sort'),
  ]);

  const canAnswer = profile.role === 'advisor' || profile.role === 'admin';

  return (
    <main className="page wrap">
      <div className="page-head">
        <p className="eyebrow">Season hub</p>
        <h1>Welcome back, {profile.display_name}.</h1>
        <p>
          {profile.clubs?.name
            ? `${profile.clubs.name} · ${profile.schools?.name}`
            : profile.schools?.name || 'Unaffiliated member'}
        </p>
      </div>

      {canAnswer && openQuestions > 0 && (
        <div className="notice" style={{ marginBottom: '1.6rem' }}>
          <b>{openQuestions} question{openQuestions === 1 ? '' : 's'} waiting for an answer.</b>{' '}
          <Link href="/hub/qa" style={{ color: 'var(--steel-light)', textDecoration: 'underline' }}>
            Open the board →
          </Link>
        </div>
      )}

      <div className="stack">
        <div className="card">
          <h3>Topics</h3>
          <p className="lead" style={{ fontSize: '0.95rem', marginTop: '0.3rem' }}>
            {channels?.length || 0} channels. Short posts, league-wide.
          </p>
          <Link className="btn btn-ghost btn-sm" href="/hub/topics" style={{ marginTop: '0.9rem' }}>
            Go to topics
          </Link>
        </div>

        <div className="card">
          <h3>Q&amp;A</h3>
          <p className="lead" style={{ fontSize: '0.95rem', marginTop: '0.3rem' }}>
            Ask the advisors and exec team. Answers are posted back to the board.
          </p>
          <Link className="btn btn-ghost btn-sm" href="/hub/qa" style={{ marginTop: '0.9rem' }}>
            Go to Q&amp;A
          </Link>
        </div>
      </div>
    </main>
  );
}

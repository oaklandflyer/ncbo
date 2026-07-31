import { notFound } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import AnswerForm from '../answer';

export default async function Question({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getProfile(supabase);

  const { data: q } = await supabase
    .from('question_feed')
    .select('id, body, anonymous, answered, created_at, author_name, author_school')
    .eq('id', id)
    .single();
  if (!q) notFound();

  const { data: answers } = await supabase
    .from('answer_feed')
    .select('id, body, created_at, author_name, author_role')
    .eq('question_id', id)
    .order('created_at');

  const canAnswer = profile.role === 'advisor' || profile.role === 'admin';

  return (
    <main className="page wrap">
      <div className="page-head">
        <p className="eyebrow">Question</p>
        <h1 style={{ fontSize: 'clamp(1.5rem,3.4vw,2.2rem)' }}>{q.body}</h1>
        <p>
          Asked by {q.author_name}
          {q.author_school ? ` · ${q.author_school}` : ''}
        </p>
      </div>

      {answers?.length ? (
        answers.map((a) => (
          <div className="answer" key={a.id}>
            <div className="answer-who">
              {a.author_name} · {a.author_role === 'admin' ? 'NCBO exec' : 'Advisor'}
            </div>
            <p>{a.body}</p>
          </div>
        ))
      ) : (
        <div className="empty">
          No answer yet.{canAnswer ? ' You can post one below.' : ' An advisor will pick this up.'}
        </div>
      )}

      {canAnswer && <AnswerForm questionId={q.id} />}
    </main>
  );
}

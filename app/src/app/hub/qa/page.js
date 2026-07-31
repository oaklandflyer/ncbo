import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Ask from './ask';

export default async function QA() {
  const supabase = await createClient();

  const [{ data: questions }, { data: channels }] = await Promise.all([
    supabase.from('question_feed')
      .select('id, body, anonymous, answered, created_at, author_name, author_school, answer_count')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('channels').select('slug, name').order('sort'),
  ]);

  return (
    <main className="page wrap">
      <div className="page-head">
        <p className="eyebrow">The board</p>
        <h1>Q&amp;A.</h1>
        <p>Questions go to the advisors and exec team. Answers stay on the board so the next person doesn&rsquo;t have to ask.</p>
      </div>

      {questions?.length ? (
        questions.map((q) => (
          <Link className="q" key={q.id} href={`/hub/qa/${q.id}`}>
            <div className="q-body">{q.body.length > 140 ? `${q.body.slice(0, 140)}…` : q.body}</div>
            <div className="q-meta">
              <span className={`pill ${q.answered ? 'answered' : 'open'}`}>
                {q.answered ? `${q.answer_count} answer${q.answer_count === 1 ? '' : 's'}` : 'Open'}
              </span>
              <span>{q.author_name}</span>
              {q.author_school && <span>· {q.author_school}</span>}
            </div>
          </Link>
        ))
      ) : (
        <div className="empty">No questions yet. Ask the first one.</div>
      )}

      <Ask channels={channels || []} />
    </main>
  );
}

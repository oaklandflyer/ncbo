import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { Page, PageHeader, SectionTitle, Card, Empty, Pill, Meta } from '../../ui';
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
  const count = answers?.length || 0;

  return (
    <Page>
      <Link
        href="/hub/qa"
        className="mb-6 inline-flex items-center gap-2 font-display text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-muted transition hover:text-steel-light"
      >
        ← Back to the board
      </Link>

      <PageHeader
        eyebrow="Question"
        title={
          // The question is the headline, so it takes the display face but not
          // the uppercase treatment — shouting someone's question reads badly.
          <span className="block text-[clamp(1.35rem,3.2vw,2rem)] normal-case leading-tight">
            {q.body}
          </span>
        }
        actions={<Pill tone={count > 0 ? 'done' : 'open'}>{count > 0 ? `${count} answer${count === 1 ? '' : 's'}` : 'Open'}</Pill>}
      >
        <Meta>
          <span>Asked by</span>
          <span className="text-silver">{q.author_name}</span>
          {q.author_school && (
            <>
              <span aria-hidden className="text-muted-2">·</span>
              <span>{q.author_school}</span>
            </>
          )}
        </Meta>
      </PageHeader>

      <section className="mb-10">
        <SectionTitle count={count > 0 ? count : null}>
          {count === 1 ? 'Answer' : 'Answers'}
        </SectionTitle>

        {count > 0 ? (
          <div className="grid gap-3">
            {answers.map((a) => (
              <Card key={a.id} className="border-l-2 border-l-steel/70">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-display text-[0.9rem] font-bold uppercase tracking-[0.1em] text-ink">
                    {a.author_name}
                  </span>
                  <Pill tone="role">{a.author_role === 'admin' ? 'NCBO exec' : 'Advisor'}</Pill>
                </div>
                {/* Answers are written as prose and often run long — keep the
                    author's line breaks instead of collapsing them. */}
                <p className="whitespace-pre-line text-[0.97rem] leading-relaxed text-silver">
                  {a.body}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <Empty>
            No answer yet.{canAnswer ? ' You can post one below.' : ' An advisor will pick this up.'}
          </Empty>
        )}
      </section>

      {canAnswer && <AnswerForm questionId={q.id} />}
    </Page>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Page, PageHeader, SectionTitle, CardLink, Empty, Pill, Meta } from '../ui';
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

  const open = (questions || []).filter((q) => !q.answered).length;

  return (
    <Page>
      <PageHeader eyebrow="The board" title="Q&A.">
        Questions go to the advisors and exec team. Answers stay on the board so the next
        person doesn’t have to ask.
      </PageHeader>

      <section className="mb-10">
        <SectionTitle count={open > 0 ? `${open} open` : null}>Questions</SectionTitle>

        {questions?.length ? (
          <ul className="grid list-none gap-3">
            {questions.map((q) => (
              <li key={q.id}>
                <CardLink href={`/hub/qa/${q.id}`} Component={Link}>
                  <div className="flex items-start justify-between gap-4">
                    {/* Clamped rather than truncated with a slice: the full text
                        stays in the DOM for search and screen readers. */}
                    <p className="line-clamp-3 text-[1.02rem] leading-snug text-ink transition group-hover:text-steel-light">
                      {q.body}
                    </p>
                    <Pill tone={q.answered ? 'done' : 'open'}>
                      {q.answered
                        ? `${q.answer_count} answer${q.answer_count === 1 ? '' : 's'}`
                        : 'Open'}
                    </Pill>
                  </div>
                  <Meta className="mt-3">
                    <span className="text-silver-dim">{q.author_name}</span>
                    {q.author_school && (
                      <>
                        <span aria-hidden className="text-muted-2">·</span>
                        <span>{q.author_school}</span>
                      </>
                    )}
                  </Meta>
                </CardLink>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No questions yet. Ask the first one.</Empty>
        )}
      </section>

      <Ask channels={channels || []} />
    </Page>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Page, PageHero, Section, SectionTitle, CardLink, Empty, Badge, Meta } from '../ui';
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
      <PageHero
        eyebrow="The board"
        title="Q&A."
        lead="Questions go to the advisors and exec team. Answers stay on the board so the next person doesn’t have to ask."
      />

      <Section>
        <SectionTitle count={open > 0 ? `${open} open` : null}>Questions</SectionTitle>

        {questions?.length ? (
          <ul className="grid list-none gap-4">
            {questions.map((q) => (
              <li key={q.id}>
                <CardLink href={`/hub/qa/${q.id}`} Component={Link}>
                  {/* Below sm the badge drops under the question: side by
                      side, it squeezes a long question into a column two
                      words wide. The question is sentence case on purpose —
                      the site shouts its headings, but shouting someone's
                      question back at them reads as an accusation. */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                    {/* Clamped rather than sliced: the full text stays in the
                        DOM for search and screen readers. */}
                    <p className="line-clamp-3 font-display text-[1.35rem] font-bold leading-[1.2] text-ink transition group-hover:text-brand">
                      {q.body}
                    </p>
                    <div className="shrink-0">
                      <Badge tone={q.answered ? 'forming' : 'active'}>
                        {q.answered
                          ? `${q.answer_count} answer${q.answer_count === 1 ? '' : 's'}`
                          : 'Open'}
                      </Badge>
                    </div>
                  </div>
                  <Meta className="mt-4 border-t border-edge pt-3">
                    <span className="text-body">{q.author_name}</span>
                    {q.author_school && (
                      <>
                        <span aria-hidden className="text-fine">·</span>
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
      </Section>

      <Section band>
        <Ask channels={channels || []} />
      </Section>
    </Page>
  );
}

import Link from 'next/link';
import { createClient, getProfile } from '@/lib/supabase/server';
import { Page, PageHero, Section, SectionTitle, CardLink, Card, Empty, Badge, Meta } from '@/app/ui';
import { canReview } from '@/lib/review';
import Ask from './ask';
import Moderate from './moderate';

/** The board only ever shows approved questions; the rest are states, not posts. */
const PILL = {
  pending: 'Pending Approval',
  rejected: 'Not published',
};

export default async function QA() {
  const supabase = await createClient();
  const profile = await getProfile(supabase);

  const [{ data: questions }, { data: channels }, { data: mine }] = await Promise.all([
    supabase.from('question_feed')
      .select('id, body, anonymous, answered, status, created_at, author_name, author_school, answer_count')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('channels').select('slug, name').order('sort'),
    /* Straight off the base table, not the feed: `questions_read_own` is what
       lets an author see their own row before a moderator has looked at it,
       and it hands that row to nobody else. */
    supabase.from('questions')
      .select('id, body, status, answered, anonymous, created_at')
      .eq('author_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  /* Advisors and admins work the queue from the same view, which hands them
     the unapproved rows the members' query above filters out. */
  const moderates = canReview(profile) && (profile.role === 'advisor' || profile.role === 'admin');
  const { data: queue } = moderates
    ? await supabase.from('question_feed')
        .select('id, body, status, created_at, author_name, author_school')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    : { data: null };

  const open = (questions || []).filter((q) => !q.answered).length;
  const waiting = (mine || []).filter((q) => q.status !== 'approved');

  return (
    <Page>
      <PageHero
        eyebrow="The board"
        title="Q&A."
        lead="Questions go to the advisors and exec team. Answers stay on the board so the next person doesn’t have to ask."
      />

      {moderates && queue?.length > 0 && (
        <Section band>
          <SectionTitle count={`${queue.length} waiting`}>Awaiting review</SectionTitle>
          <div className="grid gap-4">
            {queue.map((q) => (
              <Card key={q.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                  <p className="font-display text-[1.2rem] font-bold leading-[1.25] text-ink">
                    {q.body}
                  </p>
                  <div className="shrink-0"><Badge tone="pending">{PILL.pending}</Badge></div>
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
                <div className="mt-4">
                  <Moderate questionId={q.id} />
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

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

      {mine?.length > 0 && (
        <Section>
          <SectionTitle count={waiting.length > 0 ? `${waiting.length} waiting` : null}>
            Your questions
          </SectionTitle>
          <ul className="grid list-none gap-3">
            {mine.map((q) => (
              <li
                key={q.id}
                className="flex flex-col gap-3 rounded-[8px] border border-edge bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Approved ones link out to the board; the others have no
                    page to go to yet, so they stay as text rather than a
                    link that 404s. */}
                {q.status === 'approved' ? (
                  <Link href={`/hub/qa/${q.id}`} className="line-clamp-2 text-[1rem] text-ink hover:text-brand">
                    {q.body}
                  </Link>
                ) : (
                  <span className="line-clamp-2 text-[1rem] text-body">{q.body}</span>
                )}
                <div className="shrink-0">
                  {q.status === 'approved'
                    ? <Badge tone={q.answered ? 'forming' : 'active'}>{q.answered ? 'Answered' : 'On the board'}</Badge>
                    : <Badge tone="pending">{PILL[q.status]}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section band>
        <Ask channels={channels || []} />
      </Section>
    </Page>
  );
}

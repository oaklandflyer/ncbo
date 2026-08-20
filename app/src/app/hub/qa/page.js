import Link from 'next/link';
import { createClient, getProfile } from '@/lib/supabase/server';
import { Page, PageHero, Section, SectionTitle, Card, Empty, Badge, Meta } from '@/app/ui';
import Board from './board';
import { isModerator } from '@/lib/review';
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
      .select('id, channel_id, body, anonymous, answered, status, created_at, author_name, author_school, answer_count, helpful_count, voted_by_me')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('channels').select('id, slug, name').order('sort'),
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
  const moderates = isModerator(profile);
  const { data: queue } = moderates
    ? await supabase.from('question_feed')
        .select('id, body, status, created_at, author_name, author_school')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    : { data: null };

  /* Who settled each question, for the card footer. One query for the whole
     page rather than one per card; the last answer wins, which is the one a
     reader lands on. */
  const ids = (questions || []).map((q) => q.id);
  const { data: answers } = ids.length
    ? await supabase.from('answer_feed')
        .select('question_id, author_name, author_verified, created_at')
        .in('question_id', ids)
        .order('created_at')
    : { data: null };

  const settledBy = new Map();
  (answers || []).forEach((a) => settledBy.set(a.question_id, a));

  const byChannel = new Map((channels || []).map((c) => [c.id, c]));
  const rows = (questions || []).map((q) => {
    const channel = byChannel.get(q.channel_id);
    const answer = settledBy.get(q.id);
    return {
      ...q,
      channel_slug: channel?.slug || '',
      channel_name: channel?.name || '',
      answered_by: answer?.author_name || null,
      answered_by_verified: !!answer?.author_verified,
    };
  });

  const open = (questions || []).filter((q) => !q.answered).length;
  const waiting = (mine || []).filter((q) => q.status !== 'approved');

  return (
    <Page>
      <PageHero
        eyebrow="The board"
        title="Q&A."
        lead="Questions go to the advisors and exec team. Answers stay on the board so the next person doesn’t have to ask."
      />

      {moderates && (
        <Section band id="queue" className="scroll-mt-[72px]">
          <SectionTitle count={queue?.length ? `${queue.length} waiting` : null}>
            Awaiting review
          </SectionTitle>
          {!queue?.length && (
            <Empty>Queue clear. New questions land here before they reach the board.</Empty>
          )}
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
        <Board questions={rows} channels={channels || []} />
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

      <Section band className="scroll-mt-[72px]" id="ask">
        <Ask channels={channels || []} />
      </Section>
    </Page>
  );
}

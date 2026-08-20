import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { Page, PageHero, Section, SectionTitle, Card, Empty, Badge, Meta, BackLink, VettedSeal, Credentials } from '@/app/ui';
import AnswerForm from '../answer';
import Moderate from '../moderate';

export default async function Question({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getProfile(supabase);

  /* The view hands a member only approved rows, so an unapproved question is
     genuinely not found for everyone except a moderator — no separate guard to
     keep in step here. */
  const { data: q } = await supabase
    .from('question_feed')
    .select('id, body, anonymous, answered, status, created_at, author_name, author_school')
    .eq('id', id)
    .single();
  if (!q) notFound();

  const { data: answers } = await supabase
    .from('answer_feed')
    .select('id, body, created_at, author_name, author_role, author_verified, author_credentials')
    .eq('question_id', id)
    .order('created_at');

  const canAnswer = profile.role === 'advisor' || profile.role === 'admin';
  const count = answers?.length || 0;

  return (
    <Page>
      <PageHero
        eyebrow="Question"
        title={
          // The question is the headline, in the display face but not shouted:
          // uppercasing someone's question reads as an accusation.
          <span className="block text-[clamp(1.6rem,3.4vw,2.6rem)] normal-case leading-[1.08]">
            {q.body}
          </span>
        }
        actions={
          q.status === 'approved'
            ? <Badge tone={count > 0 ? 'forming' : 'active'}>{count > 0 ? `${count} answer${count === 1 ? '' : 's'}` : 'Open'}</Badge>
            : <Badge tone="pending">{q.status === 'pending' ? 'Pending Approval' : 'Not published'}</Badge>
        }
      >
        <Meta className="mt-5">
          <span>Asked by</span>
          <span className="font-display font-bold uppercase tracking-[0.06em] text-ink">{q.author_name}</span>
          {q.author_school && (
            <>
              <span aria-hidden className="text-fine">·</span>
              <span>{q.author_school}</span>
            </>
          )}
        </Meta>
        {/* A moderator reaching a pending question decides it here rather than
            going back to the queue to find it again. */}
        {canAnswer && q.status !== 'approved' && (
          <div className="mt-6 rounded-[8px] border border-edge bg-surface p-5">
            <p className="mb-3 text-[0.95rem] text-body">
              This question isn’t on the board yet. Only you and its author can see it.
            </p>
            <Moderate questionId={q.id} />
          </div>
        )}

        <div className="mt-6">
          <BackLink href="/hub/qa" Component={Link}>Back to the board</BackLink>
        </div>
      </PageHero>

      <Section>
        <SectionTitle count={count > 0 ? count : null}>
          {count === 1 ? 'Answer' : 'Answers'}
        </SectionTitle>

        {count > 0 ? (
          <div className="grid gap-4">
            {answers.map((a) => (
              <Card key={a.id} className="border-l-2 border-l-brand">
                {/* Role, then what the organisation vouches for, then what the
                    federations say — each one data-driven, so an unvetted
                    advisor carries no seal. */}
                <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="font-display text-[1.15rem] font-extrabold uppercase tracking-[0.02em] text-ink">
                    {a.author_name}
                  </span>
                  <Badge tone="active">{a.author_role === 'admin' ? 'NCBO exec' : 'Advisor'}</Badge>
                  {a.author_verified && <VettedSeal />}
                  <Credentials items={a.author_credentials} />
                </div>
                {/* Answers run long and are written as prose — keep the
                    author's line breaks rather than collapsing them. */}
                <p className="whitespace-pre-line text-[1.02rem] leading-relaxed text-body">
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
      </Section>

      {canAnswer && (
        <Section band>
          <AnswerForm questionId={q.id} />
        </Section>
      )}
    </Page>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section, SectionTitle, Card, Meta, Empty, btnGhost, btnSmall } from '@/app/ui';

export const metadata = { title: 'Moderate questions · NCBO' };

export default async function ModerateQuestions() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn) redirect('/login');
  if (!viewer.profile) return null;
  if (!viewer.canModerateContent) redirect('/hub');

  const { data: pending } = await supabase
    .from('question_feed')
    .select('id, body, author_name, created_at, answer_count')
    .eq('status', 'pending')
    .order('created_at');

  const waiting = pending?.length || 0;

  return (
    <Page>
      <PageHero
        eyebrow="Moderation"
        title="Questions."
        lead={waiting
          ? 'Nothing here is on the board until it is approved.'
          : 'Nothing waiting. New questions land here before members see them.'}
      />
      <Section>
        <SectionTitle count={waiting ? `${waiting} waiting` : null}>Pending</SectionTitle>

        {/* An empty queue is the normal state and should read as finished, not
            as an error or a blank screen. */}
        {waiting === 0 ? (
          <Empty>
            The queue is clear. Approved questions live on the{' '}
            <Link className="font-semibold text-brand underline underline-offset-2" href="/hub/qa">Q&amp;A board</Link>.
          </Empty>
        ) : (
          <ul className="grid list-none gap-3">
            {pending.map((q) => (
              <li key={q.id}>
                <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="text-[1rem] text-ink">{q.body}</p>
                    <Meta className="mt-1">
                      {q.author_name}
                      {` · ${new Date(q.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}`}
                    </Meta>
                  </div>
                  <Link className={`${btnGhost} ${btnSmall}`} href={`/hub/qa/${q.id}`}>
                    Review
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  );
}

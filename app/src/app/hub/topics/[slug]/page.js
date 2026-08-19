import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Page, PageHero, Section, SectionTitle, Empty, Badge, Meta, BackLink } from '@/app/ui';
import Composer from '../composer';

function when(ts) {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function Channel({ params }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from('channels').select('id, slug, name, description').eq('slug', slug).single();
  if (!channel) notFound();

  // post_feed, not posts — the view is what nulls the author on anonymous rows.
  const { data: posts } = await supabase
    .from('post_feed')
    .select('id, body, anonymous, created_at, author_name, author_role, author_school')
    .eq('channel_id', channel.id)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <Page>
      <PageHero eyebrow="Channel" title={`#${channel.name}`} lead={channel.description}>
        <div className="mt-6">
          <BackLink href="/hub/topics" Component={Link}>All channels</BackLink>
        </div>
      </PageHero>

      <Section>
        <SectionTitle count={posts?.length ? `${posts.length} post${posts.length === 1 ? '' : 's'}` : null}>
          Posts
        </SectionTitle>

        {posts?.length ? (
          <ul className="grid list-none gap-4">
            {posts.map((p) => (
              <li key={p.id}>
                {/* Anonymous posts are visibly different — a reader should be
                    able to tell at a glance whether a name stands behind it. */}
                <article
                  className={`rounded-[8px] border bg-surface p-6 sm:p-7 ${
                    p.anonymous ? 'border-dashed border-edge' : 'border-edge'
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span
                      className={
                        p.anonymous
                          ? 'text-[0.95rem] italic text-meta'
                          : 'font-display text-[1.05rem] font-extrabold uppercase tracking-[0.02em] text-ink'
                      }
                    >
                      {p.author_name}
                    </span>
                    {p.author_role && p.author_role !== 'member' && (
                      <Badge tone="active">{p.author_role.replace('_', ' ')}</Badge>
                    )}
                  </div>
                  <p className="text-[1.05rem] leading-relaxed text-ink">{p.body}</p>
                  <Meta className="mt-4 border-t border-edge pt-3">
                    {p.author_school && (
                      <>
                        <span>{p.author_school}</span>
                        <span aria-hidden className="text-fine">·</span>
                      </>
                    )}
                    <time dateTime={p.created_at}>{when(p.created_at)}</time>
                  </Meta>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nothing here yet. Start it off.</Empty>
        )}
      </Section>

      <Section band>
        <Composer slug={channel.slug} channelName={channel.name} />
      </Section>
    </Page>
  );
}

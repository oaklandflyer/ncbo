import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Page, PageHeader, SectionTitle, Empty, Pill, Meta } from '../../ui';
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
      <Link
        href="/hub/topics"
        className="mb-6 inline-flex items-center gap-2 font-display text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-muted transition hover:text-steel-light"
      >
        ← All channels
      </Link>

      <PageHeader eyebrow="Channel" title={`#${channel.name}`}>
        {channel.description}
      </PageHeader>

      <section className="mb-10">
        <SectionTitle count={posts?.length || null}>Posts</SectionTitle>

        {posts?.length ? (
          <ul className="grid list-none gap-3">
            {posts.map((p) => (
              <li key={p.id}>
                {/* Anonymous posts are visibly different — a reader should be
                    able to tell at a glance whether a name stands behind it. */}
                <article
                  className={`rounded-xl border bg-navy-1 p-5 ${
                    p.anonymous ? 'border-dashed border-line' : 'border-line'
                  }`}
                >
                  <Meta className="mb-2">
                    <span className={p.anonymous ? 'italic text-muted' : 'font-medium text-silver'}>
                      {p.author_name}
                    </span>
                    {p.author_role && p.author_role !== 'member' && (
                      <Pill tone="role">{p.author_role.replace('_', ' ')}</Pill>
                    )}
                    {p.author_school && (
                      <>
                        <span aria-hidden className="text-muted-2">·</span>
                        <span>{p.author_school}</span>
                      </>
                    )}
                    <span aria-hidden className="text-muted-2">·</span>
                    <time dateTime={p.created_at}>{when(p.created_at)}</time>
                  </Meta>
                  <p className="text-[1.02rem] leading-relaxed text-ink">{p.body}</p>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nothing here yet. Start it off.</Empty>
        )}
      </section>

      <Composer slug={channel.slug} />
    </Page>
  );
}

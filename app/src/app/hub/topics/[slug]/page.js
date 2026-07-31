import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
    <main className="page wrap">
      <div className="page-head">
        <p className="eyebrow">Channel</p>
        <h1>#{channel.name}</h1>
        <p>{channel.description}</p>
      </div>

      {posts?.length ? (
        posts.map((p) => (
          <article className={`post ${p.anonymous ? 'anon' : ''}`} key={p.id}>
            <div className="post-who">
              <span>{p.author_name}</span>
              {p.author_role && p.author_role !== 'member' && (
                <span className="rolechip">{p.author_role.replace('_', ' ')}</span>
              )}
              {p.author_school && <span className="at">{p.author_school}</span>}
              <span className="at">· {when(p.created_at)}</span>
            </div>
            <p className="post-body">{p.body}</p>
          </article>
        ))
      ) : (
        <div className="empty">Nothing here yet. Start it off.</div>
      )}

      <Composer slug={channel.slug} />
    </main>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function Topics() {
  const supabase = await createClient();
  const { data: channels } = await supabase
    .from('channels').select('id, slug, name, description').order('sort');

  // One count per channel. Fine at this scale; if the board grows, replace
  // with a single grouped view rather than N round trips.
  const counts = await Promise.all(
    (channels || []).map(async (c) => {
      const { count } = await supabase
        .from('post_feed').select('*', { count: 'exact', head: true }).eq('channel_id', c.id);
      return [c.id, count || 0];
    }),
  );
  const byId = Object.fromEntries(counts);

  return (
    <main className="page wrap">
      <div className="page-head">
        <p className="eyebrow">The board</p>
        <h1>Topics.</h1>
        <p>Channels are league-wide. Posts are short by design — say one thing well.</p>
      </div>

      <div className="chan-grid">
        {(channels || []).map((c) => (
          <Link className="chan" key={c.id} href={`/hub/topics/${c.slug}`}>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <span className="count">{byId[c.id]} post{byId[c.id] === 1 ? '' : 's'}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

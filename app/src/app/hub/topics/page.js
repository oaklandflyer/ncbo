import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Page, PageHeader, CardLink, Empty, Pill } from '../ui';

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
    <Page>
      <PageHeader eyebrow="The board" title="Topics.">
        Channels are league-wide. Posts are short by design — say one thing well.
      </PageHeader>

      {channels?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => (
            <CardLink key={c.id} href={`/hub/topics/${c.slug}`} Component={Link} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold uppercase tracking-[0.06em] text-ink transition group-hover:text-steel-light">
                  {c.name}
                </h3>
                <Pill tone={byId[c.id] > 0 ? 'open' : 'quiet'}>
                  {byId[c.id]} post{byId[c.id] === 1 ? '' : 's'}
                </Pill>
              </div>
              <p className="mt-2 grow text-[0.9rem] leading-relaxed text-silver-dim">
                {c.description}
              </p>
            </CardLink>
          ))}
        </div>
      ) : (
        <Empty>No channels yet.</Empty>
      )}
    </Page>
  );
}

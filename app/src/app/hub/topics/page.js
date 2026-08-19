import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Page, PageHero, Section, SectionTitle, CardLink, Empty, Badge } from '@/app/ui';

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
  const total = Object.values(byId).reduce((a, b) => a + b, 0);

  return (
    <Page>
      <PageHero
        eyebrow="The board"
        title="Topics."
        lead="Channels are league-wide. Posts are short by design — say one thing well."
      />

      <Section>
        <SectionTitle count={total > 0 ? `${total} post${total === 1 ? '' : 's'}` : null}>
          Channels
        </SectionTitle>

        {channels?.length ? (
          /* auto-fill, matching .clubs-grid — the row doesn't leave a hole
             when there are four channels instead of six. */
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {channels.map((c) => (
              <CardLink key={c.id} href={`/hub/topics/${c.slug}`} Component={Link} className="flex flex-col">
                <h3 className="font-display text-[1.45rem] font-extrabold uppercase leading-[1.05] text-ink transition group-hover:text-brand">
                  {c.name}
                </h3>
                <p className="mt-2 grow text-[0.96rem] leading-relaxed text-body">{c.description}</p>
                <div className="mt-5 flex items-center justify-between border-t border-edge pt-4">
                  <Badge tone={byId[c.id] > 0 ? 'active' : 'forming'}>
                    {byId[c.id]} post{byId[c.id] === 1 ? '' : 's'}
                  </Badge>
                  <span
                    aria-hidden
                    className="font-display text-[0.82rem] font-bold uppercase tracking-[0.12em] text-brand transition group-hover:translate-x-[4px]"
                  >
                    Open →
                  </span>
                </div>
              </CardLink>
            ))}
          </div>
        ) : (
          <Empty>No channels yet.</Empty>
        )}
      </Section>
    </Page>
  );
}

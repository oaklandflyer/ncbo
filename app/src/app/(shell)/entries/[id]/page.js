import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section, SectionTitle, Card, Badge, Meta, fineprint } from '@/app/ui';
import ShareButton from './share-button';

export const metadata = { title: 'Your result · NCBO' };

export default async function EntryDetail({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn) redirect('/login');
  if (!viewer.profile) return null;

  const { data: entry } = await supabase
    .from('competition_entries')
    .select('id, show_name, federation, date, division, class, placing, won_overall, status, rejection_reason, share_token, profile_id, profiles!competition_entries_profile_id_fkey(display_name), competition_handlers(handler_profile_id, profiles(display_name))')
    .eq('id', id)
    .maybeSingle();

  if (!entry) notFound();

  const mine = entry.profile_id === viewer.userId;
  const crew = (entry.competition_handlers || []).map((h) => h.profiles?.display_name).filter(Boolean);

  return (
    <Page>
      <PageHero
        eyebrow={entry.federation}
        title={entry.show_name}
        lead={`${entry.division}${entry.class ? ` · ${entry.class}` : ''} · ${entry.placing}${entry.won_overall ? ' · overall' : ''}`}
      />

      <Section>
        <div className="flex flex-wrap items-center gap-3">
          {entry.status === 'approved' && <Badge tone="active">Verified</Badge>}
          {entry.status === 'pending' && <Badge>Pending verification</Badge>}
          {entry.status === 'returned' && <Badge tone="forming">Sent back</Badge>}
          <Meta>{new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-US', { dateStyle: 'medium' })}</Meta>
        </div>

        {/* The reason lives here and nowhere else: in-app, on the athlete's own
            entry, where they can act on it. No email, because an email about a
            bodybuilding result is an email nobody opens. */}
        {entry.status === 'returned' && (
          <Card className="mt-5 border-l-[3px] border-l-danger p-5">
            <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.03em] text-ink">
              Your club lead sent this back
            </p>
            <p className="mt-2 text-[0.98rem] text-body">{entry.rejection_reason}</p>
            {mine && (
              <p className={`mt-3 ${fineprint}`}>
                Fix it and log the result again. This entry stays here as a record.
              </p>
            )}
          </Card>
        )}

        {entry.status === 'pending' && mine && (
          <p className="mt-5 max-w-[620px] text-[0.98rem] text-body">
            Your lead has this in their queue. You can share the card now — it goes out with a
            &ldquo;pending verification&rdquo; band on it, and loses the band once they approve.
          </p>
        )}
      </Section>

      {crew.length > 0 && (
        <Section>
          <SectionTitle>Handlers and pit crew</SectionTitle>
          <p className="text-[0.98rem] text-body">{crew.join(', ')}</p>
        </Section>
      )}

      {entry.status !== 'returned' && (
        <Section band>
          <SectionTitle>Share it</SectionTitle>
          <ShareButton
            token={entry.share_token}
            athlete={entry.profiles?.display_name || 'NCBO athlete'}
            show={entry.show_name}
          />
        </Section>
      )}

      <Section>
        <Link className="font-semibold text-brand underline underline-offset-2" href="/hub">
          Back to the hub
        </Link>
      </Section>
    </Page>
  );
}

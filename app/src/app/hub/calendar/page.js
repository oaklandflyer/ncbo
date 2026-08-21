import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { fetchUpcomingEvents, icsUrl } from '@/lib/gcal';
import { Page, PageHero, Section, SectionTitle, Card, Meta, Empty, btnGhost, btnSmall, fineprint } from '@/app/ui';

export const metadata = { title: 'Calendar · NCBO' };

/**
 * The chapter's own schedule, read from the calendar their lead already keeps.
 *
 * Read-only by design. The moment this app could write events it would become
 * a second place to maintain them, and the copy nobody updates is always the
 * one members are looking at.
 */
export default async function ClubCalendarFeed() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn) redirect('/login');
  if (!viewer.profile) return null;

  const clubId = viewer.membership?.clubId;
  const { data: club } = clubId
    ? await supabase.from('clubs').select('name, gcal_id, gcal_timezone, gcal_published').eq('id', clubId).maybeSingle()
    : { data: null };

  const live = club?.gcal_id && club.gcal_published;
  const { events, ok, error } = live
    ? await fetchUpcomingEvents(club.gcal_id)
    : { events: [], ok: false, error: null };

  const zone = club?.gcal_timezone || 'America/New_York';
  const ics = live ? icsUrl(club.gcal_id) : null;

  return (
    <Page>
      <PageHero
        eyebrow={club?.name || 'Your chapter'}
        title="What's on."
        lead="Lifts, meetings and posing practice, straight from your chapter's calendar."
        actions={ics ? (
          <a className={`${btnGhost} ${btnSmall} bg-surface`} href={ics}>Subscribe (.ics)</a>
        ) : null}
      />

      <Section>
        <SectionTitle count={events.length || null}>Coming up</SectionTitle>

        {!clubId && <Empty>Join a chapter to see its calendar.</Empty>}

        {clubId && !club?.gcal_id && (
          <Empty>
            Your chapter has not connected a calendar yet.{' '}
            {viewer.isClubLead
              ? <Link className="font-semibold text-brand underline underline-offset-2" href="/club/calendar">Set one up</Link>
              : 'Ask your club lead to set one up.'}
          </Empty>
        )}

        {clubId && club?.gcal_id && !club.gcal_published && (
          <Empty>
            Your lead is still setting the calendar up. It appears here once they publish it.
          </Empty>
        )}

        {live && !ok && (
          <Empty>
            The calendar could not be read just now.{' '}
            {viewer.isClubLead ? 'Re-test it from Calendar setup.' : 'Your lead has been able to see this too.'}
          </Empty>
        )}

        {live && ok && events.length === 0 && (
          <Empty>Nothing on the calendar in the next few weeks.</Empty>
        )}

        {events.length > 0 && (
          <ul className="grid list-none gap-3">
            {events.map((e) => (
              <li key={e.id}>
                <Card className="flex flex-wrap items-baseline justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="font-display text-[1.05rem] font-bold uppercase tracking-[0.02em] text-ink">
                      {e.title}
                    </p>
                    <Meta className="mt-1">
                      {formatWhen(e.start, e.allDay, zone)}
                      {e.location ? ` · ${e.location}` : ''}
                    </Meta>
                  </div>
                  {e.htmlLink && (
                    <a className={`${btnGhost} ${btnSmall}`} href={e.htmlLink} target="_blank" rel="noopener noreferrer">
                      Open
                    </a>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}

        {ics && (
          <p className={`mt-6 ${fineprint}`}>
            Subscribing adds these to your own calendar app and keeps them updated. Times are shown
            in {zone.replace('_', ' ')}.
          </p>
        )}
      </Section>
    </Page>
  );
}

/* Google hands back an instant; the chapter meets at a wall-clock time. The
   club's own zone is what turns one back into the other. */
function formatWhen(start, allDay, zone) {
  if (!start) return '';
  if (allDay) {
    return new Date(`${start}T12:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  }
  return new Date(start).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: zone,
  });
}

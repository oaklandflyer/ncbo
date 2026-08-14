import type { APIRoute, GetStaticPaths } from 'astro';
import { buildCalendar } from '../../lib/ics.js';
import { getEvents, type EventData } from '../../lib/data/events.js';

/** One .ics per event, so "add to calendar" is a plain static file download. */
export const getStaticPaths = (async () => {
  const events = await getEvents();
  return events.map((event) => ({ params: { slug: event.slug }, props: { event } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const event = props['event'] as EventData;
  const body = buildCalendar(
    [
      {
        uid: event.slug,
        title: event.title,
        description: event.description,
        location: event.venue.address
          ? `${event.venue.name}, ${event.venue.address}`
          : event.venue.name,
        start: event.start,
        end: event.end,
        url: `https://thencbo.org/events/${event.slug}`,
      },
    ],
    { name: event.title, domain: 'thencbo.org' },
  );

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
    },
  });
};

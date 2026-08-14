import type { APIRoute } from 'astro';
import { buildCalendar } from '../../lib/ics.js';
import { getEvents } from '../../lib/data/events.js';

/**
 * The whole-calendar feed, generated at build time as a static file.
 * No third-party calendar service, no tracking, no account.
 */
export const GET: APIRoute = async () => {
  const events = await getEvents();
  const body = buildCalendar(
    events.map((event) => ({
      uid: event.slug,
      title: event.title,
      description: event.description,
      location: event.venue.address ? `${event.venue.name}, ${event.venue.address}` : event.venue.name,
      start: event.start,
      end: event.end,
      url: `https://thencbo.org/events/${event.slug}`,
    })),
    { name: 'NCBO Events', domain: 'thencbo.org' },
  );

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ncbo-events.ics"',
    },
  });
};

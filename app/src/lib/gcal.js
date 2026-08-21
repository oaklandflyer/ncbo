/**
 * Google Calendar, read-only.
 *
 * A chapter's schedule already lives in a calendar the lead keeps. This reads
 * it rather than asking them to maintain a second copy here, which would
 * always be the stale one.
 *
 * Everything in this file runs on the server. The API key is not public, and a
 * calendar id is not a secret but is also nobody's business outside the club.
 */

const API = 'https://www.googleapis.com/calendar/v3/calendars';

/**
 * The setup instructions, defined once.
 *
 * Rendered as JSX on the page and serialised to plain text for the clipboard
 * from this same array, so the two can never drift. That matters more than it
 * sounds: the copied version is the one a lead pastes into a group chat and
 * follows on a phone, and it is the version nobody proof-reads.
 *
 * The warning is inline in step 3 rather than a footnote, because a lead who
 * copies the steps and hits the university block will not scroll back here to
 * find out why.
 */
export const GCAL_STEPS = [
  {
    title: 'Open your club calendar in Google Calendar',
    body: 'On a computer, go to calendar.google.com and find the calendar in the left sidebar.',
  },
  {
    title: 'Open its settings',
    body: 'Hover the calendar name, click the three dots, then "Settings and sharing".',
  },
  {
    title: 'Make it public',
    body: 'Under "Access permissions for events", tick "Make available to public".',
    warning:
      'If your university email blocks public calendars, create a free club @gmail.com account and keep the calendar there. Plenty of chapters do this, and it is the fastest fix.',
  },
  {
    title: 'Copy the Calendar ID',
    body: 'Scroll to "Integrate calendar". The Calendar ID looks like an email address. Copy the whole thing.',
  },
  {
    title: 'Paste it below and test',
    body: 'Test the connection before saving. A working calendar shows you its next few events.',
  },
];

/** The same steps as plain text, for the clipboard. One source, two shapes. */
export function gcalStepsAsText() {
  return GCAL_STEPS.map((step, i) => {
    const lines = [`${i + 1}. ${step.title}`, `   ${step.body}`];
    if (step.warning) lines.push(`   NOTE: ${step.warning}`);
    return lines.join('\n');
  }).join('\n\n');
}

/**
 * Upcoming events for one calendar.
 *
 * Cached for an hour. A club schedule changes a few times a semester, and
 * fetching it per request would spend the API quota on re-reading something
 * that did not change.
 */
export async function fetchUpcomingEvents(gcalId, { max = 20 } = {}) {
  const key = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!gcalId) return { ok: false, error: 'no-calendar', events: [] };
  if (!key) return { ok: false, error: 'no-api-key', events: [] };

  const url = `${API}/${encodeURIComponent(gcalId)}/events`
    + `?key=${encodeURIComponent(key)}`
    + `&timeMin=${encodeURIComponent(new Date().toISOString())}`
    + `&singleEvents=true&orderBy=startTime&maxResults=${max}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return { ok: false, error: readableGcalError(res.status), events: [] };
    }
    const body = await res.json();
    return { ok: true, timeZone: body.timeZone || null, events: (body.items || []).map(normalise) };
  } catch {
    return { ok: false, error: 'unreachable', events: [] };
  }
}

/**
 * Does this id work, before anybody saves it?
 *
 * The whole reason a lead gets a Test button is that the failure modes here
 * are silent: a private calendar and a mistyped id both produce an empty feed,
 * and neither says so until a member opens the page and finds nothing.
 */
export async function probeCalendar(gcalId) {
  const trimmed = String(gcalId || '').trim();
  if (!trimmed) {
    return { ok: false, eventCount: 0, sampleTitles: [], timeZone: null, error: 'Paste the Calendar ID first.' };
  }

  const result = await fetchUpcomingEvents(trimmed, { max: 3 });

  if (!result.ok) {
    return {
      ok: false,
      eventCount: 0,
      sampleTitles: [],
      timeZone: null,
      error: {
        'no-api-key': 'The server has no Google Calendar API key configured. An admin sets GOOGLE_CALENDAR_API_KEY.',
        'not-found': 'Google does not know that Calendar ID. Check for a stray space or a missing @group.calendar.google.com.',
        'forbidden': 'That calendar is not public yet. Step 3 is the one that usually gets missed.',
        'unreachable': 'Could not reach Google just now. Try again in a moment.',
      }[result.error] || 'That did not work.',
    };
  }

  return {
    ok: true,
    eventCount: result.events.length,
    sampleTitles: result.events.slice(0, 3).map((e) => e.title),
    timeZone: result.timeZone,
    error: null,
  };
}

function readableGcalError(status) {
  if (status === 404) return 'not-found';
  if (status === 403 || status === 401) return 'forbidden';
  return 'unreachable';
}

function normalise(item) {
  const start = item.start?.dateTime || item.start?.date || null;
  return {
    id: item.id,
    title: item.summary || 'Untitled event',
    location: item.location || null,
    description: item.description || null,
    start,
    allDay: !item.start?.dateTime,
    htmlLink: item.htmlLink || null,
  };
}

/** The public .ics feed for the same calendar, for members who subscribe. */
export function icsUrl(gcalId) {
  if (!gcalId) return null;
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(gcalId)}/public/basic.ics`;
}

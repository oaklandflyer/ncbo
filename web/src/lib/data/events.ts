/**
 * Event loading, shared by the listing, the detail pages and the .ics endpoints.
 *
 * `data/events/` is empty: NCBO has scheduled nothing, and the marketing site
 * says so. Sample events load under NCBO_DEMO_DATA=1 on the dev server only, and
 * are validated against the same schema as real ones so they cannot drift.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { getCollection } from 'astro:content';
import { eventSchema } from '../schemas.js';
import { isDemo } from './demo.js';

export type EventData = ReturnType<typeof eventSchema.parse>;

function loadSampleEvents(): EventData[] {
  const dir = new URL('../../../../data/samples/events/', import.meta.url);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((file) => file.endsWith('.json'));
  } catch {
    return [];
  }
  return files.map((file) =>
    eventSchema.parse(JSON.parse(readFileSync(new URL(file, dir), 'utf8'))),
  );
}

export async function getEvents(): Promise<EventData[]> {
  if (isDemo()) return loadSampleEvents();
  const entries = await getCollection('events');
  return entries.map((entry) => entry.data as EventData);
}

export interface SplitEvents {
  upcoming: EventData[];
  past: EventData[];
}

/**
 * Split on a caller-supplied "now" so the split is testable and so a build is
 * reproducible for a given timestamp.
 */
export function splitByDate(events: readonly EventData[], now: Date): SplitEvents {
  const upcoming: EventData[] = [];
  const past: EventData[] = [];
  for (const event of events) {
    // An event is "past" only once it has finished, so an in-progress event still
    // shows as upcoming rather than vanishing mid-way through the day.
    if (new Date(event.end).getTime() >= now.getTime()) upcoming.push(event);
    else past.push(event);
  }
  upcoming.sort((a, b) => a.start.localeCompare(b.start));
  past.sort((a, b) => b.start.localeCompare(a.start));
  return { upcoming, past };
}

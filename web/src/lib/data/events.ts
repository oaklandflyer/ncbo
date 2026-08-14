/**
 * Event loading, shared by the listing, the detail pages and the .ics endpoints.
 *
 * `data/events/` is empty: NCBO has scheduled nothing, and the marketing site
 * says so. Sample events load under NCBO_DEMO_DATA=1 on the dev server only, and
 * are validated against the same schema as real ones so they cannot drift.
 */

import { getCollection } from 'astro:content';
import { eventSchema } from '../schemas.js';
import { isDemo } from './demo.js';

export type EventData = ReturnType<typeof eventSchema.parse>;

// Globbed at build time by the bundler, so sample files are inlined and there is
// no directory read at runtime. Still parsed through the real schema.
const sampleModules = import.meta.glob('../../../../data/samples/events/*.json', {
  eager: true,
}) as Record<string, { default: unknown }>;

function loadSampleEvents(): EventData[] {
  return Object.values(sampleModules).map((module) => eventSchema.parse(module.default));
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

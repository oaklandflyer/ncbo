/**
 * Content schemas, defined against the plain `zod` package rather than the copy
 * re-exported by `astro:content`.
 *
 * The reason is practical: these schemas are used in two places — as content
 * collection schemas (build-time validation of `data/`) and directly by the
 * sample-data loaders, which run outside the content pipeline. Importing the
 * virtual `astro:content` module from ordinary library code fails at build time,
 * so the definitions live here and `content.config.ts` imports them. One
 * definition, so samples cannot drift from real data.
 */
import { z } from 'zod';

/** A verifiable external source. Every factual claim on the site carries one. */
export const citationSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  /** ISO date the URL was last checked. Rendered next to the link. */
  accessed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'accessed must be YYYY-MM-DD'),
  publisher: z.string().optional(),
  doi: z.string().optional(),
});

/**
 * A plotted map location.
 *
 * `precision` is required and rendered, because a city-level pin and a campus-level
 * pin are different claims and the map should not blur them. A club with no
 * verified coordinate sets `location: null` and appears in the text list only —
 * never as a guessed pin.
 */
export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.enum(['campus', 'city']),
  label: z.string().min(1),
  source: citationSchema,
});

export const clubSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  school: z.string().min(1),
  clubName: z.string().min(1),
  campus: z.string().optional(),
  state: z.string().length(2),
  status: z.enum(['active', 'forming', 'inactive']),
  /** NCBO has sanctioned no events or clubs yet; the badge exists, the flag is false. */
  sanctioned: z.boolean().default(false),
  lead: z.object({ name: z.string().min(1) }).nullable().default(null),
  location: locationSchema.nullable().default(null),
  locationNote: z.string().optional(),
  /**
   * IPEDS UnitID, the join key to `data/enrollment.json`. Null until someone
   * verifies it against the IPEDS directory — it is not inferred from the name.
   */
  ipedsUnitId: z.number().int().positive().nullable().default(null),
  /**
   * Count of members whose membership has been verified. Null means unknown,
   * which is not the same as zero and is treated as "cannot be ranked".
   */
  verifiedMembers: z.number().int().nonnegative().nullable().default(null),
  conference: z.string().optional(),
  /** Where this record came from, so a reviewer can re-check it. */
  provenance: z.string().min(1),
});

export const conferenceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().optional(),
});

/** Shared by real events and sample events, so samples cannot drift from the schema. */
export const eventSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  /** Hosting club slug, or the organisation itself. */
  host: z.string().min(1),
  type: z.enum(['sanctioned', 'club-meeting', 'recruiting']),
  sanctioned: z.boolean().default(false),
  venue: z.object({
    name: z.string().min(1),
    address: z.string().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }),
  /** ISO 8601 with offset, e.g. 2026-10-04T18:00:00-04:00. Offset is required. */
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  description: z.string().min(1),
  /** Multiplier on points earned at this event. 0 for non-scoring events. */
  pointsWeight: z.number().min(0).default(0),
  sources: z.array(citationSchema).default([]),
});

/** Cross-field rules that a plain object schema cannot express. */
export const validatedEventSchema = eventSchema
  .refine((event) => new Date(event.end) >= new Date(event.start), {
    message: 'end must not be before start',
    path: ['end'],
  })
  .refine((event) => !event.sanctioned || event.type === 'sanctioned', {
    message: 'only an event of type "sanctioned" may set sanctioned: true',
    path: ['sanctioned'],
  });

export const resourceSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().default(0),
  /**
   * Pages making health, nutrition or training claims must carry the medical
   * disclaimer and link to /resources/health. Enforced here rather than left to
   * whoever edits the Markdown next.
   */
  medicalDisclaimer: z.boolean().default(false),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sources: z.array(citationSchema).default([]),
});

export type Citation = z.infer<typeof citationSchema>;
export type Club = z.infer<typeof clubSchema>;
export type EventData = z.infer<typeof eventSchema>;

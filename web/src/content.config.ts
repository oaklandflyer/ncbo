import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  clubSchema,
  conferenceSchema,
  resourceSchema,
  validatedEventSchema,
} from './lib/schemas.js';

/**
 * Content collections.
 *
 * These schemas are the build gate: an invalid club, event or citation fails
 * `astro build` rather than rendering a half-broken page or, worse, a plausible
 * wrong number. The schemas themselves live in src/lib/schemas.ts so that the
 * sample-data loaders can share them — see the note there.
 *
 * Data files live at the repo root under `data/`, outside this Astro project,
 * because they are organisation data rather than app code.
 */

const clubs = defineCollection({
  loader: glob({ pattern: '**/*.json', base: '../data/clubs' }),
  schema: clubSchema,
});

const conferences = defineCollection({
  loader: glob({ pattern: '**/*.json', base: '../data/conferences' }),
  schema: conferenceSchema,
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.json', base: '../data/events' }),
  schema: validatedEventSchema,
});

/** Markdown reference content: /resources/*. */
const resources = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/resources' }),
  schema: resourceSchema,
});

export const collections = { clubs, conferences, events, resources };
